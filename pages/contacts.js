import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Nav from '../components/Nav';

const STATUS_LABELS = {
  pending: 'Pendente',
  called: 'Ligado',
  interested: 'Interessado',
  not_interested: 'Sem interesse',
  no_answer: 'Não atendeu',
};

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef();

  function load() {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (search) params.set('search', search);
    fetch(`/api/contacts?${params}`).then((r) => r.json()).then((d) => setContacts(d.contacts));
  }

  useEffect(() => { load(); }, [filter, search]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/contacts', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    setUploadMsg(data.error ? `Erro: ${data.error}` : `${data.inserted} contatos importados.`);
    fileRef.current.value = '';
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Deletar contato?')) return;
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <>
      <Head><title>Discador — Contatos</title></Head>
      <Nav />
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2>Contatos</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
            <button className="btn-primary" onClick={() => fileRef.current.click()} disabled={uploading}>
              {uploading ? 'Importando…' : '+ Importar CSV'}
            </button>
            {uploadMsg && <span style={{ fontSize: 13, color: uploadMsg.startsWith('Erro') ? '#fca5a5' : '#86efac' }}>{uploadMsg}</span>}
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input
            style={{ maxWidth: 280 }}
            placeholder="Buscar nome, telefone, empresa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select style={{ maxWidth: 180 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th><th>Empresa</th><th>Telefone</th><th>Status</th><th>Criado em</th><th></th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>Nenhum contato encontrado.</td></tr>
              ) : contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.company}</td>
                  <td>{c.phone}</td>
                  <td><span className={`badge badge-${c.status}`}>{STATUS_LABELS[c.status] || c.status}</span></td>
                  <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(c.id)}>
                      Deletar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>
          CSV esperado: colunas <code>name</code>, <code>phone</code>, <code>company</code> (ou <code>nome</code>, <code>telefone</code>, <code>empresa</code>)
        </p>
      </div>
    </>
  );
}
