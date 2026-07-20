-- Marca cada importação de CSV com um lote, para permitir desfazer a última.
alter table contacts add column if not exists import_batch_id uuid;
create index if not exists idx_contacts_import_batch_id on contacts(import_batch_id);
