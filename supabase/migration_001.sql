-- Migration 001 — Run in Supabase SQL Editor

-- 1. New columns on contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS address      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS city         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS state        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS website      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cnpj         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS attempts_today  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_call_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_call_date  DATE,
  ADD COLUMN IF NOT EXISTS distinct_days   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hibernating_until DATE,
  ADD COLUMN IF NOT EXISTS callback_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_at  TIMESTAMPTZ;

-- 2. Drop old status constraint and recreate with new values
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_status_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_status_check
  CHECK (status IN (
    'pending','no_answer','answered','callback',
    'interested','not_interested','scheduled'
  ));

-- 3. Rename old 'called' rows to 'answered'
UPDATE contacts SET status = 'answered' WHERE status = 'called';
