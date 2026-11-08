// Dal foglio di prenotazione letto dall'AI ai campi della visita. Senza React: si può testare.
import type { Impegno } from "../../supabase/functions/_shared/tipi.ts";
import type { LetturaPrenotazione } from "./backend.ts";
import { eScontato } from "../../supabase/functions/_shared/avvisi.ts";

const righe = (s: string | null | undefined) =>
  (s || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

/** Unisce quello che c'è scritto sul foglio di prenotazione con la visita. */
/** Le date dopo la prima, quando il foglio ha più appuntamenti (es. un lavaggio ogni 3 mesi). */
export function altreDateDaFoglio(l: LetturaPrenotazione): string[] {
  const q = (data: string, ora: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(data) ? new Date(`${data}T${/^\d{1,2}:\d{2}$/.test(ora) ? ora.padStart(5, "0") : "08:00"}`).toISOString() : null;
  const tutte = [...new Set([...(l.appuntamenti ?? []).map((a) => q(a.data, a.ora)), q(l.data, l.ora)].filter((x): x is string => Boolean(x)))].sort();
  return tutte.slice(1);
}

export function daFoglio(l: LetturaPrenotazione, imp: Partial<Impegno>): Partial<Impegno> {
  const campi: Partial<Impegno> = {};
  const quando = (data: string, ora: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(data) ? new Date(`${data}T${/^\d{1,2}:\d{2}$/.test(ora) ? ora.padStart(5, "0") : "08:00"}`).toISOString() : null;
  const tutte = [...new Set([...(l.appuntamenti ?? []).map((a) => quando(a.data, a.ora)), quando(l.data, l.ora)].filter((x): x is string => Boolean(x)))].sort();
  if (tutte.length) campi.data = tutte[0];
  const dove = [l.struttura, l.reparto, l.indirizzo].map((x) => x.trim()).filter(Boolean).join(", ");
  if (dove) campi.luogo = dove;
  /** Aggiunge le voci nuove a quelle già scritte, senza doppioni (anche maiuscole/minuscole). */
  const unisci = (vecchio: string | undefined, nuovi: string[]) => {
    const out = righe(vecchio);
    for (const x of nuovi.map((y) => y.trim()).filter(Boolean)) if (!out.some((e) => e.toLowerCase() === x.toLowerCase())) out.push(x);
    return out.join("\n");
  };
  if (l.preparazione.length) campi.preparazione = unisci(imp.preparazione, l.preparazione);
  const daPortare = l.portare.filter((x) => !eScontato(x));
  if (daPortare.length) campi.portare = unisci(imp.portare, daPortare);
  const note = [
    l.appunti_a_mano?.trim() && `Note a mano: ${l.appunti_a_mano.trim()}`,
    l.codice_prenotazione && `Codice prenotazione: ${l.codice_prenotazione}`,
    l.ticket && `Ticket: ${l.ticket}`,
    l.note_lettura && `Da controllare sul foglio: ${l.note_lettura}`,
  ].filter(Boolean) as string[];
  if (note.length) campi.note = unisci(imp.note, note);
  if (!imp.titolo && l.prestazione) campi.titolo = l.prestazione;
  campi.stato = "prenotato";
  return campi;
}

