import { supabase } from '../../../lib/supabase';
import { getClient } from '../../../lib/twilio';

// Machine types Twilio can return
const MACHINE_TYPES = ['machine_start', 'machine_end_beep', 'machine_end_silence', 'machine_end_other', 'fax'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { CallSid, AnsweredBy } = req.body;

  res.status(200).end(); // respond immediately to Twilio

  if (!CallSid || !MACHINE_TYPES.includes(AnsweredBy)) return;

  // Find the call record
  const { data: call } = await supabase
    .from('calls')
    .select('id, contact_id')
    .eq('twilio_sid', CallSid)
    .single();

  if (!call) return;

  // Check if agent already saved an outcome (avoid duplicating)
  const { data: existing } = await supabase
    .from('outcomes')
    .select('id')
    .eq('call_id', call.id)
    .single();

  if (existing) return;

  // Auto-save voicemail outcome
  await supabase.from('outcomes').insert({
    call_id: call.id,
    result: 'voicemail',
    notes: `Detectado automaticamente: ${AnsweredBy}`,
    next_action: '',
  });

  await supabase
    .from('contacts')
    .update({ status: 'no_answer' })
    .eq('id', call.contact_id);

  // Hang up the call so browser disconnects and auto-dial can proceed
  try {
    const client = getClient();
    await client.calls(CallSid).update({ status: 'completed' });
  } catch (_) {
    // Call may have already ended
  }
}
