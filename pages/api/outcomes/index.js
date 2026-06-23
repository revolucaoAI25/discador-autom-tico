import { getDb } from '../../../lib/db';

const STATUS_MAP = {
  no_answer: 'no_answer',
  callback: 'called',
  interested: 'interested',
  not_interested: 'not_interested',
  voicemail: 'no_answer',
};

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { call_id, contact_id, result, notes, next_action } = req.body;

  if (!call_id || !result) {
    return res.status(400).json({ error: 'call_id and result required' });
  }

  const db = getDb();
  const outcome = db.prepare(
    'INSERT INTO outcomes (call_id, result, notes, next_action) VALUES (?, ?, ?, ?)'
  ).run(call_id, result, notes || '', next_action || '');

  const contactStatus = STATUS_MAP[result] || 'called';
  if (contact_id) {
    db.prepare('UPDATE contacts SET status = ? WHERE id = ?').run(contactStatus, contact_id);
  }

  res.json({ id: outcome.lastInsertRowid });
}
