-- Email dei contatti (es. il medico di base risponde solo per email per le ricette).
alter table public.contatti add column if not exists email text not null default '';
