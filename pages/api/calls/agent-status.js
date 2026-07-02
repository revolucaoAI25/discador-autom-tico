import { supabase } from '../../../lib/supabase';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { CallSid, CallStatus, SipResponseCode, AnsweredBy } = req.body || {};
    console.log(`[agent-leg status] sid=${CallSid} status=${CallStatus} sipCode=${SipResponseCode || '-'} answeredBy=${AnsweredBy || '-'}`);

    if (CallSid && CallStatus) {
      const { error } = await supabase.from('calls').update({ agent_status: CallStatus }).eq('agent_call_sid', CallSid);
      if (error) console.error('[agent-leg status] supabase update error:', error.message);
    }
  } catch (e) {
    console.error('[agent-leg status] handler error:', e.message);
  }

  res.status(204).end();
}
