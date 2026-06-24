import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Nav from '../components/Nav';

const COLUMNS = [
  { key: 'pending',        label: 'Pendente',      color: '#555555',  bg: 'rgba(85,85,85,0.08)'       },
  { key: 'no_answer',      label: 'Não atendeu',   color: '#f59e0b',  bg: 'rgba(245,158,11,0.07)'     },
  { key: 'callback',       label: 'Callback',      color: '#3b82f6',  bg: 'rgba(59,130,246,0.07)'     },
  { key: 'interested',     label: 'Interessado',   color: '#00C853',  bg: 'rgba(0,200,83,0.07)'       },
  { key: 'not_interested', label: 'Sem interesse', color: '#e53e3e',  bg: 'rgba(229,62,62,0.07)'      },
  { key: 'called',         label: 'Ligado',        color: '#a78bfa',  bg: 'rgba(167,139,250,0.07)'    },
];

const COL_MAP = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));

function fmt(dt) {
  const d = new Date(dt);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function ContactCard({ contact, col, onDragStart, onStatusChange, onCall }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, contact.id)}
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 14px',
        cursor: 'grab',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Name + call button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', lineHeight: 1.3 }}>{contact.name}</div>
        <button
          onClick={() => onCall(contact)}
          style={{
            background: 'var(--bg-3)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            color: 'var(--text-3)',
            fontSize: 11,
            padding: '3px 8px',
            cursor: 'pointer',
            flexShrink: 0,
            fontFamily: 'inherit',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--green)'; e.currentTarget.style.color = '#000'; e.currentTarget.style.borderColor = 'var(--green)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          📞 Ligar
        </button>
      </div>

      {/* Company */}
      {contact.company && (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.company}
        </div>
      )}

      {/* Phone */}
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>
        {contact.phone}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {COLUMNS.filter((c) => c.key !== contact.status).slice(0, 3).map((c) => (
            <button
              key={c.key}
              onClick={() => onStatusChange(contact.id, c.key)}
              title={`Mover para ${c.label}`}
              style={{
                background: c.bg,
                border: `1px solid ${c.color}22`,
                borderRadius: 4,
                color: c.color,
                fontSize: 10,
                padding: '2px 6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 500,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{fmt(contact.created_at)}</span>
      </div>
    </div>
  );
}

export default function Kanban() {
  const router = useRouter();
  const [grouped, setGrouped] = useState(() => Object.fromEntries(COLUMNS.map((c) => [c.key, []])));
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const dragId = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  async function load() {
    setLoading(true);
    const res  = await fetch('/api/contacts');
    const data = await res.json();
    const contacts = data.contacts || [];

    const g = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    for (const c of contacts) {
      if (g[c.status]) g[c.status].push(c);
      else g['pending'].push(c);
    }
    setGrouped(g);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleStatusChange(id, newStatus) {
    // Optimistic update
    setGrouped((prev) => {
      const next = { ...prev };
      let contact;
      for (const key of Object.keys(next)) {
        const idx = next[key].findIndex((c) => c.id === id);
        if (idx !== -1) { contact = { ...next[key][idx], status: newStatus }; next[key] = next[key].filter((c) => c.id !== id); break; }
      }
      if (contact) next[newStatus] = [contact, ...next[newStatus]];
      return next;
    });
    await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  function handleDragStart(e, id) {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(e, colKey) {
    e.preventDefault();
    setDragOver(null);
    if (dragId.current) handleStatusChange(dragId.current, colKey);
    dragId.current = null;
  }

  function handleCall(contact) {
    router.push(`/agent?contact=${contact.id}`);
  }

  const q = search.toLowerCase();
  function filterCards(cards) {
    if (!q) return cards;
    return cards.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  }

  const totalContacts = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);

  return (
    <>
      <Head><title>Kanban — Discador Pro</title></Head>
      <Nav />

      <div style={{ padding: '24px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, maxWidth: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="page-title">Kanban</h1>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{totalContacts} contatos</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Filtrar cards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220, padding: '7px 12px', fontSize: 13 }}
            />
            <button className="btn-secondary" onClick={load} style={{ padding: '7px 12px', fontSize: 12 }}>↺ Atualizar</button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div style={{
        display: 'flex',
        gap: 12,
        padding: '0 24px 32px',
        overflowX: 'auto',
        alignItems: 'flex-start',
        minHeight: 'calc(100vh - 140px)',
      }}>
        {loading ? (
          <p style={{ color: 'var(--text-3)', padding: '40px 0' }}>Carregando…</p>
        ) : COLUMNS.map((col) => {
          const cards = filterCards(grouped[col.key] || []);
          const isDragTarget = dragOver === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, col.key)}
              style={{
                width: 260,
                flexShrink: 0,
                background: isDragTarget ? col.bg : 'var(--bg-1)',
                border: `1px solid ${isDragTarget ? col.color + '55' : 'var(--border)'}`,
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 160px)',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              {/* Column header */}
              <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{col.label}</span>
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: cards.length > 0 ? col.color : 'var(--text-3)',
                  background: cards.length > 0 ? col.bg : 'transparent',
                  padding: '1px 7px',
                  borderRadius: 20,
                  minWidth: 24,
                  textAlign: 'center',
                }}>
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{
                padding: '10px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                overflowY: 'auto',
                flex: 1,
              }}>
                {cards.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '32px 12px',
                    color: 'var(--text-3)',
                    fontSize: 12,
                    border: `1px dashed ${isDragTarget ? col.color + '44' : 'var(--border)'}`,
                    borderRadius: 8,
                    transition: 'border-color 0.15s',
                  }}>
                    {isDragTarget ? 'Soltar aqui' : 'Vazio'}
                  </div>
                ) : cards.map((c) => (
                  <ContactCard
                    key={c.id}
                    contact={c}
                    col={col}
                    onDragStart={handleDragStart}
                    onStatusChange={handleStatusChange}
                    onCall={handleCall}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
