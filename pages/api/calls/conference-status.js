export const config = { api: { bodyParser: true } };

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { StatusCallbackEvent, FriendlyName, CallSid, ConferenceSid } = req.body;
  console.log(`[conference] event=${StatusCallbackEvent} room=${FriendlyName} conferenceSid=${ConferenceSid} callSid=${CallSid}`);

  res.status(200).end();
}
