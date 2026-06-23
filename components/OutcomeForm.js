import { useState } from 'react';

const OUTCOMES = [
  { value: 'no_answer',      label: 'Não atendeu',    cls: 'btn-ghost' },
  { value: 'not_interested', label: 'Sem interesse',  cls: 'btn-danger' },
  { value: 'voicemail',      label: 'Caixa postal',   cls: 'btn-ghost' },
  { value: 'callback',       label: 'Ligar depois',   cls: 'btn-ghost' },
  { value: 'interested',     label: 'Interessado ✓',  cls: 'btn-success' },
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
        body: JSON.stringify({
          call_id: callId,
          contact_id: contactId,
          result: selected,
          notes,
          next_action: nextAction,
        }),
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            className={selected === o.value ? 'btn-primary' : o.cls}
            style={{ flex: 1, minWidth: 120 }}
            onClick={() => setSelected(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        placeholder="Notas da chamada…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <input
        placeholder="Próxima ação (opcional)"
        value={nextAction}
        onChange={(e) => setNextAction(e.target.value)}
      />
      <button
        className="btn-primary"
        disabled={!selected || saving}
        onClick={handleSave}
        style={{ padding: '12px 16px', fontSize: 15 }}
      >
        {saving ? 'Salvando…' : 'Salvar e próxima →'}
      </button>
    </div>
  );
}
