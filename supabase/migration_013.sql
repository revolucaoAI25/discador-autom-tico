-- Histórico de disparos de WhatsApp por contato, e uma tag rápida no Kanban
-- pra saber se uma mensagem já foi enviada sem precisar abrir o histórico.
create table if not exists whatsapp_sends (
  id            bigserial primary key,
  contact_id    bigint references contacts(id) on delete cascade,
  dispatch_id   bigint,
  dispatch_name text,
  ok            boolean not null,
  status_code   integer,
  response      text,
  created_at    timestamptz default now()
);
create index if not exists idx_whatsapp_sends_contact_id on whatsapp_sends(contact_id);

alter table contacts add column if not exists last_whatsapp_sent_at timestamptz;
