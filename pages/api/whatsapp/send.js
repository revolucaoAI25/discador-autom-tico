import { supabase } from '../../../lib/supabase';
import { normalizePhone } from '../../../lib/phone';


export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { dispatch_id, contact_id } = req.body || {};
  if (!dispatch_id || !contact_id) return res.status(400).json({ error: 'dispatch_id and contact_id required' });

  const [{ data: dispatch }, { data: contact }] = await Promise.all([
    supabase.from('whatsapp_dispatches').select('*').eq('id', dispatch_id).single(),
    supabase.from('contacts').select('*').eq('id', contact_id).single(),
  ]);

  if (!dispatch) return res.status(404).json({ error: 'Disparo não encontrado' });
  if (!contact)  return res.status(404).json({ error: 'Contato não encontrado' });

  const phone = normalizePhone(contact.phone);
  const name  = contact.company || '';

  async function logSend({ ok, statusCode, response }) {
    const { error: logError } = await supabase.from('whatsapp_sends').insert({
      contact_id: contact.id, phone, dispatch_id: dispatch.id, dispatch_name: dispatch.name,
      ok, status_code: statusCode ?? null, response: (response || '').slice(0, 500),
    });
    if (logError) console.error('[whatsapp/send] failed to log to whatsapp_sends:', logError.message);
    if (ok) {
      // Also tag any other contact rows sharing this phone (duplicate imports,
      // re-uploads) so the badge doesn't disappear just because a newer row
      // with a different id ended up being the one shown in the Kanban.
      await supabase.from('contacts').update({ last_whatsapp_sent_at: new Date().toISOString() }).eq('phone', contact.phone);
    }
  }

  try {
    const r = await fetch(dispatch.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });
    if (!r.ok) {
      const txt = await r.text();
      await logSend({ ok: false, statusCode: r.status, response: txt });
      return res.status(502).json({ error: `Webhook retornou ${r.status}: ${txt}` });
    }
    await logSend({ ok: true, statusCode: r.status, response: '' });
    return res.json({ ok: true });
  } catch (e) {
    await logSend({ ok: false, statusCode: null, response: e.message });
    return res.status(502).json({ error: e.message });
  }
}
