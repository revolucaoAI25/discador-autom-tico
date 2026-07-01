import { useEffect, useState } from 'react';
import Head from 'next/head';
import Nav from '../components/Nav';

export default function Settings() {
  const [dispatches, setDispatches] = useState([]);
  const [name, setName]             = useState('');
  const [url, setUrl]               = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  async function load() {
    const r = await fetch('/api/whatsapp/dispatches');
    const d = await r.json();
    setDispatches(d.dispatches || []);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setError('');
    setSaving(true);
    try {
      const r = await fetch('/api/whatsapp/dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), url: url.trim() }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      setName(''); setUrl('');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await fetch('/api/whatsapp/dispatches', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <>
      <Head><title>Configurações — Discador Pro</title></Head>
      <Nav />
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 18 }}>💬</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Disparos WhatsApp</h2>
          </div>

          {/* Add form */}
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Novo disparo
            </div>
            <input
              placeholder="Nome do disparo (ex: Follow-up sem resposta)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              placeholder="URL do webhook Chatflux"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              type="url"
            />
            {error && <p style={{ color: 'var(--red)', fontSize: 12, margin: 0 }}>{error}</p>}
            <button className="btn-primary" type="submit" disabled={saving} style={{ alignSelf: 'flex-start', padding: '8px 18px' }}>
              {saving ? 'Salvando…' : '+ Adicionar'}
            </button>
          </form>

          <div className="divider" />

          {/* Dispatch list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {dispatches.length === 0 ? (
              <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                Nenhum disparo cadastrado ainda.
              </p>
            ) : dispatches.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', marginBottom: 3 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.url}</div>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: 5, color: 'var(--red)', fontSize: 12,
                    padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                  }}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
