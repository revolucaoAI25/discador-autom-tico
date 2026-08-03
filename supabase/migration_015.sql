-- Histórico de WhatsApp agora também é rastreado por telefone (normalizado),
-- não só por contact_id — assim sobrevive a reimportações/duplicados que
-- criam um novo ID de contato pro mesmo número.
alter table whatsapp_sends add column if not exists phone text;
create index if not exists idx_whatsapp_sends_phone on whatsapp_sends(phone);
