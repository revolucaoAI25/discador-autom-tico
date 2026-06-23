import { getDb } from '../../../lib/db';

export default function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const db = getDb();
    const { status } = req.body;
    const valid = ['pending', 'called', 'no_answer', 'interested', 'not_interested'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    db.prepare('UPDATE contacts SET status = ? WHERE id = ?').run(status, id);
    res.json({ ok: true });
    return;
  }

  if (req.method === 'DELETE') {
    const db = getDb();
    db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
    res.json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
