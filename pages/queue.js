import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Nav from '../components/Nav';

function fmtDatetime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function Queue() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const dragId    = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  // Must mirror the exact ordering used by /api/calls/dial: fair round-robin —
  // whoever waited longest (or was never called) goes first; queue_order is
  // the fixed sequence used to break ties, which is what makes each round
  // follow your manual order without anyone hogging repeat attempts first.
  function sortContacts(list) {
    return [...list].sort((a, b) => {
      const aCall = a.last_call_at ? new Date(a.last_call_at).getTime() : -Infinity;
      const bCall = b.last_call_at ? new Date(b.last_call_at).getTime() : -Infinity;
      if (aCall !== bCall) return aCall - bCall;
      const aOrder = a.queue_order ?? Infinity;
      const bOrder = b.queue_order ?? Infinity;
      return aOrder - bOrder;
    });
  }

  async function load() {
    setLoading(true);
    const res  = await fetch('/api/contacts?status=pending');
    const data = await res.json();
    setContacts(sortContacts(data.contacts || []));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function persistOrder(list) {
    await fetch('/api/contacts/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: list.map((c) => c.id) }),
    });
  }

  function handleDrop(targetId) {
    if (!dragId.current || dragId.current === targetId) { setDragOver(null); return; }
    setContacts((prev) => {
      const list = [...prev];
      const fromIdx = list.findIndex((c) => c.id === dragId.current);
      const toIdx   = list.findIndex((c) => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      persistOrder(list);
      return list;
    });
    dragId.current = null;
    setDragOver(null);
  }

  async function moveToTop(id) {
    setContacts((prev) => {
      const list = [...prev];
      const idx = list.findIndex((c) => c.id === id);
      if (idx <= 0) return prev;
      const [moved] = list.splice(idx, 1);
      list.unshift(moved);
      persistOrder(list);
      return list;
    });
  }

  async function handleRemove(id) {
    if (!confirm('Remover este contato da fila (excluir contato)?')) return;
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleResetOrder() {
    if (!confirm('Voltar a fila pra ordem padrão? Isso desfaz toda a reordenação manual.')) return;
    await fetch('/api/contacts/reset-order', { method: 'POST' });
    load();
  }

  const q = search.toLowerCase();
  const filtered = q
    ? contacts.filter((c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.company?.toLowerCase().includes(q))
    : contacts;

  return (
    <>
      <Head><title>Fila — Discador Pro</title></Head>
      <Nav />
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Fila de discagem</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{contacts.length} pendentes</span>
            <input
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200, padding: '7px 12px', fontSize: 13 }}
            />
            <button className="btn-secondary" onClick={handleResetOrder} style={{ padding: '7px 12px', fontSize: 12 }}>
              Ordem padrão
            </button>
            <button className="btn-secondary" onClick={load} style={{ padding: '7px 12px', fontSize: 12 }}>↺</button>
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: -8, marginBottom: 16 }}>
          Arraste para reordenar — a ordem vale por rodada: discado nessa sequência, e ao voltar pro início repete a mesma ordem, sem ninguém repetir antes do resto ser chamado.
        </p>

        {loading ? (
          <p style={{ color: 'var(--text-3)', paddingTop: 20 }}>Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">Fila vazia.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 700 }}>
            {filtered.map((c, i) => (
              <div
                key={c.id}
                draggable
                onDragStart={() => { dragId.current = c.id; }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(c.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: dragOver === c.id ? 'var(--bg-3)' : 'var(--bg-2)',
                  border: `1px solid ${dragOver === c.id ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '10px 14px', cursor: 'grab',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
              >
                <span style={{ color: 'var(--text-3)', fontSize: 11, width: 20, flexShrink: 0 }}>⠿</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11, width: 24, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    {c.phone}{c.company ? ` · ${c.company}` : ''}
                    {c.last_call_at ? ` · última tentativa ${fmtDatetime(c.last_call_at)}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => moveToTop(c.id)}
                  disabled={i === 0}
                  className="btn-ghost"
                  style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}
                >
                  ↑ Topo
                </button>
                <button
                  onClick={() => handleRemove(c.id)}
                  className="btn-danger"
                  style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
