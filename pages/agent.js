import { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Nav from '../components/Nav';
import OutcomeForm from '../components/OutcomeForm';

const Softphone = dynamic(() => import('../components/Softphone'), { ssr: false });

const COUNTDOWN_SECONDS = 3;

export default function Agent() {
  const [contact, setContact]         = useState(null);
  const [callId, setCallId]           = useState(null);
  const [callActive, setCallActive]   = useState(false);
  const [elapsed, setElapsed]         = useState(0);
  const [dialing, setDialing]         = useState(false);
  const [error, setError]             = useState('');
  const [queue, setQueue]             = useState(0);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [countdown, setCountdown]     = useState(null); // null | number

  const timerRef       = useRef(null);
  const countdownRef   = useRef(null);
  const outcomeSaved   = useRef(false); // true when outcome was saved (by agent or AMD)
  const autoEnabledRef = useRef(true);

  // Keep ref in sync with state (avoids stale closures in callbacks)
  useEffect(() => { autoEnabledRef.current = autoEnabled; }, [autoEnabled]);

  function refreshQueue() {
    fetch('/api/contacts?status=pending')
      .then((r) => r.json())
      .then((d) => setQueue(d.contacts.length));
  }

  useEffect(() => { refreshQueue(); }, []);

  // Call duration timer
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

  const startCountdown = useCallback(() => {
    clearInterval(countdownRef.current);
    setCountdown(COUNTDOWN_SECONDS);
    let remaining = COUNTDOWN_SECONDS;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        setCountdown(null);
        if (autoEnabledRef.current) triggerDial();
      }
    }, 1000);
  }, []);

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

  async function triggerDial() {
    setError('');
    setDialing(true);
    try {
      const res = await fetch('/api/calls/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
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
  }

  // Called when agent manually saves outcome
  function handleOutcomeSaved() {
    outcomeSaved.current = true;
    resetCallState();
    if (autoEnabledRef.current) startCountdown();
  }

  // Called when call disconnects in browser (human hang-up or AMD auto-hangup)
  function handleCallEnded() {
    if (outcomeSaved.current) return; // agent already handled it
    // AMD saved outcome server-side — just reset and auto-advance
    resetCallState();
    if (autoEnabledRef.current) startCountdown();
  }

  return (
    <>
      <Head><title>Agente — Discador Pro</title></Head>
      <Nav />
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card">

          {/* Auto-dial toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
              Modo auto-dial
            </span>
            <button
              className={autoEnabled ? 'btn-ghost active' : 'btn-ghost'}
              style={{ padding: '5px 14px', fontSize: 12 }}
              onClick={() => { setAutoEnabled((v) => !v); if (countdown !== null) cancelCountdown(); }}
            >
              {autoEnabled ? '● Ativado' : '○ Desativado'}
            </button>
          </div>

          {callActive && contact ? (
            <>
              <div className="call-panel" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="call-label">Chamada ativa</div>
                    <div className="call-name">{contact.name}</div>
                    <div className="call-company">{contact.company}</div>
                    <div className="call-phone">{contact.phone}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="call-timer">{fmt(elapsed)}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <span className="softphone-status softphone-active">
                        <span className="pulse-dot pulse-warning" />
                        ao vivo
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <OutcomeForm callId={callId} contactId={contact.id} onSaved={handleOutcomeSaved} />
            </>
          ) : countdown !== null ? (
            /* Countdown between calls */
            <div className="idle-panel">
              <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--green)', letterSpacing: -2 }}>
                {countdown}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Próxima chamada em breve…</div>
              <button className="btn-ghost" onClick={cancelCountdown} style={{ marginTop: 4 }}>
                Cancelar auto-dial
              </button>
            </div>
          ) : (
            <div className="idle-panel">
              <div className="idle-icon">📞</div>
              <div style={{ textAlign: 'center' }}>
                <div className="idle-queue">
                  <strong>{queue}</strong> contato{queue !== 1 ? 's' : ''} na fila
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
              {error && (
                <p style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center' }}>{error}</p>
              )}
            </div>
          )}

          <Softphone
            onCallConnected={() => setCallActive(true)}
            onCallEnded={handleCallEnded}
          />
        </div>
      </div>
    </>
  );
}
