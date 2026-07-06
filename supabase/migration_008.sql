-- Run this in the Supabase SQL Editor

alter table contacts add column if not exists queue_order integer;
create index if not exists idx_contacts_queue_order on contacts(queue_order);
