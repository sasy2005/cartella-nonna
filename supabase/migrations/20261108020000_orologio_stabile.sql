-- L'orologio dei promemoria viene aggiornato al suo posto (stesso nome), senza essere ricreato:
-- così resta lo storico delle esecuzioni che mostra il "Controllo completo".
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
