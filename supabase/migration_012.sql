-- Cada ligação passa a gravar qual sessão do navegador (softphone) a discou,
-- em vez de todas as sessões compartilharem um identificador fixo no Twilio
-- Client — isso evita que uma sessão "fantasma" (aba travada, wifi caído,
-- etc.) ainda registrada no Twilio receba/toque uma ligação que não é dela.
alter table calls add column if not exists agent_identity text;
