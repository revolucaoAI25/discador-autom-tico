-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS contacts (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  company    TEXT DEFAULT '',
  status     TEXT DEFAULT 'pending'
               CHECK (status IN ('pending','called','no_answer','interested','not_interested')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calls (
  id          BIGSERIAL PRIMARY KEY,
  contact_id  BIGINT REFERENCES contacts(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  duration    INTEGER,
  twilio_sid  TEXT
);

CREATE TABLE IF NOT EXISTS outcomes (
  id          BIGSERIAL PRIMARY KEY,
  call_id     BIGINT REFERENCES calls(id) ON DELETE CASCADE,
  result      TEXT CHECK (result IN ('no_answer','callback','interested','not_interested','voicemail')),
  notes       TEXT DEFAULT '',
  next_action TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_twilio_sid ON calls(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_outcomes_call_id ON outcomes(call_id);

-- Disable RLS (API routes use the service role key which bypasses it anyway,
-- but disabling keeps things simple while there's no user auth)
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE calls    DISABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes DISABLE ROW LEVEL SECURITY;
