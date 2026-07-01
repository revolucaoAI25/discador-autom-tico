-- Run this in the Supabase SQL Editor

create table if not exists whatsapp_dispatches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  url        text not null,
  created_at timestamptz default now()
);
