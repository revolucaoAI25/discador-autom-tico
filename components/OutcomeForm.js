import { useState } from 'react';

const OUTCOMES = [
  { value: 'scheduled',      label: '📅  Reunião agendada', color: 'green',  full: true },
  { value: 'interested',     label: '✓   Interessado',      color: 'green' },
  { value: 'callback',       label: '↩   Callback',         color: 'amber' },
  { value: 'not_interested', label: '✕   Sem interesse',    color: 'red'   },
  { value: 'no_answer',      label: '—   Não atendeu',      color: 'gray'  },
  { value: 'voicemail',      label: '✉   Caixa postal',     color: 'gray'  },
];

const BASE   = { green: 'btn-ghost', amber: 'btn-ghost', red: 'btn-ghost', gray: 'btn-ghost' };
const SELECT = { green: 'selected-green', amber: 'selected-amber', red: 'selected-red', gray: 'selected-gray' };

function DateTimeInput({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 13 }}
      />
    </div>
  );
}

export default function OutcomeForm({ callId, contactId, onSaved }) {
  const [selected,   setSelected]   = useState(null);
  const [notes,      setNotes]      = useState('');
  const [nextAction, setNextAction] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [scheduledAt,setScheduledAt]= useState('');
  const [saving,     setSaving]     = useState(false);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch('/api/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId, contact_id: contactId,
          result: selected, notes, next_action: nextAction,
          callback_at:  selected === 'callback'  ? callbackAt  : undefined,
          scheduled_at: selected === 'scheduled' ? scheduledAt : undefined,
        }),
      });
      setSelected(null); setNotes(''); setNextAction(''); setCallbackAt(''); setScheduledAt('');
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="outcome-section-label">Resultado</div>

      {/* Full-width: Scheduled */}
      {(() => {
        const o = OUTCOMES[0];
        const sel = selected === o.value;
        return (
          <button
            className={`outcome-btn ${sel ? SELECT[o.color] : BASE[o.color]}`}
            style={{ width: '100%' }}
            onClick={() => setSelected(o.value)}
          >
            {o.label}
          </button>
        );
      })()}

      {/* 2-column grid for the rest */}
      <div className="outcome-grid-2">
        {OUTCOMES.slice(1).map((o) => {
          const sel = selected === o.value;
          return (
            <button
              key={o.value}
              className={`outcome-btn ${sel ? SELECT[o.color] : BASE[o.color]}`}
              onClick={() => setSelected(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Conditional date pickers */}
      {selected === 'scheduled' && (
        <DateTimeInput label="Data e hora da reunião" value={scheduledAt} onChange={setScheduledAt} />
      )}
      {selected === 'callback' && (
        <DateTimeInput label="Ligar de volta em" value={callbackAt} onChange={setCallbackAt} />
      )}

      <div className="divider" />

      <textarea
        rows={2}
        placeholder="Notas da chamada…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ resize: 'none', fontSize: 13 }}
      />
      <input
        placeholder="Próxima ação (opcional)"
        value={nextAction}
        onChange={(e) => setNextAction(e.target.value)}
      />

      <button
        className="btn-primary btn-lg"
        disabled={!selected || saving}
        onClick={handleSave}
        style={{ width: '100%', marginTop: 2 }}
      >
        {saving ? 'Salvando…' : 'Salvar e próxima →'}
      </button>
    </div>
  );
}
