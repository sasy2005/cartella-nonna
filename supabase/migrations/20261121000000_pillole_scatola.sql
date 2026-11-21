-- Quante pillole ci sono in una scatola (per "Ho comprato: 2 scatole").
alter table public.farmaci add column if not exists per_scatola numeric not null default 0;

-- Chi aveva scritto il numero nelle Note (es. "28" o "28 compresse"): lo spostiamo nel campo giusto.
update public.farmaci
set per_scatola = replace(substring(note from '^\s*(\d+(?:[.,]\d+)?)'), ',', '.')::numeric,
    note = ''
where per_scatola = 0
  and note ~* '^\s*\d+(?:[.,]\d+)?\s*(pillole|pastiglie|compresse|cpr|capsule|pz|pezzi)?\s*\.?\s*$';
