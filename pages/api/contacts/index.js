import { formidable } from 'formidable';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { supabase } from '../../../lib/supabase';

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  res.status(405).json({ error: 'Method not allowed' });
}

// Normalize any Brazilian phone to E.164 (+5511999998888)
function normalizePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length >= 10) return `+55${digits}`;
  return raw;
}

// Extract fields from a row, supporting both your export format and generic formats
function extractRow(row) {
  const name    = (row['Nome']     || row['name']     || row['Name']    || '').trim();
  const phone1  = (row['Telefone'] || row['phone']    || row['Phone']   || row['telefone'] || row['fone'] || '').trim();
  const phone2  = (row['Telefone 2'] || row['Telefone2'] || row['phone2'] || '').trim();

  // Company: prefer Nicho, fallback to Município/UF, then empresa/company column
  const nicho   = (row['Nicho']    || '').trim();
  const cidade  = (row['Município'] || row['Municipio'] || '').trim();
  const uf      = (row['UF'] || '').trim();
  const empresa = (row['company']  || row['empresa']  || row['Company'] || '').trim();

  let company = nicho || empresa;
  if (!company && (cidade || uf)) company = [cidade, uf].filter(Boolean).join('/');

  return { name, phone1, phone2, company };
}

async function handleGet(req, res) {
  const { status, search } = req.query;

  let query = supabase.from('contacts').select('*').order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ contacts: data });
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
        const { name, phone1, phone2, company } = extractRow(record);
        if (!name) continue;

        const p1 = normalizePhone(phone1);
        if (p1) rows.push({ name, phone: p1, company });

        // Second phone becomes a separate entry in the queue
        const p2 = normalizePhone(phone2);
        if (p2 && p2 !== p1) rows.push({ name, phone: p2, company });
      }

      if (rows.length === 0) {
        fs.unlinkSync(file.filepath);
        return res.status(400).json({ error: 'Nenhum contato válido encontrado no CSV' });
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
