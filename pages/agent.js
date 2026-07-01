import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Nav from '../components/Nav';
import OutcomeForm from '../components/OutcomeForm';

const Softphone = dynamic(() => import('../components/Softphone'), { ssr: false });

const COUNTDOWN_SECONDS = 3;

export default function Agent() {
  const router = useRouter();

  // Current call
  const [contact, setContact]         = useState(null);
  const [callId, setCallId]           = useState(null);
  const [callStatus, setCallStatus]   = useState('idle'); // 'idle' | 'ringing' | 'active'
  const [elapsed, setElapsed]         = useState(0);
  const [ringElapsed, setRingElapsed] = useState(0);
  const [dialing, setDialing]         = useState(false);
  const [error, setError]             = useState('');

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
  const countdownRef   = useRef(null);
  const outcomeSaved   = useRef(false);
  const autoEnabledRef = useRef(true);
  const softphoneRef   = useRef(null);

  useEffect(() => { autoEnabledRef.current = autoEnabled; }, [autoEnabled]);

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
    if (callStatus === 'active') {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      if (callStatus !== 'ringing') setElapsed(0);
    }
    return () => clearInterval(timerRef.current);
  }, [callStatus]);

  // Ringing timer
  useEffect(() => {
    if (callStatus === 'ringing') {
      setRingElapsed(0);
      ringTimerRef.current = setInterval(() => setRingElapsed((s) => s + 1), 1000);
    } else {
      clearInterval(ringTimerRef.current);
    }
    return () => clearInterval(ringTimerRef.current);
  }, [callStatus]);

  function fmt(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  }

  const triggerDial = useCallback(async (contactId = null) => {
    setError('');
    setDialing(true);
    try {
      const body = contactId ? JSON.stringify({ contact_id: contactId }) : '{}';
      const res  = await fetch('/api/calls/dial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setContact(data.contact);
      setCallId(data.call_id);
      setElapsed(0);
      setCallStatus('ringing');
      outcomeSaved.current = false;
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
    setContact(null);
    setCallId(null);
    setCallStatus('idle');
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

  function handleCallEnded(wasAnswered) {
    if (outcomeSaved.current) { resetCallState(); return; }
    if (contact && callId) {
      // Only auto-save if it was actually answered; if not answered, AMD already handles it
      if (wasAnswered) {
        fetch('/api/outcomes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_id: callId, contact_id: contact.id, result: 'answered', notes: '' }),
        });
        archiveToPrev();
      }
    }
    resetCallState();
    if (autoEnabledRef.current) startCountdown();
  }

  function handleHangup() {
    softphoneRef.current?.hangup();
  }

  function handleCallRinging() {
    // Softphone received the incoming leg — already set via triggerDial
  }

  function handleCallConnected() {
    setCallStatus('active');
    // Mark contact as answered immediately when call is picked up
    if (contact?.id) {
      fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'answered' }),
      });
    }
  }

  const callActive  = callStatus === 'active';
  const callRinging = callStatus === 'ringing';
  const hasCall     = callActive || callRinging;

  return (
    <>
      <Head><title>Agente — Discador Pro</title></Head>
      <Nav />
      <div className="container" style={{ maxWidth: 500 }}>
        <div className="card">

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

          {/* Current call */}
          {hasCall && contact ? (
            <>
              <div className="call-panel" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      {callRinging ? (
                        <>
                          <span className="ringing-dot" />
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Chamando…</span>
                        </>
                      ) : (
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
                      {callRinging ? fmt(ringElapsed) : fmt(elapsed)}
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

        {/* Previous call panel */}
        {prevContact && prevCallId && !prevDismissed && (
          <div className="card" style={{ marginTop: 12, borderColor: 'var(--bg-3)', opacity: 0.92 }}>
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
