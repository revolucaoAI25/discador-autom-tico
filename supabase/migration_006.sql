-- Run this in the Supabase SQL Editor

alter table contacts add column if not exists group_id uuid;
create index if not exists idx_contacts_group_id on contacts(group_id);
