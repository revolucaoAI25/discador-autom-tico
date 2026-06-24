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
  const [contact, setContact]         = useState(null);
  const [callId, setCallId]           = useState(null);
  const [callActive, setCallActive]   = useState(false);
  const [elapsed, setElapsed]         = useState(0);
  const [dialing, setDialing]         = useState(false);
  const [error, setError]             = useState('');
  const [queue, setQueue]             = useState(0);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [countdown, setCountdown]     = useState(null);

  const timerRef       = useRef(null);
  const countdownRef   = useRef(null);
  const outcomeSaved   = useRef(false);
  const autoEnabledRef = useRef(true);

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

  useEffect(() => {
    if (callActive) {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [callActive]);

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
      outcomeSaved.current = false;
      setCallActive(true);
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

  function resetCallState() {
    setContact(null);
    setCallId(null);
    setCallActive(false);
    setElapsed(0);
    outcomeSaved.current = false;
    refreshQueue();
  }

  function handleOutcomeSaved() {
    outcomeSaved.current = true;
    resetCallState();
    if (autoEnabledRef.current) startCountdown();
  }

  function handleCallEnded() {
    if (outcomeSaved.current) return;
    resetCallState();
    if (autoEnabledRef.current) startCountdown();
  }

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
                <span className="cadence-pill">
                  {queue} na fila
                </span>
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

          {callActive && contact ? (
            <>
              <div className="call-panel" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span className="live-dot" />
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ao vivo</span>
                    </div>
                    <div className="call-name">{contact.name}</div>
                    <div className="call-company">{contact.company}</div>
                    <div className="call-phone">{contact.phone}</div>
                  </div>
                  <div className="call-timer">{fmt(elapsed)}</div>
                </div>
              </div>

              <OutcomeForm callId={callId} contactId={contact.id} onSaved={handleOutcomeSaved} />
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
                onClick={triggerDial}
                disabled={dialing || queue === 0}
                style={{ width: '100%' }}
              >
                {dialing ? 'Discando…' : queue === 0 ? 'Fila vazia' : 'Discar próximo →'}
              </button>
              {error && <p style={{ color: 'var(--red)', fontSize: 12, textAlign: 'center' }}>{error}</p>}
            </div>
          )}

          <Softphone onCallConnected={() => setCallActive(true)} onCallEnded={handleCallEnded} />
        </div>
      </div>
    </>
  );
}
