import { getDb } from '../../lib/db';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const db = getDb();

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'called' THEN 1 ELSE 0 END) as called,
      SUM(CASE WHEN status = 'interested' THEN 1 ELSE 0 END) as interested,
      SUM(CASE WHEN status = 'not_interested' THEN 1 ELSE 0 END) as not_interested,
      SUM(CASE WHEN status = 'no_answer' THEN 1 ELSE 0 END) as no_answer
    FROM contacts
  `).get();

  const callStats = db.prepare(`
    SELECT
      COUNT(*) as total_calls,
      SUM(duration) as total_duration,
      AVG(duration) as avg_duration
    FROM calls WHERE duration IS NOT NULL
  `).get();

  const recentOutcomes = db.prepare(`
    SELECT o.*, c.name, c.company, ca.twilio_sid
    FROM outcomes o
    JOIN calls ca ON o.call_id = ca.id
    JOIN contacts c ON ca.contact_id = c.id
    ORDER BY o.created_at DESC
    LIMIT 10
  `).all();

  res.json({ contacts: totals, calls: callStats, recentOutcomes });
}
