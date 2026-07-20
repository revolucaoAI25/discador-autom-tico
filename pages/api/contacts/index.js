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

// Matches phone numbers with or without parentheses/hyphens: (11) 99999-9999,
// 11999999999, 11 99999 9999, etc. Kept loose since scrapers vary a lot —
// but a loose regex alone will also match a *substring* inside an unrelated
// long number (a CNPJ, a coordinate, an ID), so looksLikePhone below also
// checks the digit COUNT of the whole cell to rule those out.
const PHONE_RE = /\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CNPJ_RE  = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
const WEBSITE_RE = /^(https?:\/\/|www\.)/i;

const UF_LIST = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

// A real BR phone has 10-11 digits (with DDD) or 12-13 with the 55 country
// code. Anything outside that range is some other number that happened to
// contain a phone-shaped substring (e.g. a 14-digit CNPJ, a lat/long, an ID).
function looksLikePhone(cell) {
  if (!PHONE_RE.test(cell) || EMAIL_RE.test(cell)) return false;
  const digits = cell.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

// Google Maps / scraper exports ship with no header row and wildly varying
// column layouts. Instead of relying on fixed indices, scan every cell and
// pick it out by what it looks like (phone, email, website, CNPJ, UF...).
function extractPositionalRow(cols) {
  const cells = cols.map((c) => (c || '').trim());

  const phoneIdxs = [];
  cells.forEach((c, i) => { if (looksLikePhone(c)) phoneIdxs.push(i); });
  const phone1 = phoneIdxs[0] !== undefined ? cells[phoneIdxs[0]] : '';
  const phone2 = phoneIdxs[1] !== undefined ? cells[phoneIdxs[1]] : '';

  const email   = cells.find((c) => EMAIL_RE.test(c)) || '';
  const website = cells.find((c) => WEBSITE_RE.test(c) || /\.(com|com\.br|net|br)\b/i.test(c)) || '';
  const cnpj    = cells.find((c) => CNPJ_RE.test(c)) || '';

  // UF as its own cell (new format) — city is usually the cell right before it.
  let city = '', state = '';
  const ufIdx = cells.findIndex((c) => UF_LIST.includes(c.toUpperCase()));
  if (ufIdx !== -1) {
    state = cells[ufIdx].toUpperCase();
    city  = cells[ufIdx - 1] || '';
  } else {
    // Fallback: old Google Maps format with city/state embedded in a full address.
    const address = cells.find((c) => /,\s*[^,]+?\s*-\s*[A-Z]{2},\s*\d{5}-?\d{3}/.test(c)) || '';
    const m = address.match(/,\s*([^,]+?)\s*-\s*([A-Z]{2}),\s*\d{5}-?\d{3},?\s*Brasil\s*$/);
    if (m) { city = m[1].trim(); state = m[2].trim(); }
  }

  const address = cells.find((c) => /,\s*[^,]+?\s*-\s*[A-Z]{2},\s*\d{5}-?\d{3}/.test(c)) || '';

  // Name: first cell that isn't a phone/email/website/CNPJ/UF and isn't blank.
  const skip = new Set([...phoneIdxs, cells.indexOf(email), cells.indexOf(website), cells.indexOf(cnpj), ufIdx]);
  const nameIdx = cells.findIndex((c, i) => c && !skip.has(i));
  const name = nameIdx !== -1 ? cells[nameIdx] : '';

  // Company/category heuristic: a reasonably long text cell that isn't the
  // name, address, or any of the fields already captured above.
  const usedIdxs = new Set([...skip, nameIdx, cells.indexOf(address)]);
  const company = cells.find((c, i) =>
    !usedIdxs.has(i) && c.length > 2 && c.length < 60 &&
    /[a-zA-ZÀ-ÿ]/.test(c) && !/^\d+$/.test(c)
  ) || '';

  return {
    name, lead_name: '', phone1, phone2,
    company, email, address, city, state, website, cnpj,
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
      const headerless = rawRows.length > 0 && rawRows[0].some((cell) => looksLikePhone(cell || ''));

      let records;
      if (headerless) {
        records = rawRows;
      } else {
        records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
      }

      // Tags every row from this upload with the same batch id, so the whole
      // import can be undone in one shot from the UI if something's wrong.
      const importBatchId = randomUUID();

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
          import_batch_id: importBatchId,
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
      res.json({ inserted: data.length, import_batch_id: importBatchId });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}
