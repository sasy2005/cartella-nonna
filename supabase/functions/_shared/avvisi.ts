// Il "cervello" dell'app: decide cosa ricordare oggi.
// Usato sia dalla schermata "Oggi" sia dal messaggio WhatsApp del mattino.

import type { Chiamata, Dati, Farmaco, Impegno } from "./tipi.ts";
import { alGiorno } from "./tipi.ts";
import { aggiungiGiorni, diffGiorni, giornoBreve, giornoDi, oraDi, relativo } from "./date.ts";

/** Margine tra il ritiro del referto e la visita, per non arrivare al limite. */
export const MARGINE_GIORNI = 2;

export type Livello = "urgente" | "attenzione" | "info";
export type Categoria = "visita" | "prenotare" | "richiamare" | "ritiro" | "ricetta" | "farmaco";

export interface Avviso {
  id: string;
  livello: Livello;
  categoria: Categoria;
  titolo: string;
  dettaglio: string[];
  impegno_id?: string;
  farmaco_id?: string;
  /** Per ordinare: il giorno a cui si riferisce. */
  giorno: string;
}

export interface Scadenza {
  giorno: string;
  motivo: string;
}

/** Entro quando va FATTO un impegno da prenotare, e perché. */
export function scadenzaDi(imp: Impegno, dati: Pick<Dati, "impegni">): Scadenza | null {
  const candidati: Scadenza[] = [];
  if (imp.per_visita_id) {
    const v = dati.impegni.find((x) => x.id === imp.per_visita_id);
    const giornoVisita = v?.data ? giornoDi(v.data) : v?.entro ?? null;
    if (v && giornoVisita) {
      const g = aggiungiGiorni(giornoVisita, -(Number(imp.giorni_referto) || 0) - MARGINE_GIORNI);
      candidati.push({
        giorno: g,
        motivo: `serve per ${v.titolo.toLowerCase()} del ${giornoBreve(giornoVisita)}`,
      });
    }
  }
  if (imp.entro) candidati.push({ giorno: imp.entro, motivo: "data limite" });
  if (imp.data_ricetta && (imp.priorita === "U" || imp.priorita === "B")) {
    candidati.push({
      giorno: aggiungiGiorni(imp.data_ricetta, imp.priorita === "U" ? 3 : 10),
      motivo: `priorità ${imp.priorita} sulla ricetta`,
    });
  }
  if (!candidati.length) return null;
  return candidati.reduce((a, b) => (b.giorno < a.giorno ? b : a));
}

export interface CosaPortare {
  testo: string;
  /** nota = scritta a mano, archivio = documento scelto, esame = risultati di un esame collegato */
  fonte: "nota" | "archivio" | "esame";
  /** Documento in archivio, se c'è. */
  documento_id?: string;
  /** false = manca ancora (es. esame non fatto o referto non caricato). */
  pronto: boolean;
}

/** Tutto quello da portare a una visita: note scritte, documenti scelti e risultati degli esami collegati. */
export function cosaPortare(imp: Impegno, dati: Pick<Dati, "impegni" | "documenti">): CosaPortare[] {
  const out: CosaPortare[] = righe(imp.portare).map((t) => ({ testo: t, fonte: "nota" as const, pronto: true }));
  for (const id of imp.documenti_da_portare ?? []) {
    const d = dati.documenti.find((x) => x.id === id);
    if (d) out.push({ testo: d.titolo, fonte: "archivio", documento_id: d.id, pronto: true });
  }
  for (const e of dati.impegni.filter((x) => x.per_visita_id === imp.id && x.stato !== "annullato")) {
    const ref = dati.documenti.find((d) => d.impegno_id === e.id);
    if ((imp.documenti_da_portare ?? []).includes(ref?.id ?? "")) continue;
    out.push({
      testo: "Risultati: " + e.titolo,
      fonte: "esame",
      documento_id: ref?.id,
      pronto: Boolean(ref) || (e.stato === "fatto" && e.referto_ritirato),
    });
  }
  return out;
}

/** Giorno da cui il referto è ritirabile (solo per impegni fatti con ritiro). */
export function ritiroDi(imp: Impegno): string | null {
  if (imp.stato !== "fatto" || imp.referto_ritirato || !(Number(imp.giorni_referto) > 0) || !imp.data) return null;
  return aggiungiGiorni(giornoDi(imp.data), Number(imp.giorni_referto));
}

