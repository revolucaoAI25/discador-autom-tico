import { supabase } from '../../../lib/supabase';

// A real BR phone (as stored, always E.164-ish with +55 prefix) has 12 or 13
// digits total. Anything outside that came from the CSV-parser false-positive
// bug that treated other long numbers (CNPJ, coordinates, IDs) as a phone.
function isBadPhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length < 12 || digits.length > 13;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const PAGE_SIZE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('contacts').select('id, phone').range(from, from + PAGE_SIZE - 1);
    if (error) return res.status(500).json({ error: error.message });
    all = all.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const badIds = all.filter((c) => isBadPhone(c.phone)).map((c) => c.id);
  if (badIds.length === 0) return res.json({ deleted: 0 });

  const { error: delError } = await supabase.from('contacts').delete().in('id', badIds);
  if (delError) return res.status(500).json({ error: delError.message });

  res.json({ deleted: badIds.length });
}
