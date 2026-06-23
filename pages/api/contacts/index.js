import { getDb } from '../../../lib/db';
import { parse } from 'csv-parse/sync';
import { formidable } from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'POST') {
    return handlePost(req, res);
  }
  res.status(405).json({ error: 'Method not allowed' });
}

function handleGet(req, res) {
  const db = getDb();
  const { status, search } = req.query;

  let sql = 'SELECT * FROM contacts';
  const params = [];
  const conditions = [];

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(name LIKE ? OR phone LIKE ? OR company LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';

  const contacts = db.prepare(sql).all(...params);
  res.json({ contacts });
}

async function handlePost(req, res) {
  const form = formidable({ keepExtensions: true });

  form.parse(req, (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Upload failed' });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    try {
      const content = fs.readFileSync(file.filepath, 'utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      const db = getDb();
      const insert = db.prepare(
        'INSERT INTO contacts (name, phone, company) VALUES (?, ?, ?)'
      );

      const insertMany = db.transaction((rows) => {
        let count = 0;
        for (const row of rows) {
          const name = row.name || row.nome || row.Name || '';
          const phone = row.phone || row.telefone || row.Phone || row.fone || '';
          const company = row.company || row.empresa || row.Company || '';
          if (name && phone) {
            insert.run(name.trim(), phone.trim(), company.trim());
            count++;
          }
        }
        return count;
      });

      const count = insertMany(records);
      fs.unlinkSync(file.filepath);
      res.json({ inserted: count });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}
