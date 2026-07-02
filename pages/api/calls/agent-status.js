export const config = { api: { bodyParser: true } };

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { CallSid, CallStatus, SipResponseCode, AnsweredBy } = req.body;
  console.log(`[agent-leg status] sid=${CallSid} status=${CallStatus} sipCode=${SipResponseCode || '-'} answeredBy=${AnsweredBy || '-'}`);

  res.status(200).end();
}
