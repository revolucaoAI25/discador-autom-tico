import { supabase } from '../../../lib/supabase';

function normalizePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length >= 10) return `+55${digits}`;
  return raw;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, phone, company } = req.body || {};
  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }

  const normalizedPhone = normalizePhone(phone.trim());
  if (!normalizedPhone) return res.status(400).json({ error: 'Telefone inválido' });

  const { data, error } = await supabase
    .from('contacts')
    // Contatos manuais raramente preenchem "Empresa" (campo opcional) — sem
    // isso, o disparo de WhatsApp (que usa contact.company) sairia sempre
    // vazio. Usa o nome digitado como fallback quando empresa não é informada.
    .insert({ name: name.trim(), phone: normalizedPhone, company: company?.trim() || name.trim() })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ contact: data });
}
