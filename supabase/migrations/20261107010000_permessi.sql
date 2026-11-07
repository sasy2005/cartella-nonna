-- I progetti Supabase recenti non danno più in automatico i permessi sulle tabelle
-- agli utenti collegati: li concediamo esplicitamente.
-- Chi vede cosa resta deciso dalle regole (row level security) della migrazione iniziale.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on
  public.profilo, public.contatti, public.impegni, public.chiamate, public.documenti, public.farmaci
  to authenticated;

grant select, update on public.membri to authenticated;

grant execute on function public.is_membro() to authenticated;

-- Le funzioni server (promemoria, lettura ricette) usano il ruolo service_role.
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
