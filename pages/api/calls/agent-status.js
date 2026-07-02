import { supabase } from '../../../lib/supabase';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { CallSid, CallStatus, SipResponseCode, AnsweredBy } = req.body;
  console.log(`[agent-leg status] sid=${CallSid} status=${CallStatus} sipCode=${SipResponseCode || '-'} answeredBy=${AnsweredBy || '-'}`);

  if (CallSid && CallStatus) {
    await supabase.from('calls').update({ agent_status: CallStatus }).eq('agent_call_sid', CallSid);
  }

  res.status(200).end();
}
