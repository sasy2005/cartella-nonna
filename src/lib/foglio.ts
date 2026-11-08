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
export function daFoglio(l: LetturaPrenotazione, imp: Partial<Impegno>): Partial<Impegno> {
  const campi: Partial<Impegno> = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(l.data)) {
    const ora = /^\d{1,2}:\d{2}$/.test(l.ora) ? l.ora.padStart(5, "0") : "08:00";
    campi.data = new Date(`${l.data}T${ora}`).toISOString();
  }
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
    l.codice_prenotazione && `Codice prenotazione: ${l.codice_prenotazione}`,
    l.ticket && `Ticket: ${l.ticket}`,
    l.note_lettura && `Da controllare sul foglio: ${l.note_lettura}`,
  ].filter(Boolean) as string[];
  if (note.length) campi.note = unisci(imp.note, note);
  if (!imp.titolo && l.prestazione) campi.titolo = l.prestazione;
  campi.stato = "prenotato";
  return campi;
}

