import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Nav from '../components/Nav';
import OutcomeForm from '../components/OutcomeForm';

const Softphone = dynamic(() => import('../components/Softphone'), { ssr: false });

export default function Agent() {
  const [contact, setContact]   = useState(null);
  const [callId, setCallId]     = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [elapsed, setElapsed]   = useState(0);
  const [dialing, setDialing]   = useState(false);
  const [error, setError]       = useState('');
  const [queue, setQueue]       = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    fetch('/api/contacts?status=pending').then((r) => r.json()).then((d) => setQueue(d.contacts.length));
  }, []);

  useEffect(() => {
    if (callActive) {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [callActive]);

  function fmt(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  async function handleDial() {
    setError('');
    setDialing(true);
    try {
      const res = await fetch('/api/calls/dial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
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
    fetch('/api/contacts?status=pending').then((r) => r.json()).then((d) => setQueue(d.contacts.length));
  }

  return (
    <>
      <Head><title>Discador — Agente</title></Head>
      <Nav />
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="card">
          {callActive && contact ? (
            <>
              <div style={{ background: '#0f172a', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>CHAMADA ATIVA — {fmt(elapsed)}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{contact.name}</div>
                <div style={{ color: '#94a3b8' }}>{contact.company}</div>
                <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>{contact.phone}</div>
              </div>

              <OutcomeForm callId={callId} contactId={contact.id} onSaved={handleOutcomeSaved} />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
              <p style={{ color: '#94a3b8', marginBottom: 8 }}>{queue} contatos na fila</p>
              <button
                className="btn-primary"
                style={{ padding: '14px 32px', fontSize: 16 }}
                onClick={handleDial}
                disabled={dialing || queue === 0}
              >
                {dialing ? 'Discando…' : 'Discar próximo'}
              </button>
              {error && <p style={{ color: '#fca5a5', marginTop: 12, fontSize: 14 }}>{error}</p>}
            </div>
          )}

          <Softphone
            onCallConnected={() => setCallActive(true)}
            onCallEnded={() => {
              if (!contact) return;
              setCallActive(false);
            }}
          />
        </div>
      </div>
    </>
  );
}
