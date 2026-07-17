import { supabase } from '../../../lib/supabase';
import { getClient } from '../../../lib/twilio';

const MACHINE_TYPES  = ['machine_start','machine_end_beep','machine_end_silence','machine_end_other','fax'];
const MAX_DAYS       = 5;
const HIBERNATE_DAYS = 15;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { CallSid, AnsweredBy } = req.body;
  res.status(204).end();

  if (!CallSid || !MACHINE_TYPES.includes(AnsweredBy)) return;

  const { data: call } = await supabase
    .from('calls').select('id, contact_id').eq('twilio_sid', CallSid).single();
  if (!call) return;

  const { data: existing } = await supabase
    .from('outcomes').select('id').eq('call_id', call.id).single();
  if (existing) return;

  const { data: contact } = await supabase
    .from('contacts').select('*').eq('id', call.contact_id).single();
  if (!contact) return;

  await supabase.from('outcomes').insert({
    call_id: call.id,
    result: 'voicemail',
    notes: `Auto-detectado: ${AnsweredBy}`,
  });

  // Uses last_no_answer_date (not last_call_date) — dial.js already sets
  // last_call_date to today at claim time, before the outcome is known, so
  // comparing against it here would always match and never increment.
  const today         = new Date().toISOString().slice(0, 10);
  const newDistinct   = (contact.distinct_days || 0) + (contact.last_no_answer_date !== today ? 1 : 0);
  const shouldHibernate = newDistinct >= MAX_DAYS;
  const hibernateUntil  = shouldHibernate
    ? new Date(Date.now() + HIBERNATE_DAYS * 86400000).toISOString().slice(0, 10)
    : null;

  // Only schedule an immediate retry once per day per contact — if it already
  // used its retry today, this no-answer just goes back into the normal queue.
  const alreadyRetriedToday = contact.retry_used_date === today;

  await supabase.from('contacts').update({
    status: 'no_answer',
    distinct_days: newDistinct,
    last_no_answer_date: today,
    hibernating_until: hibernateUntil,
    immediate_retry_pending: !alreadyRetriedToday && !shouldHibernate,
  }).eq('id', call.contact_id);

  try {
    await getClient().calls(CallSid).update({ status: 'completed' });
  } catch (_) {}
}
