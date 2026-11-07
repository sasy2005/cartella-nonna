-- Cartella della Nonna: schema iniziale.
-- Una sola "famiglia": chiunque sia nella tabella `membri` vede e modifica tutto.

-- Membri della famiglia (aggiunti a mano dal SQL editor, vedi GUIDA.md)
create table if not exists public.membri (
  email text primary key,
  nome text not null default '',
  whatsapp_tel text not null default '',
  callmebot_key text not null default '',
  promemoria boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_membro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.membri
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create table if not exists public.profilo (
  id int primary key default 1 check (id = 1),
  dati jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.profilo (id) values (1) on conflict do nothing;

create table if not exists public.contatti (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  tipo text not null default 'medico' check (tipo in ('medico', 'struttura')),
  specialita text not null default 'Altro',
  telefono text not null default '',
  orari text not null default '',
  sito text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.impegni (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'visita' check (tipo in ('visita', 'esame')),
  titolo text not null default '',
  specialita text not null default 'Altro',
  stato text not null default 'da_prenotare' check (stato in ('da_prenotare', 'prenotato', 'fatto', 'annullato')),
  data timestamptz,
  luogo text not null default '',
  contatto_id uuid references public.contatti(id) on delete set null,
  preparazione text not null default '',
  portare text not null default '',
  per_visita_id uuid references public.impegni(id) on delete set null,
  entro date,
  giorni_referto int not null default 0,
  referto_ritirato boolean not null default false,
  nre text not null default '',
  priorita text check (priorita in ('U', 'B', 'D', 'P')),
  data_ricetta date,
  scadenza_ricetta date,
  prescrittore text not null default '',
  ricetta_path text,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chiamate (
  id uuid primary key default gen_random_uuid(),
  impegno_id uuid not null references public.impegni(id) on delete cascade,
  contatto_id uuid references public.contatti(id) on delete set null,
  quando timestamptz not null default now(),
  esito text not null default '',
  richiamare_il date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documenti (
  id uuid primary key default gen_random_uuid(),
  titolo text not null default '',
  tipo text not null default 'Referto',
  specialita text not null default 'Altro',
  data date not null default current_date,
  note text not null default '',
  file_path text,
  file_tipo text not null default '',
  impegno_id uuid references public.impegni(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farmaci (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  quando text not null default '',
  per_giorno numeric not null default 1,
  scorta numeric not null default 0,
  scorta_al date not null default current_date,
  note text not null default '',
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at automatico
create or replace function public.tocca_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profilo', 'contatti', 'impegni', 'chiamate', 'documenti', 'farmaci'] loop
    execute format('drop trigger if exists tocca on public.%I', t);
    execute format('create trigger tocca before update on public.%I for each row execute function public.tocca_updated_at()', t);
  end loop;
end $$;

-- Sicurezza: solo i membri della famiglia
do $$
declare t text;
begin
  foreach t in array array['profilo', 'contatti', 'impegni', 'chiamate', 'documenti', 'farmaci'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists famiglia on public.%I', t);
    execute format(
      'create policy famiglia on public.%I for all to authenticated using (public.is_membro()) with check (public.is_membro())',
      t
    );
  end loop;
end $$;

alter table public.membri enable row level security;
drop policy if exists "vedo me stesso" on public.membri;
create policy "vedo me stesso" on public.membri for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists "modifico me stesso" on public.membri;
create policy "modifico me stesso" on public.membri for update to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Foto e PDF: spazio privato "documenti"
insert into storage.buckets (id, name, public)
values ('documenti', 'documenti', false)
on conflict (id) do nothing;

drop policy if exists "famiglia legge documenti" on storage.objects;
create policy "famiglia legge documenti" on storage.objects for select to authenticated
  using (bucket_id = 'documenti' and public.is_membro());
drop policy if exists "famiglia carica documenti" on storage.objects;
create policy "famiglia carica documenti" on storage.objects for insert to authenticated
  with check (bucket_id = 'documenti' and public.is_membro());
drop policy if exists "famiglia modifica documenti" on storage.objects;
create policy "famiglia modifica documenti" on storage.objects for update to authenticated
  using (bucket_id = 'documenti' and public.is_membro());
drop policy if exists "famiglia elimina documenti" on storage.objects;
create policy "famiglia elimina documenti" on storage.objects for delete to authenticated
  using (bucket_id = 'documenti' and public.is_membro());

-- Numeri utili in Lombardia (da verificare e completare dall'app)
insert into public.contatti (nome, tipo, specialita, telefono, orari, sito, note)
select 'Prenotazioni Regione Lombardia', 'struttura', 'Altro', '800 638 638', 'Da cellulare: 02 999 599',
       'https://www.prenotasalute.regione.lombardia.it/',
       'Numero verde regionale per prenotare visite ed esami. Anche online con il sito Prenota Salute.'
where not exists (select 1 from public.contatti);
