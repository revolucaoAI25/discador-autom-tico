-- Retry imediato: se o lead não atender na primeira tentativa da rodada,
-- ele entra na frente da fila para uma segunda tentativa imediata (mesmo dia).
alter table contacts add column if not exists immediate_retry_pending boolean default false;
alter table contacts add column if not exists retry_used_date date;
