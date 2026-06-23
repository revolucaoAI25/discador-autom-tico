import { useState } from 'react';

const OUTCOMES = [
  { value: 'interested',     label: '✓  Interessado',   cls: 'btn-success',  span: 2 },
  { value: 'not_interested', label: '✕  Sem interesse', cls: 'btn-danger' },
  { value: 'callback',       label: '↩  Callback',      cls: 'btn-warning' },
  { value: 'no_answer',      label: '—  Não atendeu',   cls: 'btn-ghost' },
  { value: 'voicemail',      label: '✉  Caixa postal',  cls: 'btn-ghost' },
];

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
      setSelected(null);
      setNotes('');
      setNextAction('');
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
        Resultado da chamada
      </p>

      {/* Interested gets full width */}
      <button
        className={`outcome-btn ${selected === 'interested' ? 'btn-success' : 'btn-ghost'}`}
        onClick={() => setSelected('interested')}
        style={{ width: '100%' }}
      >
        ✓&nbsp; Interessado
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {OUTCOMES.filter((o) => o.value !== 'interested').map((o) => (
          <button
            key={o.value}
            className={`outcome-btn ${selected === o.value ? 'btn-primary' : o.cls}`}
            onClick={() => setSelected(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="divider" />

      <textarea
        rows={2}
        placeholder="Notas da chamada…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ resize: 'none' }}
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
        style={{ width: '100%', marginTop: 4 }}
      >
        {saving ? 'Salvando…' : 'Salvar e próxima →'}
      </button>
    </div>
  );
}
