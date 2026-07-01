import { useEffect, useRef, useState } from 'react';

export default function WhatsAppButton({ contactId, size = 'sm' }) {
  const [open, setOpen]           = useState(false);
  const [dispatches, setDispatches] = useState([]);
  const [sending, setSending]     = useState(null); // dispatch id being sent
  const [feedback, setFeedback]   = useState(null); // { ok, msg }
  const ref = useRef(null);

  useEffect(() => {
    fetch('/api/whatsapp/dispatches')
      .then((r) => r.json())
      .then((d) => setDispatches(d.dispatches || []));
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  async function send(dispatch) {
    setSending(dispatch.id);
    setFeedback(null);
    try {
      const r = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatch_id: dispatch.id, contact_id: contactId }),
      });
      const d = await r.json();
      if (d.error) {
        setFeedback({ ok: false, msg: d.error });
      } else {
        setFeedback({ ok: true, msg: 'Enviado!' });
        setTimeout(() => { setOpen(false); setFeedback(null); }, 1200);
      }
    } finally {
      setSending(null);
    }
  }

  const btnStyle = {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 5,
    color: '#25D366',
    fontSize: size === 'sm' ? 11 : 13,
    padding: size === 'sm' ? '2px 7px' : '6px 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
    transition: 'all 0.12s',
    lineHeight: 1.4,
  };

  if (dispatches.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        style={btnStyle}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#25D36622'; e.currentTarget.style.borderColor = '#25D366'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        title="Disparar WhatsApp"
      >
        {size === 'sm' ? '💬' : '💬 WhatsApp'}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 500,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 8, minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: 6,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '4px 8px 6px' }}>
            Selecionar disparo
          </div>
          {dispatches.map((d) => (
            <button
              key={d.id}
              onClick={() => send(d)}
              disabled={!!sending}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: sending === d.id ? 'var(--bg-3)' : 'transparent',
                border: 'none', borderRadius: 6,
                color: 'var(--text-1)', fontSize: 13,
                padding: '7px 10px', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (!sending) e.currentTarget.style.background = 'var(--bg-3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = sending === d.id ? 'var(--bg-3)' : 'transparent'; }}
            >
              {sending === d.id ? 'Enviando…' : d.name}
            </button>
          ))}
          {feedback && (
            <div style={{
              margin: '4px 6px 2px', padding: '6px 10px', borderRadius: 6, fontSize: 12,
              background: feedback.ok ? 'rgba(37,211,102,0.1)' : 'rgba(229,62,62,0.1)',
              color: feedback.ok ? '#25D366' : 'var(--red)',
            }}>
              {feedback.msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
