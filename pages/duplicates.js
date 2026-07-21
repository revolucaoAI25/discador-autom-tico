import { useEffect, useState } from 'react';
import Head from 'next/head';
import Nav from '../components/Nav';

const STATUS_LABELS = {
  pending: 'Pendente', no_answer: 'Não atendeu', answered: 'Atendeu',
  callback: 'Retornar', interested: 'Interessado', not_interested: 'Sem interesse', scheduled: 'Agendado',
};

export default function Duplicates() {
  const [by, setBy]           = useState('phone');
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg]         = useState(null);

  function load() {
    setLoading(true);
    fetch(`/api/contacts/duplicates?by=${by}`)
      .then((r) => r.json())
      .then((d) => { setGroups(d.groups || []); setSelected(new Set()); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [by]);

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleGroup(group) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = group.contacts.every((c) => next.has(c.id));
      group.contacts.forEach((c) => { allSelected ? next.delete(c.id) : next.add(c.id); });
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} contato${selected.size !== 1 ? 's' : ''} selecionado${selected.size !== 1 ? 's' : ''}?`)) return;
    setDeleting(true);
    try {
      const r = await fetch('/api/contacts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      });
      const d = await r.json();
      setMsg(d.error ? { ok: false, text: d.error } : { ok: true, text: `${selected.size} contato(s) excluído(s)` });
      load();
    } finally {
      setDeleting(false);
    }
  }

  const totalContacts = groups.reduce((s, g) => s + g.contacts.length, 0);

  return (
    <>
      <Head><title>Duplicados — Discador Pro</title></Head>
      <Nav />
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Contatos duplicados</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {msg && (
              <span style={{ fontSize: 12, color: msg.ok ? 'var(--green)' : 'var(--red)' }}>
                {msg.ok ? '✓' : '✕'} {msg.text}
              </span>
            )}
            {selected.size > 0 && (
              <button className="btn-danger" onClick={handleBulkDelete} disabled={deleting}>
                {deleting ? 'Excluindo…' : `Excluir ${selected.size} selecionado${selected.size !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className={`btn-ghost${by === 'phone' ? ' active' : ''}`} style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setBy('phone')}>
            Mesmo telefone
          </button>
          <button className={`btn-ghost${by === 'name' ? ' active' : ''}`} style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setBy('name')}>
            Mesmo nome
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Carregando…</p>
        ) : groups.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
            Nenhum contato duplicado encontrado {by === 'phone' ? 'por telefone' : 'por nome'}.
          </p>
        ) : (
          <>
            <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 12 }}>
              {groups.length} grupo{groups.length !== 1 ? 's' : ''} — {totalContacts} contatos no total
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {groups.map((g) => (
                <div key={g.key} className="card" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>
                      {by === 'phone' ? g.key : `"${g.contacts[0]?.name}"`} — {g.contacts.length} contatos
                    </div>
                    <button className="btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => toggleGroup(g)}>
                      Selecionar grupo
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 32 }}></th>
                          <th>Nome</th>
                          <th>Empresa</th>
                          <th>Telefone</th>
                          <th>Status</th>
                          <th>Criado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.contacts.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} />
                            </td>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
