import { formidable } from 'formidable';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { supabase } from '../../../lib/supabase';

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  res.status(405).json({ error: 'Method not allowed' });
}

function normalizePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length >= 10) return `+55${digits}`;
  return raw;
}

function extractRow(row) {
  const g = (keys) => {
    for (const k of keys) { const v = (row[k] || '').trim(); if (v) return v; }
    return '';
  };

  return {
    name:      g(['Nome', 'name', 'Name']),
    lead_name: g(['Nome do Lead', 'Nome do lead', 'nome do lead', 'lead_name', 'Lead Name']),
    phone1:  g(['Telefone', 'phone', 'Phone', 'telefone', 'fone']),
    phone2:  g(['Telefone 2', 'Telefone2', 'phone2']),
    company: g(['Nicho', 'company', 'empresa', 'Company']),
    email:   g(['E-mail', 'Email', 'email']),
    address: g(['Endereço', 'Endereco', 'address']),
    city:    g(['Município', 'Municipio', 'city', 'cidade']),
    state:   g(['UF', 'state', 'estado']),
    website: g(['Site', 'Website', 'website', 'site']),
    cnpj:    g(['CNPJ', 'cnpj']),
    // Fallback company from city/state if no niche
    _cityState: [g(['Município', 'Municipio', 'city']), g(['UF', 'state'])].filter(Boolean).join('/'),
  };
}

async function handleGet(req, res) {
  const { status, search } = req.query;

  // Supabase/PostgREST caps each request at 1000 rows — page through until
  // everything is fetched so the kanban shows every contact, not just the first 1000.
  const PAGE_SIZE = 1000;
  let all = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('contacts').select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (status && status !== 'all') query = query.eq('status', status);
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    all = all.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  res.json({ contacts: all });
}

function handlePost(req, res) {
  const form = formidable({ keepExtensions: true });

  form.parse(req, async (err, _fields, files) => {
    if (err) return res.status(400).json({ error: 'Upload failed' });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    try {
      const content = fs.readFileSync(file.filepath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

      const rows = [];
      for (const record of records) {
        const r = extractRow(record);
        if (!r.name) continue;

        const base = {
          company:   r.company || r._cityState,
          email:     r.email,
          address:   r.address,
          city:      r.city,
          state:     r.state,
          website:   r.website,
          cnpj:      r.cnpj,
          lead_name: r.lead_name || null,
        };

        const p1 = normalizePhone(r.phone1);
        const p2 = normalizePhone(r.phone2);
        // Link both numbers of the same lead so a decision made on one
        // (agendado, interessado, sem interesse, callback) propagates to the other.
        const groupId = (p1 && p2 && p2 !== p1) ? randomUUID() : null;

        if (p1) rows.push({ name: r.name, phone: p1, ...base, group_id: groupId });
        if (p2 && p2 !== p1) rows.push({ name: r.name, phone: p2, ...base, group_id: groupId });
      }

      if (rows.length === 0) {
        fs.unlinkSync(file.filepath);
        return res.status(400).json({ error: 'Nenhum contato válido encontrado' });
      }

      const { data, error } = await supabase.from('contacts').insert(rows).select();
      fs.unlinkSync(file.filepath);

      if (error) return res.status(400).json({ error: error.message });
      res.json({ inserted: data.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}
