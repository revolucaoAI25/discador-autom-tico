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

const PHONE_RE = /\(\d{2}\)\s?\d{4,5}-\d{4}/;

// Common Google Maps scraper export with no header row:
// Name, Phone, (blank), Status, Address, (blank x3), Website, Maps URL, Rating, Reviews, (blank), Category, (blank), Subcategory
function extractPositionalRow(cols) {
  const name    = (cols[0] || '').trim();
  const phone1  = (cols[1] || '').trim();
  const address = (cols[4] || '').trim();
  const website = (cols[8] || '').trim();
  const category    = (cols[13] || '').trim();
  const subcategory = (cols[15] || '').trim();

  const m = address.match(/,\s*([^,]+?)\s*-\s*([A-Z]{2}),\s*\d{5}-?\d{3},?\s*Brasil\s*$/);
  const city  = m ? m[1].trim() : '';
  const state = m ? m[2].trim() : '';

  return {
    name, lead_name: '', phone1, phone2: '',
    company: subcategory || category,
    email: '', address, city, state, website, cnpj: '',
    _cityState: [city, state].filter(Boolean).join('/'),
  };
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
      const rawRows = parse(content, { columns: false, skip_empty_lines: true, trim: true });

      // Some scrapers (e.g. Google Maps exports) ship with no header row at
      // all — the first "row" is already data. Detect that by checking if the
      // first row already looks like a phone number instead of a column name.
      const headerless = rawRows.length > 0 && rawRows[0].some((cell) => PHONE_RE.test(cell || ''));

      let records;
      if (headerless) {
        records = rawRows;
      } else {
        records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
      }

      const rows = [];
      for (const record of records) {
        const r = headerless ? extractPositionalRow(record) : extractRow(record);
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
