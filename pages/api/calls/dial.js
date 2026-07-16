import { supabase } from '../../../lib/supabase';
import { getClient } from '../../../lib/twilio';

const MAX_PER_DAY    = 4;
const MAX_PER_HOUR   = 2;
const MAX_DAYS       = 5;  // distinct days with no answer → hibernate
const HIBERNATE_DAYS = 15;

// These maintenance sweeps only ever need to do something once a day (when the
// date rolls over). Running them as full-table UPDATEs on every single dial()
// call adds two blocking DB round-trips before the call even starts ringing —
// this in-memory cache skips them once they've already run for today.
let lastMaintenanceDate = null;

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

async function runDailyMaintenanceIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastMaintenanceDate === today) return;
  await wakeUpHibernating();
  await resetDailyCounters();
  lastMaintenanceDate = today;
}

// Atomically "claims" a contact for dialing by updating it only if its
// last_call_at hasn't changed since we read it. If two dial() requests race
// and pick the same top-of-queue contact at the same time, only one of these
// conditional updates succeeds — the other gets 0 rows back and moves on to
// the next candidate instead of both dialing the same person.
async function claimContact(c) {
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from('contacts')
    .update({
      last_call_at:   new Date().toISOString(),
      last_call_date: today,
      attempts_today: (c.attempts_today || 0) + 1,
    })
    .eq('id', c.id);

  query = c.last_call_at ? query.eq('last_call_at', c.last_call_at) : query.is('last_call_at', null);

  const { data } = await query.select();
  return !!(data && data.length);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { contact_id } = req.body || {};

  // Maintenance: wake hibernating + reset daily counters (only once per day)
  await runDailyMaintenanceIfNeeded();

  let contact;

  if (contact_id) {
    const { data } = await supabase
      .from('contacts').select('*').eq('id', contact_id).single();
    if (data && await claimContact(data)) contact = data;
  } else {
    // Find next eligible contact in queue
    const { data: candidates } = await supabase
      .from('contacts')
      .select('*')
      .in('status', ['pending', 'no_answer'])
      .is('hibernating_until', null)
      .lt('attempts_today', MAX_PER_DAY)
      // Fair round-robin: whoever waited longest (or was never called) goes
      // next. queue_order defines the FIXED SEQUENCE for the round — it's the
      // tie-breaker whenever last_call_at ties (which is every contact at the
      // very start, and, in practice, stays true round after round since each
      // pass dials everyone in the same relative sequence before anyone gets
      // a repeat). This is what makes it loop through the manual order one
      // round at a time — top 10 first, then everyone else, then back to the
      // top 10 — instead of the top 10 hogging repeat attempts before the
      // rest of the queue is ever reached. It also naturally resumes wherever
      // you left off, since whoever hasn't been called yet always sorts first.
      .order('last_call_at', { ascending: true, nullsFirst: true })
      .order('queue_order', { ascending: true, nullsFirst: false })
      .limit(1000);

    if (candidates?.length) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      for (const c of candidates) {
        const { count } = await supabase
          .from('calls')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', c.id)
          .gte('started_at', hourAgo);
        if ((count || 0) >= MAX_PER_HOUR) continue;

        // Try to claim this candidate; if another concurrent request already
        // grabbed it (its last_call_at moved), skip to the next one instead
        // of both requests dialing the same contact.
        if (await claimContact(c)) { contact = c; break; }
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
      // asyncAmd:true is what actually makes AMD non-blocking — without it,
      // Twilio waits several seconds to decide human-vs-machine BEFORE
      // executing <Dial>, delaying every single call (even real human
      // answers) by that much. DetectMessageEnd (instead of the faster
      // 'Enable') waits for more audio before deciding, which cuts down on
      // false positives that were hanging up on real humans mid-conversation
      // — safe to use now that AMD no longer blocks the connection.
      machineDetection: 'DetectMessageEnd',
      asyncAmd: true,
      asyncAmdStatusCallback: `${baseUrl}/api/calls/amd`,
      asyncAmdStatusCallbackMethod: 'POST',
    });

    const { data: callRow } = await supabase
      .from('calls')
      .insert({ contact_id: contact.id, twilio_sid: call.sid })
      .select().single();

    res.json({ call_id: callRow.id, twilio_sid: call.sid, contact });
  } catch (e) {
    // The contact was already claimed (attempt counted) before we knew Twilio
    // would fail (e.g. geo-permission errors) — undo that so a failed call
    // doesn't burn one of its daily attempts for nothing.
    await supabase.from('contacts').update({
      last_call_at:   contact.last_call_at,
      last_call_date: contact.last_call_date,
      attempts_today: contact.attempts_today,
    }).eq('id', contact.id);
    res.status(500).json({ error: e.message });
  }
}
