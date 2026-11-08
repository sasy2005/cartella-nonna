-- Valori letti dagli esami del sangue: [{nome, valore, unita, riferimento, fuori}]
alter table public.documenti add column if not exists valori jsonb not null default '[]'::jsonb;
