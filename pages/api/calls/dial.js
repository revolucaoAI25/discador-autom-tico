import { supabase } from '../../../lib/supabase';
import { getClient } from '../../../lib/twilio';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { contact_id } = req.body || {};

  let contact;
  if (contact_id) {
    const { data } = await supabase.from('contacts').select('*').eq('id', contact_id).single();
    contact = data;
  } else {
    const { data } = await supabase.from('contacts').select('*').eq('status', 'pending').limit(1).single();
    contact = data;
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
      machineDetection: 'Enable',
      asyncAmdStatusCallback: `${baseUrl}/api/calls/amd`,
      asyncAmdStatusCallbackMethod: 'POST',
    });

    const { data: callRow } = await supabase
      .from('calls')
      .insert({ contact_id: contact.id, twilio_sid: call.sid })
      .select()
      .single();

    await supabase.from('contacts').update({ status: 'called' }).eq('id', contact.id);

    res.json({ call_id: callRow.id, twilio_sid: call.sid, contact });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
