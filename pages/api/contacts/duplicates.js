import { supabase } from '../../../lib/supabase';

function normalizeName(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const by = req.query.by === 'name' ? 'name' : 'phone';

  const PAGE_SIZE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, phone, company, cnpj, status, created_at')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return res.status(500).json({ error: error.message });
    all = all.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const groups = new Map();
  for (const c of all) {
    const key = by === 'phone' ? (c.phone || '').trim() : normalizeName(c.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, contacts]) => contacts.length > 1)
    .map(([key, contacts]) => ({ key, contacts }))
    .sort((a, b) => b.contacts.length - a.contacts.length);

  res.json({ by, groups: duplicateGroups, totalDuplicateContacts: duplicateGroups.reduce((s, g) => s + g.contacts.length, 0) });
}
