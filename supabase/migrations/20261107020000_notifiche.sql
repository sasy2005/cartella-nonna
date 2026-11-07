-- Notifiche sul telefono (Web Push).

-- Un telefono/browser iscritto alle notifiche. Ognuno vede e gestisce solo i propri.
create table if not exists public.notifiche_iscrizioni (
  endpoint text primary key,
  email text not null,
  p256dh text not null,
  auth text not null,
  dispositivo text not null default '',
  created_at timestamptz not null default now()
);

alter table public.notifiche_iscrizioni enable row level security;

drop policy if exists "le mie iscrizioni" on public.notifiche_iscrizioni;
create policy "le mie iscrizioni" on public.notifiche_iscrizioni for all to authenticated
  using (public.is_membro() and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (public.is_membro() and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

grant select, insert, update, delete on public.notifiche_iscrizioni to authenticated;

-- Impostazioni interne del server (es. chiavi delle notifiche). Solo le funzioni server la leggono.
create table if not exists public.config_server (
  chiave text primary key,
  valore text not null
);
alter table public.config_server enable row level security;
revoke all on public.config_server from anon, authenticated;

grant all on public.notifiche_iscrizioni, public.config_server to service_role;
