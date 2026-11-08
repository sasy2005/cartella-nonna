-- Migliorie: cosa portare alle visite, orari dei farmaci, pratiche, promemoria gestiti da Supabase.

-- Documenti dell'archivio da portare a una visita (id dei documenti)
alter table public.impegni add column if not exists documenti_da_portare jsonb not null default '[]'::jsonb;

-- Quante pillole in ogni momento della giornata: {"colazione":1,"pranzo":0,"cena":1,"sera":0}
alter table public.farmaci add column if not exists momenti jsonb not null default '{}'::jsonb;

-- Pratiche burocratiche (es. 104 e aggravamento invalidità) con i passi da spuntare
create table if not exists public.pratiche (
  id uuid primary key default gen_random_uuid(),
  titolo text not null default '',
  passi jsonb not null default '[]'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pratiche enable row level security;
drop policy if exists famiglia on public.pratiche;
create policy famiglia on public.pratiche for all to authenticated using (public.is_membro()) with check (public.is_membro());
drop trigger if exists tocca on public.pratiche;
create trigger tocca before update on public.pratiche for each row execute function public.tocca_updated_at();
grant select, insert, update, delete on public.pratiche to authenticated;
grant all on public.pratiche to service_role;

-- Orologio interno di Supabase: ogni ora chiama la funzione "promemoria",
-- che decide da sola se è l'ora giusta (le 7 italiane, con o senza ora legale).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.pianifica_promemoria(base_url text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.config_server (chiave, valore)
  values ('cron_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  on conflict (chiave) do nothing;

  perform cron.unschedule(jobid) from cron.job where jobname = 'nonna-promemoria';
  perform cron.schedule(
    'nonna-promemoria',
    '2 * * * *',
    format(
      $cmd$select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', (select valore from public.config_server where chiave = 'cron_token')),
        body := '{"giro":"auto"}'::jsonb,
        timeout_milliseconds := 30000
      )$cmd$,
      rtrim(base_url, '/') || '/functions/v1/promemoria'
    )
  );
  return 'promemoria pianificato';
end;
$$;

revoke all on function public.pianifica_promemoria(text) from public, anon, authenticated;
grant execute on function public.pianifica_promemoria(text) to service_role;
