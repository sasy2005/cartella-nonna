-- Diagnostica per il "Controllo completo": stato dell'orologio dei promemoria.
-- Restituisce solo orari e codici di stato, nessun dato della nonna. Solo le funzioni server la usano.

create or replace function public.diagnostica()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  risultato jsonb := '{}'::jsonb;
begin
  risultato := risultato || jsonb_build_object(
    'orologio', coalesce((select jsonb_agg(jsonb_build_object('nome', jobname, 'orario', schedule, 'attivo', active)) from cron.job where jobname = 'nonna-promemoria'), '[]'::jsonb)
  );
  risultato := risultato || jsonb_build_object(
    'esecuzioni', coalesce((
      select jsonb_agg(x order by x->>'inizio' desc) from (
        select jsonb_build_object('inizio', d.start_time, 'stato', d.status) as x
        from cron.job_run_details d join cron.job j on j.jobid = d.jobid
        where j.jobname = 'nonna-promemoria'
        order by d.start_time desc limit 6
      ) s
    ), '[]'::jsonb)
  );
  begin
    risultato := risultato || jsonb_build_object(
      'risposte', coalesce((
        select jsonb_agg(x) from (
          select jsonb_build_object('quando', created, 'codice', status_code, 'saltato', content like '%saltato%', 'errore', coalesce(error_msg, '') <> '') as x
          from net._http_response order by created desc limit 6
        ) s
      ), '[]'::jsonb)
    );
  exception when others then
    risultato := risultato || jsonb_build_object('risposte', 'non disponibili');
  end;
  return risultato;
end;
$$;

revoke all on function public.diagnostica() from public, anon, authenticated;
grant execute on function public.diagnostica() to service_role;
