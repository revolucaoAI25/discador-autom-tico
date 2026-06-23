import { getDb } from '../../../lib/db';
import { getClient } from '../../../lib/twilio';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const db = getDb();
  const { contact_id } = req.body;

  // Get next pending contact if no specific ID
  let contact;
  if (contact_id) {
    contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contact_id);
  } else {
    contact = db.prepare("SELECT * FROM contacts WHERE status = 'pending' LIMIT 1").get();
  }

  if (!contact) return res.status(404).json({ error: 'No pending contacts' });

  try {
    const client = getClient();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.host}`;

    const call = await client.calls.create({
      to: contact.phone,
      from: process.env.TWILIO_FROM_NUMBER,
      url: `${baseUrl}/api/calls/webhook`,
      statusCallback: `${baseUrl}/api/calls/webhook`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

    const result = db.prepare(
      'INSERT INTO calls (contact_id, twilio_sid) VALUES (?, ?)'
    ).run(contact.id, call.sid);

    db.prepare("UPDATE contacts SET status = 'called' WHERE id = ?").run(contact.id);

    res.json({ call_id: result.lastInsertRowid, twilio_sid: call.sid, contact });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
