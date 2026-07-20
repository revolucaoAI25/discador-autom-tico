import { supabase } from '../../../lib/supabase';
import { propagateLinkedStatus } from '../../../lib/linkedContacts';

const STATUS_MAP = {
  no_answer:      'no_answer',
  voicemail:      'no_answer',
  callback:       'callback',
  answered:       'answered',
  interested:     'interested',
  not_interested: 'not_interested',
  scheduled:      'scheduled',
};

const MAX_DAYS       = 5;
const HIBERNATE_DAYS = 15;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { call_id, contact_id, result, notes, next_action, callback_at, scheduled_at } = req.body;
  if (!call_id || !result) return res.status(400).json({ error: 'call_id and result required' });

  const { data, error } = await supabase
    .from('outcomes')
    .insert({ call_id, result, notes: notes || '', next_action: next_action || '' })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  if (contact_id) {
    const contactStatus = STATUS_MAP[result] || 'answered';
    const contactUpdate = { status: contactStatus };

    if (result === 'callback' && callback_at)  contactUpdate.callback_at  = callback_at;
    if (result === 'scheduled' && scheduled_at) contactUpdate.scheduled_at = scheduled_at;

    // Track distinct days for no-answer results. Uses last_no_answer_date
    // (not last_call_date) — dial.js already sets last_call_date to today the
    // moment it claims the contact, before the outcome is known, so comparing
    // against it here would always be a same-day match and never increment.
    if (result === 'no_answer' || result === 'voicemail') {
      const { data: contact } = await supabase
        .from('contacts').select('distinct_days, last_no_answer_date, retry_used_date').eq('id', contact_id).single();

      if (contact) {
        const today       = new Date().toISOString().slice(0, 10);
        const newDistinct = (contact.distinct_days || 0) + (contact.last_no_answer_date !== today ? 1 : 0);
        contactUpdate.distinct_days       = newDistinct;
        contactUpdate.last_no_answer_date = today;

        const shouldHibernate = newDistinct >= MAX_DAYS;
        if (shouldHibernate) {
          contactUpdate.hibernating_until = new Date(Date.now() + HIBERNATE_DAYS * 86400000).toISOString().slice(0, 10);
        }

        // Immediate retry temporarily disabled while we validate the
        // concurrency fixes at the lower call pace — always false for now.
        const IMMEDIATE_RETRY_ENABLED = false;
        const alreadyRetriedToday = contact.retry_used_date === today;
        contactUpdate.immediate_retry_pending = IMMEDIATE_RETRY_ENABLED && !alreadyRetriedToday && !shouldHibernate;
      }
    }

    await supabase.from('contacts').update(contactUpdate).eq('id', contact_id);
    await propagateLinkedStatus(supabase, contact_id, contactUpdate);
  }

  res.json({ id: data.id });
}
