import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Nav from '../components/Nav';
import OutcomeForm from '../components/OutcomeForm';

const Softphone = dynamic(() => import('../components/Softphone'), { ssr: false });

const COUNTDOWN_SECONDS = 7;
const POLL_MS           = 1000;
const RING_TIMEOUT_S    = 40; // failsafe if Twilio never reports a terminal status
const FAILED_STATUSES   = ['busy', 'no-answer', 'failed', 'canceled'];

export default function Agent() {
  const router = useRouter();

  // Current call
  const [contact, setContact]         = useState(null);
  const [callId, setCallId]           = useState(null);
  // 'idle' | 'ringing' (dialing, lead hasn't picked up) | 'connecting' (lead picked up, bridging to agent) | 'active' (agent is on the line)
  const [callPhase, setCallPhase]     = useState('idle');
  const [elapsed, setElapsed]         = useState(0);
  const [ringElapsed, setRingElapsed] = useState(0);
  const [dialing, setDialing]         = useState(false);
  const [error, setError]             = useState('');
  const [banner, setBanner]           = useState(null); // { text, tone } — brief feedback on how the last call ended

  // Previous call (shown below while next call is in progress)
  const [prevContact, setPrevContact] = useState(null);
  const [prevCallId, setPrevCallId]   = useState(null);
  const [prevDismissed, setPrevDismissed] = useState(false);

  // Auto-dial
  const [queue, setQueue]             = useState(0);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [countdown, setCountdown]     = useState(null);

  const timerRef       = useRef(null);
  const ringTimerRef   = useRef(null);
  const pollRef        = useRef(null);
  const countdownRef   = useRef(null);
  const outcomeSaved   = useRef(false);
  const autoEnabledRef = useRef(true);
  const softphoneRef   = useRef(null);
  const callPhaseRef   = useRef('idle');
  const bannerTimeoutRef = useRef(null);

  function showBanner(text, tone) {
    clearTimeout(bannerTimeoutRef.current);
    setBanner({ text, tone });
    bannerTimeoutRef.current = setTimeout(() => setBanner(null), 5000);
  }

  useEffect(() => { autoEnabledRef.current = autoEnabled; }, [autoEnabled]);
  useEffect(() => { callPhaseRef.current = callPhase; }, [callPhase]);

  function refreshQueue() {
    fetch('/api/contacts?status=pending')
      .then((r) => r.json())
      .then((d) => setQueue(d.contacts?.length || 0));
  }

  useEffect(() => { refreshQueue(); }, []);

  // Auto-dial specific contact when coming from kanban (?contact=ID)
  useEffect(() => {
    if (!router.isReady) return;
    const { contact: contactId } = router.query;
    if (contactId) {
      router.replace('/agent', undefined, { shallow: true });
      triggerDial(contactId);
    }
  }, [router.isReady]);

  // Active call timer
  useEffect(() => {
    if (callPhase === 'active') {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      if (callPhase === 'idle') setElapsed(0);
    }
    return () => clearInterval(timerRef.current);
  }, [callPhase]);

  // Ring/connecting timer
  useEffect(() => {
    if (callPhase === 'ringing' || callPhase === 'connecting') {
      if (callPhase === 'ringing') setRingElapsed(0);
      ringTimerRef.current = setInterval(() => setRingElapsed((s) => s + 1), 1000);
    } else {
      clearInterval(ringTimerRef.current);
    }
    return () => clearInterval(ringTimerRef.current);
  }, [callPhase]);

  function fmt(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  }

  function stopPolling() {
    clearInterval(pollRef.current);
    pollRef.current = null;
  }

  // Poll the real Twilio call status until the lead answers or the call fails —
  // the browser softphone only receives the call *after* the lead has already
  // picked up, so this is the only way to detect "recusou" / "não atendeu" quickly.
  function startPolling(cId, contactId) {
    stopPolling();
    let ringSeconds = 0;
    pollRef.current = setInterval(async () => {
      ringSeconds += POLL_MS / 1000;

      if (ringSeconds >= RING_TIMEOUT_S && callPhaseRef.current === 'ringing') {
        stopPolling();
        endUnansweredCall(cId, contactId, false);
        return;
      }

      try {
        const r = await fetch(`/api/calls/${cId}/status`);
        const d = await r.json();
        if (!d.status) return;

        // AMD (or anything else server-side) already recorded an outcome for
        // this call (e.g. voicemail detected) — don't fight it, just end locally.
        if (d.hasOutcome && callPhaseRef.current !== 'active') {
          stopPolling();
          endUnansweredCall(cId, contactId, true);
          return;
        }

        if (d.status === 'in-progress' && callPhaseRef.current === 'ringing') {
          setCallPhase('connecting');
        } else if (FAILED_STATUSES.includes(d.status) && callPhaseRef.current !== 'active') {
          stopPolling();
          endUnansweredCall(cId, contactId, false);
        } else if (d.status === 'completed' && callPhaseRef.current !== 'active') {
          // Ended before the agent leg ever bridged
          stopPolling();
          endUnansweredCall(cId, contactId, false);
        }
      } catch (_) {
        // transient network error — try again next tick
      }
    }, POLL_MS);
  }

  // Call ended (declined, no answer, timed out, or already handled by AMD) without
  // ever reaching the agent. `skipOutcome` = true when an outcome already exists
  // (e.g. AMD already saved 'voicemail') so we must not write a conflicting one.
  function endUnansweredCall(cId, contactId, skipOutcome) {
    if (outcomeSaved.current) return;
    if (callPhaseRef.current === 'active') return;
    outcomeSaved.current = true;
    const name = contact?.name;
    if (contactId && !skipOutcome) {
      fetch('/api/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: cId, contact_id: contactId, result: 'no_answer', notes: '' }),
      });
      showBanner(`— Não atendeu${name ? ` — ${name}` : ''} (volta pra fila)`, 'gray');
    } else if (skipOutcome) {
      // AMD already flagged this — the brief "Atendeu" flash was actually voicemail/decline
      showBanner(`📵 Caixa postal / recusada${name ? ` — ${name}` : ''} (volta pra fila)`, 'amber');
    }
    resetCallState();
    if (autoEnabledRef.current) startCountdown();
  }

  const triggerDial = useCallback(async (contactId = null) => {
    setError('');
    setBanner(null);
    setDialing(true);
    try {
      const agent_identity = softphoneRef.current?.identity || undefined;
      const body = JSON.stringify({ ...(contactId ? { contact_id: contactId } : {}), agent_identity });
      const res  = await fetch('/api/calls/dial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        // A 409 (call already in flight) is transient — retry shortly instead
        // of leaving auto-dial permanently stuck on the error.
        if (res.status === 409 && !contactId && autoEnabledRef.current) startCountdown();
        return;
      }
      setContact(data.contact);
      setCallId(data.call_id);
      setElapsed(0);
      setCallPhase('ringing');
      outcomeSaved.current = false;
      startPolling(data.call_id, data.contact.id);
    } finally {
      setDialing(false);
    }
  }, []);

  const startCountdown = useCallback(() => {
    clearInterval(countdownRef.current);
    setCountdown(COUNTDOWN_SECONDS);
    let rem = COUNTDOWN_SECONDS;
    countdownRef.current = setInterval(() => {
      rem -= 1;
      setCountdown(rem);
      if (rem <= 0) {
        clearInterval(countdownRef.current);
        setCountdown(null);
        if (autoEnabledRef.current) triggerDial();
      }
    }, 1000);
  }, [triggerDial]);

  function cancelCountdown() {
    clearInterval(countdownRef.current);
    setCountdown(null);
  }

  // Save prev contact before clearing, so agent can still fill in outcome
  function archiveToPrev() {
    if (contact && callId && !outcomeSaved.current) {
      setPrevContact(contact);
      setPrevCallId(callId);
      setPrevDismissed(false);
    }
  }

  function resetCallState() {
    stopPolling();
    setContact(null);
    setCallId(null);
    setCallPhase('idle');
    setElapsed(0);
    outcomeSaved.current = false;
    refreshQueue();
  }

  function handleOutcomeSaved() {
    outcomeSaved.current = true;
    // Clear prev panel if it was the current call
    setPrevContact(null);
    setPrevCallId(null);
    resetCallState();
    if (autoEnabledRef.current) startCountdown();
  }

  async function handleCallEnded(wasAnswered) {
    if (outcomeSaved.current) { resetCallState(); return; }
    if (contact && callId && wasAnswered) {
      // AMD may have already recorded an outcome (e.g. voicemail) server-side
      // right before hanging up — check before overwriting it with 'answered'.
      let hasOutcome = false;
      try {
        const r = await fetch(`/api/calls/${callId}/status`);
        const d = await r.json();
        hasOutcome = !!d.hasOutcome;
      } catch (_) {}

      if (!hasOutcome) {
        outcomeSaved.current = true;
        fetch('/api/outcomes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_id: callId, contact_id: contact.id, result: 'answered', notes: '' }),
        });
        archiveToPrev();
      } else {
        // AMD flagged this as voicemail/machine after the brief "Atendeu" — not a real answer
        showBanner(`📵 Caixa postal / recusada${contact.name ? ` — ${contact.name}` : ''} (volta pra fila)`, 'amber');
      }
    }
    resetCallState();
    if (autoEnabledRef.current) startCountdown();
  }

  // Hangup must work in every phase. Before the lead answers, the browser
  // softphone has no call object yet (only a REST call exists), so we always
  // terminate via the Twilio REST API and, if the softphone does have an
  // active call object, disconnect that too.
  async function handleHangup() {
    const cId = callId;
    const phaseAtClick = callPhaseRef.current;
    softphoneRef.current?.hangup();
    if (cId) {
      fetch(`/api/calls/${cId}/hangup`, { method: 'POST' });
    }
    if (phaseAtClick === 'ringing' || phaseAtClick === 'connecting') {
      stopPolling();
      endUnansweredCall(cId, contact?.id);
    }
    // If phase is 'active', the softphone's disconnect event drives handleCallEnded.
  }

  function handleCallRinging() {
    // Browser leg received — lead already answered on the PSTN side
    setCallPhase('connecting');
  }

  function handleCallConnected() {
    stopPolling();
    setCallPhase('active');
    // Mark contact as answered immediately when call is picked up
    if (contact?.id) {
      fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'answered' }),
      });
    }
  }

  const callActive     = callPhase === 'active';
  const callConnecting = callPhase === 'connecting';
  const callRinging    = callPhase === 'ringing';
  const hasCall         = callActive || callConnecting || callRinging;

  return (
    <>
      <Head><title>Agente — Discador Pro</title></Head>
      <Nav />
      <div
        className="container"
        style={{
          maxWidth: prevContact && prevCallId && !prevDismissed ? 900 : 500,
          display: 'flex', gap: 16, alignItems: 'flex-start',
        }}
      >
        <div className="card" style={{ flex: '1 1 460px', minWidth: 0 }}>

          {/* Header bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`cadence-pill${autoEnabled ? ' active' : ''}`}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: autoEnabled ? 'var(--green)' : 'var(--text-3)', flexShrink: 0 }} />
                Auto-dial {autoEnabled ? 'ativo' : 'pausado'}
              </span>
              {queue > 0 && (
                <span className="cadence-pill">{queue} na fila</span>
              )}
            </div>
            <button
              className={`btn-ghost${autoEnabled ? ' active' : ''}`}
              style={{ padding: '5px 12px', fontSize: 11 }}
              onClick={() => { setAutoEnabled((v) => !v); if (countdown !== null) cancelCountdown(); }}
            >
              {autoEnabled ? 'Pausar' : 'Ativar'}
            </button>
          </div>

          {/* Feedback on how the last call ended */}
          {banner && (
            <div style={{
              marginBottom: 14, padding: '9px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
              background: banner.tone === 'amber' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${banner.tone === 'amber' ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`,
              color: banner.tone === 'amber' ? 'var(--amber)' : 'var(--text-2)',
            }}>
              {banner.text}
            </div>
          )}

          {/* Current call */}
          {hasCall && contact ? (
            <>
              <div className="call-panel" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      {callRinging && (
                        <>
                          <span className="ringing-dot" />
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Chamando…</span>
                        </>
                      )}
                      {callConnecting && (
                        <>
                          <span className="ringing-dot" />
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Conectando…</span>
                        </>
                      )}
                      {callActive && (
                        <>
                          <span className="live-dot" />
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Atendeu</span>
                        </>
                      )}
                    </div>
                    <div className="call-name">{contact.name}</div>
                    <div className="call-company">{contact.company}</div>
                    <div className="call-phone">{contact.phone}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <div className="call-timer">
                      {callActive ? fmt(elapsed) : fmt(ringElapsed)}
                    </div>
                    <button
                      onClick={handleHangup}
                      style={{
                        background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.3)',
                        borderRadius: 6, color: 'var(--red)', fontSize: 12, fontWeight: 600,
                        padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(229,62,62,0.25)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(229,62,62,0.12)'; }}
                    >
                      Desligar
                    </button>
                  </div>
                </div>
              </div>

              {callActive && (
                <OutcomeForm callId={callId} contactId={contact.id} onSaved={handleOutcomeSaved} />
              )}
              {callRinging && (
                <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 13, color: 'var(--text-3)' }}>
                  Aguardando atendimento…
                </div>
              )}
              {callConnecting && (
                <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 13, color: 'var(--text-3)' }}>
                  Lead atendeu — conectando ao seu telefone…
                </div>
              )}
            </>
          ) : countdown !== null ? (
            <div className="idle-panel">
              <div className="countdown-num">{countdown}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Discando próximo…</div>
              <button className="btn-ghost" onClick={cancelCountdown} style={{ marginTop: 4, fontSize: 12 }}>
                Cancelar
              </button>
            </div>
          ) : (
            <div className="idle-panel">
              <div className="idle-icon">📞</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  {queue > 0 ? <><strong style={{ color: 'var(--text-1)' }}>{queue}</strong> contatos aguardando</> : 'Fila vazia'}
                </div>
              </div>
              <button
                className="btn-primary btn-lg"
                onClick={() => triggerDial()}
                disabled={dialing || queue === 0}
                style={{ width: '100%' }}
              >
                {dialing ? 'Discando…' : queue === 0 ? 'Fila vazia' : 'Discar próximo →'}
              </button>
              {error && <p style={{ color: 'var(--red)', fontSize: 12, textAlign: 'center' }}>{error}</p>}
            </div>
          )}

          <Softphone
            controlRef={softphoneRef}
            onCallRinging={handleCallRinging}
            onCallConnected={handleCallConnected}
            onCallEnded={handleCallEnded}
          />
        </div>

        {/* Previous call panel — shown beside the main call panel */}
        {prevContact && prevCallId && !prevDismissed && (
          <div className="card" style={{ flex: '1 1 380px', minWidth: 0, borderColor: 'var(--bg-3)', opacity: 0.92 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                  Ligação anterior
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>{prevContact.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{prevContact.phone}</div>
              </div>
              <button
                className="btn-ghost"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => setPrevDismissed(true)}
              >
                Dispensar
              </button>
            </div>
            <OutcomeForm
              callId={prevCallId}
              contactId={prevContact.id}
              onSaved={() => { setPrevContact(null); setPrevCallId(null); }}
            />
          </div>
        )}
      </div>
    </>
  );
}
