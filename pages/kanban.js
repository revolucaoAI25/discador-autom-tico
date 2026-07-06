import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Nav from '../components/Nav';
import WhatsAppButton from '../components/WhatsAppButton';

const COLUMNS = [
  { key: 'pending',        label: 'Pendente',        color: '#555',    bg: 'rgba(85,85,85,0.07)'      },
  { key: 'no_answer',      label: 'Não atendeu',     color: '#f59e0b', bg: 'rgba(245,158,11,0.07)'    },
  { key: 'callback',       label: 'Callback',        color: '#3b82f6', bg: 'rgba(59,130,246,0.07)'    },
  { key: 'answered',       label: 'Atendeu',         color: '#a78bfa', bg: 'rgba(167,139,250,0.07)'   },
  { key: 'interested',     label: 'Interessado',     color: '#00C853', bg: 'rgba(0,200,83,0.07)'      },
  { key: 'scheduled',      label: 'Agendado',        color: '#34d399', bg: 'rgba(52,211,153,0.07)'    },
  { key: 'not_interested', label: 'Sem interesse',   color: '#e53e3e', bg: 'rgba(229,62,62,0.07)'     },
];

const COL = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
const PAGE_SIZE = 40; // cards rendered per column before scrolling loads more

function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtDatetime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── Lead Detail Modal ────────────────────────────────────────────────────────

