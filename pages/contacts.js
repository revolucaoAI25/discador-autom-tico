import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Nav from '../components/Nav';

const STATUS_LABELS = {
  pending:        'Pendente',
  called:         'Ligado',
  interested:     'Interessado',
  not_interested: 'Sem interesse',
  no_answer:      'Não atendeu',
};

export default function Contacts() {
  const [contacts, setContacts]   = useState([]);
  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const fileRef = useRef();

  function load() {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (search) params.set('search', search);
    fetch(`/api/contacts?${params}`).then((r) => r.json()).then((d) => setContacts(d.contacts || []));
  }

  useEffect(() => { load(); }, [filter, search]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const fd = new FormData();
    fd.append('file', file);
    const res  = await fetch('/api/contacts', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    setUploadMsg(data.error
      ? { ok: false, text: data.error }
      : { ok: true,  text: `${data.inserted} contato${data.inserted !== 1 ? 's' : ''} importado${data.inserted !== 1 ? 's' : ''}` }
    );
    fileRef.current.value = '';
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Deletar este contato?')) return;
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    load();
  }

  const filters = ['all', ...Object.keys(STATUS_LABELS)];

  return (
    <>
      <Head><title>Contatos — Discador Pro</title></Head>
      <Nav />
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Contatos</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {uploadMsg && (
              <span style={{ fontSize: 12, color: uploadMsg.ok ? 'var(--green)' : 'var(--red)' }}>
                {uploadMsg.ok ? '✓' : '✕'} {uploadMsg.text}
              </span>
            )}
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleUpload} />
            <button className="btn-primary" onClick={() => fileRef.current.click()} disabled={uploading}>
              {uploading ? 'Importando…' : '+ Importar CSV'}
            </button>
          </div>
        </div>

        {/* Filters row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ maxWidth: 260 }}
            placeholder="Buscar nome, telefone, empresa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {filters.map((f) => (
              <button
                key={f}
                className={`btn-ghost${filter === f ? ' active' : ''}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Todos' : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Nome</th>
                <th>Empresa</th>
                <th>Telefone</th>
                <th>Status</th>
                <th>Criado</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    {search || filter !== 'all'
                      ? 'Nenhum contato com esses filtros.'
                      : 'Importe um CSV para começar.'}
                  </td>
                </tr>
              ) : contacts.map((c, i) => (
                <tr key={c.id}>
                  <td style={{ color: 'var(--text-3)', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ color: 'var(--text-2)' }}>{c.company || '—'}</td>
                  <td style={{ color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{c.phone}</td>
                  <td>
                    <span className={`badge badge-${c.status}`}>
                      <span className="badge-dot" />
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <button className="btn-danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => handleDelete(c.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="upload-hint" style={{ marginTop: 10 }}>
          Colunas aceitas: <code>Nome</code>, <code>Telefone</code>, <code>Telefone 2</code>, <code>Nicho</code>, <code>Município</code>, <code>UF</code> — ou <code>name</code>, <code>phone</code>, <code>company</code>
        </div>
      </div>
    </>
  );
}