export function chiamateDi(impegnoId: string, chiamate: Chiamata[]): Chiamata[] {
  return chiamate.filter((c) => c.impegno_id === impegnoId).sort((a, b) => a.quando.localeCompare(b.quando));
}

export function scortaAttuale(f: Farmaco, giorno: string): number {
  const passati = Math.max(0, diffGiorni(f.scorta_al, giorno));
  return Math.max(0, Number(f.scorta) - alGiorno(f) * passati);
}

/** Giorni di farmaco rimasti, o null se non si conta. */
export function giorniRimasti(f: Farmaco, giorno: string): number | null {
  const n = alGiorno(f);
  if (!f.attivo || !(n > 0)) return null;
  return Math.floor(scortaAttuale(f, giorno) / n);
}

function righe(s: string): string[] {
  return (s || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

const PESO: Record<Livello, number> = { urgente: 0, attenzione: 1, info: 2 };

export function calcolaAvvisi(dati: Dati, g: string): Avviso[] {
  const out: Avviso[] = [];
  const nomeContatto = (id: string | null) => dati.contatti.find((c) => c.id === id)?.nome;

  for (const imp of dati.impegni) {
    // 1. Appuntamenti dei prossimi 2 giorni, con la preparazione.
    if (imp.stato === "prenotato" && imp.data) {
      const gv = giornoDi(imp.data);
      const n = diffGiorni(g, gv);
      if (n >= 0 && n <= 2) {
        const det = [...righe(imp.preparazione)];
        const port = cosaPortare(imp, dati);
        if (port.length) det.push("Portare: " + port.map((p) => p.testo).join(", "));
        const mancanti = port.filter((p) => !p.pronto);
        if (mancanti.length) det.push("⚠ Manca ancora: " + mancanti.map((p) => p.testo.replace(/^Risultati: /, "")).join(", "));
        const dove = imp.luogo || nomeContatto(imp.contatto_id);
        if (dove) det.unshift(dove);
        out.push({
          id: "visita-" + imp.id,
          livello: n <= 1 ? "urgente" : "attenzione",
          categoria: "visita",
          titolo: `${cap(relativo(g, gv))} alle ${oraDi(imp.data)}: ${imp.titolo}`,
          dettaglio: det,
          impegno_id: imp.id,
          giorno: gv,
        });
      }
    }

    if (imp.stato === "da_prenotare") {
      const storico = chiamateDi(imp.id, dati.chiamate);
      const ultima = storico[storico.length - 1];

      // 2. Richiamare oggi (dopo un "nessun posto").
      if (ultima?.richiamare_il && ultima.richiamare_il <= g) {
        const dove = nomeContatto(ultima.contatto_id);
        out.push({
          id: "richiamare-" + imp.id,
          livello: "urgente",
          categoria: "richiamare",
          titolo: `Richiamare${dove ? " " + dove : ""} per ${imp.titolo}`,
          dettaglio: [
            `Ultima chiamata ${relativo(g, giornoDi(ultima.quando))}: ${ultima.esito || "nessun posto"}`,
            `Chiamate fatte finora: ${storico.length}`,
          ],
          impegno_id: imp.id,
          giorno: ultima.richiamare_il,
        });
      }

      // 3. Da prenotare con scadenza vicina.
      const sc = scadenzaDi(imp, dati);
      if (sc) {
        const n = diffGiorni(g, sc.giorno);
        const livello: Livello | null = n <= 14 ? "urgente" : n <= 30 ? "attenzione" : null;
        if (livello && !out.some((a) => a.id === "richiamare-" + imp.id)) {
          out.push({
            id: "prenotare-" + imp.id,
            livello,
            categoria: "prenotare",
            titolo:
              n < 0
                ? `In ritardo: ${imp.titolo} andava fatto entro il ${giornoBreve(sc.giorno, g)}`
                : `Prenotare ${imp.titolo}: da fare entro il ${giornoBreve(sc.giorno, g)}`,
            dettaglio: [
              cap(sc.motivo),
              ...(n < 0 ? ["Valuta se spostare la visita o chiedere al medico"] : []),
              ...(storico.length ? [`Già chiamato ${storico.length} ${storico.length === 1 ? "volta" : "volte"}`] : []),
            ],
            impegno_id: imp.id,
            giorno: sc.giorno,
          });
        }
      }

      // 4. Ricetta in scadenza.
      if (imp.scadenza_ricetta) {
        const n = diffGiorni(g, imp.scadenza_ricetta);
        if (n <= 30) {
          out.push({
            id: "ricetta-" + imp.id,
            livello: n <= 7 ? "urgente" : "attenzione",
            categoria: "ricetta",
            titolo:
              n < 0
                ? `Ricetta scaduta: ${imp.titolo}`
                : `La ricetta per ${imp.titolo} scade ${relativo(g, imp.scadenza_ricetta)}`,
            dettaglio: [n < 0 ? "Chiedi al medico di rifarla" : "Prenota prima della scadenza o chiedi di rifarla"],
            impegno_id: imp.id,
            giorno: imp.scadenza_ricetta,
          });
        }
      }
    }

    // 5. Referti da ritirare.
    const rit = ritiroDi(imp);
    if (rit) {
      const n = diffGiorni(g, rit);
      if (n <= 1) {
        out.push({
          id: "ritiro-" + imp.id,
          livello: n <= 0 ? "attenzione" : "info",
          categoria: "ritiro",
          titolo:
            n <= 0
              ? `Referto da ritirare: ${imp.titolo}`
              : `Domani si può ritirare il referto: ${imp.titolo}`,
          dettaglio: [imp.luogo || nomeContatto(imp.contatto_id) || ""].filter(Boolean),
          impegno_id: imp.id,
          giorno: rit,
        });
      }
    }
  }

  // 6. Farmaci in esaurimento.
  for (const f of dati.farmaci) {
    const rim = giorniRimasti(f, g);
    if (rim === null || rim > 10) continue;
    out.push({
      id: "farmaco-" + f.id,
      livello: rim <= 5 ? "urgente" : "attenzione",
      categoria: "farmaco",
      titolo: rim <= 0 ? `${f.nome} è finito` : `${f.nome} finisce tra ${rim} ${rim === 1 ? "giorno" : "giorni"}`,
      dettaglio: [`Chiedi la ricetta al medico (circa il ${giornoBreve(aggiungiGiorni(g, rim), g)} resta senza)`],
      farmaco_id: f.id,
      giorno: aggiungiGiorni(g, rim),
    });
  }

  return out.sort((a, b) => PESO[a.livello] - PESO[b.livello] || a.giorno.localeCompare(b.giorno));
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Testo del messaggio WhatsApp del mattino. Null se non c'è niente da dire. */
export function testoPromemoria(dati: Dati, g: string): string | null {
  const avvisi = calcolaAvvisi(dati, g).filter((a) => a.livello !== "info" || a.categoria === "ritiro");
  if (!avvisi.length) return null;
  const icona: Record<Categoria, string> = {
    visita: "📅",
    prenotare: "📞",
    richiamare: "🔁",
    ritiro: "📄",
    ricetta: "🧾",
    farmaco: "💊",
  };
  const nome = dati.profilo.nome ? ` (${dati.profilo.nome})` : "";
  const corpo = avvisi
    .slice(0, 12)
    .map((a) => {
      const det = a.dettaglio.slice(0, 3).map((d) => "   · " + d);
      return [`${icona[a.categoria]} ${a.livello === "urgente" ? "*" + a.titolo + "*" : a.titolo}`, ...det].join("\n");
    })
    .join("\n\n");
  const extra = avvisi.length > 12 ? `\n\n…e altre ${avvisi.length - 12} cose nell'app.` : "";
  return `Buongiorno! Cose da fare per la nonna${nome}:\n\n${corpo}${extra}`;
}

/** Titolo e testo della notifica del mattino. Null se non c'è niente da dire. */
export function notificaPromemoria(dati: Dati, g: string): { titolo: string; testo: string } | null {
  const avvisi = calcolaAvvisi(dati, g).filter((a) => a.livello !== "info" || a.categoria === "ritiro");
  if (!avvisi.length) return null;
  const n = avvisi.length;
  const righe = avvisi.slice(0, 4).map((a) => "• " + a.titolo);
  if (n > 4) righe.push(`…e altre ${n - 4}`);
  return { titolo: `${n} ${n === 1 ? "cosa da fare" : "cose da fare"} per la nonna`, testo: righe.join("\n") };
}
