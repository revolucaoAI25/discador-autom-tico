import { useEffect, useState } from 'react';
import Head from 'next/head';
import Nav from '../components/Nav';

export default function Settings() {
  const [dispatches, setDispatches] = useState([]);
  const [name, setName]             = useState('');
  const [url, setUrl]               = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [testing, setTesting]       = useState(null); // id (or 'new') of the dispatch currently being tested
  const [testResult, setTestResult] = useState({}); // { [id]: { ok, status, body } }

  async function handleTest(testUrl, key) {
    if (!testUrl?.trim()) return;
    setTesting(key);
    setTestResult((prev) => ({ ...prev, [key]: null }));
    try {
      const r = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: testUrl.trim() }),
      });
      const d = await r.json();
      setTestResult((prev) => ({ ...prev, [key]: d }));
    } catch (e) {
      setTestResult((prev) => ({ ...prev, [key]: { ok: false, status: null, body: e.message } }));
    } finally {
      setTesting(null);
    }
  }

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
              placeholder="URL do seu webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              type="url"
            />
            {error && <p style={{ color: 'var(--red)', fontSize: 12, margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" type="submit" disabled={saving} style={{ padding: '8px 18px' }}>
                {saving ? 'Salvando…' : '+ Adicionar'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!url.trim() || testing === 'new'}
                onClick={() => handleTest(url, 'new')}
                style={{ padding: '8px 18px' }}
              >
                {testing === 'new' ? 'Testando…' : 'Testar'}
              </button>
            </div>
            {testResult.new && (
              <div style={{
                fontSize: 12, padding: '8px 10px', borderRadius: 6,
                background: testResult.new.ok ? 'rgba(0,200,83,0.08)' : 'rgba(229,62,62,0.08)',
                color: testResult.new.ok ? 'var(--green)' : 'var(--red)',
                border: `1px solid ${testResult.new.ok ? 'rgba(0,200,83,0.2)' : 'rgba(229,62,62,0.2)'}`,
              }}>
                {testResult.new.ok ? '✓' : '✕'} Status {testResult.new.status ?? '—'}
                {testResult.new.body && <div style={{ marginTop: 4, color: 'var(--text-3)', wordBreak: 'break-all' }}>{testResult.new.body}</div>}
              </div>
            )}
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
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', marginBottom: 3 }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.url}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleTest(d.url, d.id)}
                      disabled={testing === d.id}
                      style={{
                        background: 'transparent', border: '1px solid var(--border)',
                        borderRadius: 5, color: 'var(--text-2)', fontSize: 12,
                        padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {testing === d.id ? 'Testando…' : 'Testar'}
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      style={{
                        background: 'transparent', border: '1px solid var(--border)',
                        borderRadius: 5, color: 'var(--red)', fontSize: 12,
                        padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
                {testResult[d.id] && (
                  <div style={{
                    marginTop: 8, fontSize: 12, padding: '8px 10px', borderRadius: 6,
                    background: testResult[d.id].ok ? 'rgba(0,200,83,0.08)' : 'rgba(229,62,62,0.08)',
                    color: testResult[d.id].ok ? 'var(--green)' : 'var(--red)',
                    border: `1px solid ${testResult[d.id].ok ? 'rgba(0,200,83,0.2)' : 'rgba(229,62,62,0.2)'}`,
                  }}>
                    {testResult[d.id].ok ? '✓' : '✕'} Status {testResult[d.id].status ?? '—'}
                    {testResult[d.id].body && <div style={{ marginTop: 4, color: 'var(--text-3)', wordBreak: 'break-all' }}>{testResult[d.id].body}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
