import { useState } from 'react';

const OUTCOMES = [
  { value: 'interested',     label: '✓  Interessado',   color: 'green' },
  { value: 'not_interested', label: '✕  Sem interesse', color: 'red'   },
  { value: 'callback',       label: '↩  Callback',      color: 'amber' },
  { value: 'no_answer',      label: '—  Não atendeu',   color: 'gray'  },
  { value: 'voicemail',      label: '✉  Caixa postal',  color: 'gray'  },
];

const BASE_CLS = {
  green: 'btn-ghost',
  red:   'btn-ghost',
  amber: 'btn-ghost',
  gray:  'btn-ghost',
};

const SELECTED_CLS = {
  green: 'selected-green',
  red:   'selected-red',
  amber: 'selected-amber',
  gray:  'selected-gray',
};

export default function OutcomeForm({ callId, contactId, onSaved }) {
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch('/api/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, contact_id: contactId, result: selected, notes, next_action: nextAction }),
      });
      setSelected(null); setNotes(''); setNextAction('');
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="outcome-section-label">Resultado</div>

      {/* Interested — full width */}
      {(() => {
        const o = OUTCOMES[0];
        const sel = selected === o.value;
        return (
          <button
            className={`outcome-btn ${sel ? `outcome-btn ${SELECTED_CLS[o.color]}` : BASE_CLS[o.color]}`}
            style={{ width: '100%' }}
            onClick={() => setSelected(o.value)}
          >
            {o.label}
          </button>
        );
      })()}

      <div className="outcome-grid-2">
        {OUTCOMES.slice(1).map((o) => {
          const sel = selected === o.value;
          return (
            <button
              key={o.value}
              className={`outcome-btn ${sel ? `outcome-btn ${SELECTED_CLS[o.color]}` : BASE_CLS[o.color]}`}
              onClick={() => setSelected(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="divider" />

      <textarea
        rows={2}
        placeholder="Notas…"
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
