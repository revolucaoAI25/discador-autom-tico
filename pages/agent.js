import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Nav from '../components/Nav';
import OutcomeForm from '../components/OutcomeForm';

const Softphone = dynamic(() => import('../components/Softphone'), { ssr: false });

export default function Agent() {
  const [contact, setContact]       = useState(null);
  const [callId, setCallId]         = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [elapsed, setElapsed]       = useState(0);
  const [dialing, setDialing]       = useState(false);
  const [error, setError]           = useState('');
  const [queue, setQueue]           = useState(0);
  const timerRef = useRef(null);

  function refreshQueue() {
    fetch('/api/contacts?status=pending').then((r) => r.json()).then((d) => setQueue(d.contacts.length));
  }

  useEffect(() => { refreshQueue(); }, []);

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

  async function handleDial() {
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
      setCallActive(true);
    } finally {
      setDialing(false);
    }
  }

  function handleOutcomeSaved() {
    setContact(null);
    setCallId(null);
    setCallActive(false);
    setElapsed(0);
    refreshQueue();
  }

  return (
    <>
      <Head><title>Agente — Discador Pro</title></Head>
      <Nav />
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card">
          {callActive && contact ? (
            <>
              {/* Active call header */}
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
                onClick={handleDial}
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
            onCallEnded={() => { if (contact) setCallActive(false); }}
          />
        </div>
      </div>
    </>
  );
}
