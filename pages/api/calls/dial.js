import { supabase } from '../../../lib/supabase';
import { getClient } from '../../../lib/twilio';

const MAX_PER_DAY    = 4;
const MAX_PER_HOUR   = 2;
const MAX_DAYS       = 5;  // distinct days with no answer → hibernate
const HIBERNATE_DAYS = 15;

async function wakeUpHibernating() {
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from('contacts')
    .update({ status: 'pending', hibernating_until: null, distinct_days: 0, attempts_today: 0 })
    .lte('hibernating_until', today)
    .not('hibernating_until', 'is', null);
}

async function resetDailyCounters() {
  const today = new Date().toISOString().slice(0, 10);
  // Reset attempts_today for contacts whose last_call_date is before today
  await supabase
    .from('contacts')
    .update({ attempts_today: 0, last_call_date: today })
    .lt('last_call_date', today)
    .not('last_call_date', 'is', null);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { contact_id } = req.body || {};

  // Maintenance: wake hibernating + reset daily counters
  await wakeUpHibernating();
  await resetDailyCounters();

  let contact;

  if (contact_id) {
    const { data } = await supabase
      .from('contacts').select('*').eq('id', contact_id).single();
    contact = data;
  } else {
    // Find next eligible contact in queue
    const { data: candidates } = await supabase
      .from('contacts')
      .select('*')
      .in('status', ['pending', 'no_answer'])
      .is('hibernating_until', null)
      .lt('attempts_today', MAX_PER_DAY)
      .order('last_call_at', { ascending: true, nullsFirst: true })
      .limit(1000);

    if (candidates?.length) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      for (const c of candidates) {
        const { count } = await supabase
          .from('calls')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', c.id)
          .gte('started_at', hourAgo);
        if ((count || 0) < MAX_PER_HOUR) { contact = c; break; }
      }
    }
  }

  if (!contact) {
    return res.status(404).json({
      error: 'Nenhum contato disponível. Todos estão em cooldown ou a fila está vazia.',
    });
  }

  try {
    const client  = getClient();
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
      .select().single();

    const today = new Date().toISOString().slice(0, 10);
    await supabase.from('contacts').update({
      last_call_at:   new Date().toISOString(),
      last_call_date: today,
      attempts_today: (contact.attempts_today || 0) + 1,
    }).eq('id', contact.id);

    res.json({ call_id: callRow.id, twilio_sid: call.sid, contact });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
