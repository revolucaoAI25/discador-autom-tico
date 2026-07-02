export const config = { api: { bodyParser: true } };

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const room = req.query.room || '';
  console.log(`[lead-leg] TwiML executed — lead answered, joining room=${room}. CallSid=${req.body?.CallSid}`);

  const statusCbUrl = `${process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.host}`}/api/calls/conference-status`;

  res.setHeader('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      beep="false"
      statusCallback="${statusCbUrl}"
      statusCallbackEvent="start end join leave"
    >${room}</Conference>
  </Dial>
</Response>`);
}