function LeadModal({ contact, onClose, onUpdate }) {
  const [notes, setNotes] = useState(contact.notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function saveNotes() {
    setSaving(true);
    await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdate({ ...contact, notes });
  }

  const col = COL[contact.status] || COL['pending'];

  const fields = [
    { label: 'Telefone',  value: contact.phone },
    { label: 'E-mail',    value: contact.email },
    { label: 'Empresa',   value: contact.company },
    { label: 'CNPJ',      value: contact.cnpj },
    { label: 'Cidade',    value: [contact.city, contact.state].filter(Boolean).join(' / ') },
    { label: 'Endereço',  value: contact.address },
    { label: 'Site',      value: contact.website, link: true },
    { label: 'Callback',  value: contact.callback_at  ? fmtDatetime(contact.callback_at)  : null },
    { label: 'Reunião',   value: contact.scheduled_at ? fmtDatetime(contact.scheduled_at) : null },
    { label: '🔗 Vinculado', value: contact.group_id ? 'Sim — mesmo lead, outro número acompanha o status' : null },
    { label: 'Tentativas hoje', value: contact.attempts_today ?? 0 },
    { label: 'Dias distintos', value: contact.distinct_days ?? 0 },
    { label: 'Hiberna até',    value: contact.hibernating_until ? fmtDate(contact.hibernating_until) : null },
    { label: 'Importado em',   value: fmtDate(contact.created_at) },
  ].filter((f) => f.value !== null && f.value !== '' && f.value !== undefined);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 200, display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380, height: '100%', background: 'var(--bg-1)',
          borderLeft: '1px solid var(--border)', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span className={`badge badge-${contact.status}`}>
              <span className="badge-dot" style={{ background: col.color }} />
              {col.label}
            </span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
            >×</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.3px' }}>{contact.name}</div>
              {contact.company && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>{contact.company}</div>}
            </div>
            <WhatsAppButton contactId={contact.id} size="lg" />
          </div>
        </div>

        {/* Info fields */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fields.map((f) => (
              <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 500, flexShrink: 0 }}>{f.label}</span>
                {f.link && f.value ? (
                  <a href={f.value.startsWith('http') ? f.value : `https://${f.value}`}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: 'var(--blue)', textAlign: 'right', wordBreak: 'break-all' }}>
                    {f.value}
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'right', wordBreak: 'break-word' }}>{f.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            Anotações
          </div>
          <textarea
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informações sobre o lead, o que discutir na reunião…"
            style={{ resize: 'vertical', fontSize: 13, marginBottom: 8 }}
          />
          <button
            className="btn-secondary"
            onClick={saveNotes}
            disabled={saving}
            style={{ width: '100%', fontSize: 12 }}
          >
            {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar anotações'}
          </button>
        </div>

        {/* Hibernation warning */}
        {contact.hibernating_until && (
          <div style={{ margin: '0 20px 20px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--amber)' }}>
            ⏸ Hibernando até {fmtDate(contact.hibernating_until)} — {contact.distinct_days} dias sem resposta
          </div>
        )}
      </div>
    </div>
  );
}

// ── Contact Card ─────────────────────────────────────────────────────────────

function Card({ contact, onDragStart, onStatusChange, onCall, onClick }) {
  const col = COL[contact.status] || COL['pending'];
  const isHibernating = !!contact.hibernating_until;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, contact.id)}
      onClick={onClick}
      style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '11px 12px', cursor: 'pointer',
        transition: 'border-color 0.12s, box-shadow 0.12s', userSelect: 'none',
        opacity: isHibernating ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Name row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', lineHeight: 1.3 }}>{contact.name}</div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <WhatsAppButton contactId={contact.id} size="sm" />
          <button
            onClick={(e) => { e.stopPropagation(); onCall(contact); }}
            style={{
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 5,
              color: 'var(--text-3)', fontSize: 11, padding: '2px 7px', cursor: 'pointer',
              fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--green)'; e.currentTarget.style.color = '#000'; e.currentTarget.style.borderColor = 'var(--green)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            📞
          </button>
        </div>
      </div>

      {contact.company && (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.company}</div>
      )}

      <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>{contact.phone}</div>

      {/* Badges row */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {contact.scheduled_at && (
          <span style={{ fontSize: 10, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
            📅 {fmtDatetime(contact.scheduled_at)}
          </span>
        )}
        {contact.callback_at && (
          <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
            ↩ {fmtDatetime(contact.callback_at)}
          </span>
        )}
        {isHibernating && (
          <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
            ⏸ hiberna {fmtDate(contact.hibernating_until)}
          </span>
        )}
        {(contact.distinct_days > 0) && !isHibernating && (
          <span style={{ fontSize: 10, background: 'var(--bg-3)', color: 'var(--text-3)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 4 }}>
            {contact.distinct_days}/5 dias
          </span>
        )}
      </div>

      {/* Quick status buttons */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {COLUMNS.filter((c) => c.key !== contact.status).slice(0, 3).map((c) => (
          <button
            key={c.key}
            onClick={(e) => { e.stopPropagation(); onStatusChange(contact.id, c.key); }}
            title={`→ ${c.label}`}
            style={{
              background: c.bg, border: `1px solid ${c.color}22`,
              borderRadius: 4, color: c.color, fontSize: 10,
              padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Kanban() {
  const router = useRouter();
  const [grouped, setGrouped]       = useState(() => Object.fromEntries(COLUMNS.map((c) => [c.key, []])));
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null); // lead detail modal
  const [visibleCounts, setVisibleCounts] = useState(() => Object.fromEntries(COLUMNS.map((c) => [c.key, PAGE_SIZE])));
  const dragId   = useRef(null);
  const [dragOver, setDragOver]     = useState(null);

  function resetVisibleCounts() {
    setVisibleCounts(Object.fromEntries(COLUMNS.map((c) => [c.key, PAGE_SIZE])));
  }

  function handleColumnScroll(e, key) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      setVisibleCounts((prev) => ({ ...prev, [key]: prev[key] + PAGE_SIZE }));
    }
  }

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
    resetVisibleCounts();
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { resetVisibleCounts(); }, [search]);

  async function handleStatusChange(id, newStatus) {
    setGrouped((prev) => {
      const next = { ...prev };
      let card;
      for (const key of Object.keys(next)) {
        const idx = next[key].findIndex((c) => c.id === id);
        if (idx !== -1) { card = { ...next[key][idx], status: newStatus }; next[key] = next[key].filter((c) => c.id !== id); break; }
      }
      if (card) next[newStatus] = [card, ...(next[newStatus] || [])];
      return next;
    });
    await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  function handleUpdate(updated) {
    setGrouped((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].map((c) => c.id === updated.id ? updated : c);
      }
      return next;
    });
    setSelected(updated);
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

  const total = Object.values(grouped).reduce((s, a) => s + a.length, 0);

  return (
    <>
      <Head><title>Kanban — Discador Pro</title></Head>
      <Nav />

      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="page-title">Kanban</h1>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{total} contatos</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Filtrar…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200, padding: '7px 12px', fontSize: 13 }} />
          <button className="btn-secondary" onClick={load} style={{ padding: '7px 12px', fontSize: 12 }}>↺</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '16px 24px 32px', overflowX: 'auto', alignItems: 'flex-start', minHeight: 'calc(100vh - 140px)' }}>
        {loading ? (
          <p style={{ color: 'var(--text-3)', paddingTop: 40 }}>Carregando…</p>
        ) : COLUMNS.map((col) => {
          const cards    = filterCards(grouped[col.key] || []);
          const isTarget = dragOver === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => { e.preventDefault(); setDragOver(null); if (dragId.current) handleStatusChange(dragId.current, col.key); dragId.current = null; }}
              style={{
                width: 250, flexShrink: 0,
                background: isTarget ? col.bg : 'var(--bg-1)',
                border: `1px solid ${isTarget ? col.color + '55' : 'var(--border)'}`,
                borderRadius: 12, display: 'flex', flexDirection: 'column',
                maxHeight: 'calc(100vh - 160px)', transition: 'all 0.15s',
              }}
            >
              {/* Column header */}
              <div style={{ padding: '11px 13px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{col.label}</span>
                </div>
                {cards.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: col.color, background: col.bg, padding: '1px 7px', borderRadius: 20 }}>
                    {cards.length}
                  </span>
                )}
              </div>

              {/* Cards */}
              <div
                onScroll={(e) => handleColumnScroll(e, col.key)}
                style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', flex: 1 }}
              >
                {cards.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 8px', color: 'var(--text-3)', fontSize: 12, border: `1px dashed ${isTarget ? col.color + '44' : 'var(--border)'}`, borderRadius: 8, transition: 'border-color 0.15s' }}>
                    {isTarget ? 'Soltar aqui' : 'Vazio'}
                  </div>
                ) : (
                  <>
                    {cards.slice(0, visibleCounts[col.key] || PAGE_SIZE).map((c) => (
                      <Card
                        key={c.id}
                        contact={c}
                        onDragStart={(e, id) => { dragId.current = id; e.dataTransfer.effectAllowed = 'move'; }}
                        onStatusChange={handleStatusChange}
                        onCall={(contact) => router.push(`/agent?contact=${contact.id}`)}
                        onClick={() => setSelected(c)}
                      />
                    ))}
                    {cards.length > (visibleCounts[col.key] || PAGE_SIZE) && (
                      <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text-3)', fontSize: 11 }}>
                        Role para carregar mais…
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <LeadModal
          contact={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}
