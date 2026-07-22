-- migration_013 criou whatsapp_sends.dispatch_id como bigint, mas
-- whatsapp_dispatches.id é uuid (migration_002) — incompatibilidade de tipo
-- que fazia toda gravação de histórico falhar silenciosamente.
alter table whatsapp_sends alter column dispatch_id type uuid using dispatch_id::text::uuid;
