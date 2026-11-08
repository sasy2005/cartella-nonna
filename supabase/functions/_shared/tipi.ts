// Tipi condivisi tra l'app (browser) e le funzioni server (Deno).
// Nessun import esterno: questo file deve funzionare in entrambi gli ambienti.

export const SPECIALITA = [
  "Medicina generale",
  "Neurologia",
  "Diabetologia",
  "Cardiologia",
  "Ematologia",
  "Epatologia",
  "Nefrologia",
  "Laboratorio analisi",
  "Radiologia / Ecografia",
  "Oculistica",
  "Altro",
] as const;
export type Specialita = (typeof SPECIALITA)[number] | string;

export const COLORE_SPECIALITA: Record<string, string> = {
  "Medicina generale": "#64748b",
  Neurologia: "#7c3aed",
  Diabetologia: "#dc2626",
  Cardiologia: "#ea580c",
  Ematologia: "#be123c",
  Epatologia: "#a16207",
  Nefrologia: "#0891b2",
  "Laboratorio analisi": "#0f766e",
  "Radiologia / Ecografia": "#4f46e5",
  Oculistica: "#15803d",
  Altro: "#78716c",
};

export type Priorita = "U" | "B" | "D" | "P";
export const PRIORITA: Record<Priorita, string> = {
  U: "Urgente: entro 72 ore",
  B: "Breve: entro 10 giorni",
  D: "Differibile: entro 30 giorni (visite) o 60 (esami)",
  P: "Programmata: entro 120 giorni",
};

export type TipoImpegno = "visita" | "esame";
export type StatoImpegno = "da_prenotare" | "prenotato" | "fatto" | "annullato";

/** Una visita o un esame: dalla ricetta fino al referto ritirato. */
export interface Impegno {
  id: string;
  tipo: TipoImpegno;
  titolo: string;
  specialita: Specialita;
  stato: StatoImpegno;
  /** Data e ora dell'appuntamento (ISO), se prenotato. */
  data: string | null;
  luogo: string;
  /** Struttura dove è prenotato. */
  contatto_id: string | null;
  preparazione: string;
  portare: string;
  /** Per gli esami: la visita per cui servono i risultati. */
  per_visita_id: string | null;
  /** Data limite scelta a mano (YYYY-MM-DD). */
  entro: string | null;
  /** Giorni dopo l'esame in cui il referto è pronto da ritirare (0 = subito). */
  giorni_referto: number;
  referto_ritirato: boolean;
  nre: string;
  priorita: Priorita | null;
  data_ricetta: string | null;
  scadenza_ricetta: string | null;
  prescrittore: string;
  ricetta_path: string | null;
  note: string;
  /** Documenti dell'archivio da portare alla visita (id). */
  documenti_da_portare: string[];
  created_at?: string;
}

export interface Chiamata {
  id: string;
  impegno_id: string;
  contatto_id: string | null;
  quando: string;
  esito: string;
  richiamare_il: string | null;
}

export interface Contatto {
  id: string;
  nome: string;
  tipo: "medico" | "struttura";
  specialita: Specialita;
  telefono: string;
  email: string;
  orari: string;
  sito: string;
  note: string;
}

export interface Documento {
  id: string;
  titolo: string;
  tipo: string;
  specialita: Specialita;
  data: string;
  note: string;
  file_path: string | null;
  file_tipo: string;
  impegno_id: string | null;
}

export const MOMENTI = ["colazione", "pranzo", "cena", "sera"] as const;
export type Momento = (typeof MOMENTI)[number];
export const NOME_MOMENTO: Record<Momento, string> = { colazione: "Colazione", pranzo: "Pranzo", cena: "Cena", sera: "Sera" };

export interface Farmaco {
  id: string;
  nome: string;
  /** Istruzioni libere (es. "dopo la glicemia", "a stomaco pieno"). */
  quando: string;
  /** Quante pillole in ogni momento della giornata. */
  momenti: Partial<Record<Momento, number>>;
  /** Compresse (o unità) al giorno. */
  per_giorno: number;
  /** Quante ce n'erano in casa il giorno `scorta_al`. */
  scorta: number;
  scorta_al: string;
  note: string;
  attivo: boolean;
}

export interface PassoPratica {
  id: string;
  testo: string;
  fatto: boolean;
}

export interface Pratica {
  id: string;
  titolo: string;
  passi: PassoPratica[];
  note: string;
}

export interface Profilo {
  nome: string;
  nascita: string;
  cf: string;
  tessera: string;
  esenzioni: string;
  medico: string;
  indirizzo: string;
  disponibilita: string;
  note: string;
}

export interface Dati {
  profilo: Profilo;
  impegni: Impegno[];
  chiamate: Chiamata[];
  contatti: Contatto[];
  documenti: Documento[];
  farmaci: Farmaco[];
  pratiche: Pratica[];
}

export const PROFILO_VUOTO: Profilo = {
  nome: "",
  nascita: "",
  cf: "",
  tessera: "",
  esenzioni: "",
  medico: "",
  indirizzo: "",
  disponibilita: "",
  note: "",
};

/** Pillole al giorno: la somma dei momenti, o il valore salvato per i farmaci vecchi. */
export function alGiorno(f: Pick<Farmaco, "momenti" | "per_giorno">): number {
  const somma = MOMENTI.reduce((t, m) => t + (Number(f.momenti?.[m]) || 0), 0);
  return somma > 0 ? somma : Number(f.per_giorno) || 0;
}
