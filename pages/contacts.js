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

function AddContactModal({ onClose, onAdded }) {
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [company, setCompany] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res  = await fetch('/api/contacts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, company }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 380, maxWidth: '90vw' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Adicionar contato</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            placeholder="Nome *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <input
            placeholder="Telefone * (ex: 31999219594)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <input
            placeholder="Empresa (opcional)"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          {error && <p style={{ color: 'var(--red)', fontSize: 12, margin: 0 }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: 4 }}>
            {saving ? 'Salvando…' : '+ Adicionar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [contacts, setContacts]   = useState([]);
  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selected, setSelected]   = useState(() => new Set());
  const fileRef = useRef();

  function load() {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (search) params.set('search', search);
    fetch(`/api/contacts?${params}`).then((r) => r.json()).then((d) => setContacts(d.contacts || []));
  }

  useEffect(() => { load(); }, [filter, search]);
  useEffect(() => { setSelected(new Set()); }, [filter, search]);

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id))
    );
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Deletar ${selected.size} contato${selected.size !== 1 ? 's' : ''} selecionado${selected.size !== 1 ? 's' : ''}?`)) return;
    await fetch('/api/contacts/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    });
    setSelected(new Set());
    load();
  }

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
            {selected.size > 0 && (
              <button className="btn-danger" onClick={handleBulkDelete}>
                Excluir {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
              </button>
            )}
            <button className="btn-secondary" onClick={() => setShowAddModal(true)}>
              + Adicionar contato
            </button>
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
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={contacts.length > 0 && selected.size === contacts.length}
                    onChange={toggleAll}
                  />
                </th>
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
                  <td colSpan={8} className="empty-state">
                    {search || filter !== 'all'
                      ? 'Nenhum contato com esses filtros.'
                      : 'Importe um CSV ou adicione um contato manualmente para começar.'}
                  </td>
                </tr>
              ) : contacts.map((c, i) => (
                <tr key={c.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                    />
                  </td>
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

      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onAdded={load}
        />
      )}
    </>
  );
}
