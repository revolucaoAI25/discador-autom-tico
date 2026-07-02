-- Run this in the Supabase SQL Editor

alter table calls add column if not exists status text default 'initiated';
create index if not exists idx_calls_status on calls(status);
