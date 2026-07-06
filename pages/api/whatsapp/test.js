export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });

  const payload = { name: 'Teste', phone: '5511999999999' };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    res.json({ ok: r.ok, status: r.status, body: text.slice(0, 500), sentPayload: payload });
  } catch (e) {
    res.json({ ok: false, status: null, body: e.message, sentPayload: payload });
  }
}
