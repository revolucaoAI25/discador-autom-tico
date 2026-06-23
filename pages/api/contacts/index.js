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

      const rows = records
        .map((row) => ({
          name:    (row.name    || row.nome    || row.Name    || '').trim(),
          phone:   (row.phone   || row.telefone || row.Phone  || row.fone || '').trim(),
          company: (row.company || row.empresa  || row.Company || '').trim(),
        }))
        .filter((r) => r.name && r.phone);

      const { data, error } = await supabase.from('contacts').insert(rows).select();
      fs.unlinkSync(file.filepath);

      if (error) return res.status(400).json({ error: error.message });
      res.json({ inserted: data.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}
