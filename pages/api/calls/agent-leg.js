export const config = { api: { bodyParser: true } };

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const room = req.query.room || '';

  res.setHeader('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${room}</Conference>
  </Dial>
</Response>`);
}
