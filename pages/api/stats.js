import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // Use exact counts per status instead of fetching every row (which hits
  // Supabase/PostgREST's 1000-row default cap and undercounts large lists).
  const STATUS_KEYS = ['pending', 'called', 'interested', 'not_interested', 'no_answer'];
  const counts = { total: 0, pending: 0, called: 0, interested: 0, not_interested: 0, no_answer: 0 };

  const [{ count: total }, ...statusCounts] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true }),
    ...STATUS_KEYS.map((s) => supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('status', s)),
  ]);

  counts.total = total || 0;
  STATUS_KEYS.forEach((s, i) => { counts[s] = statusCounts[i].count || 0; });

  // Call stats
  const { data: callRows } = await supabase.from('calls').select('duration').not('duration', 'is', null);
  const durations = (callRows || []).map((r) => r.duration);
  const callStats = {
    total_calls: callRows?.length || 0,
    total_duration: durations.reduce((s, d) => s + d, 0),
    avg_duration: durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0,
  };

  // Recent outcomes with nested joins
  const { data: recentOutcomes } = await supabase
    .from('outcomes')
    .select('*, calls!call_id(twilio_sid, contacts!contact_id(name, company))')
    .order('created_at', { ascending: false })
    .limit(10);

  // Flatten the nested structure for the dashboard
  const outcomes = (recentOutcomes || []).map((o) => ({
    id: o.id,
    result: o.result,
    notes: o.notes,
    next_action: o.next_action,
    created_at: o.created_at,
    twilio_sid: o.calls?.twilio_sid,
    name: o.calls?.contacts?.name,
    company: o.calls?.contacts?.company,
  }));

  res.json({ contacts: counts, calls: callStats, recentOutcomes: outcomes });
}
