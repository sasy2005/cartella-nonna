// Dati di esempio INVENTATI per la modalità prova.
// Ricalcano la situazione descritta dalla mamma: 6 specialisti, esami prima delle visite.
import type { Dati, Impegno } from "../../supabase/functions/_shared/tipi.ts";
import { aggiungiGiorni, oggi } from "../../supabase/functions/_shared/date.ts";

const id = () => crypto.randomUUID();

function quando(giorni: number, ora: string): string {
  return new Date(`${aggiungiGiorni(oggi(), giorni)}T${ora}:00`).toISOString();
}

function base(p: Partial<Impegno>): Impegno {
  return {
    id: id(),
    tipo: "esame",
    titolo: "",
    specialita: "Altro",
    stato: "da_prenotare",
    data: null,
    luogo: "",
    contatto_id: null,
    preparazione: "",
    portare: "",
    per_visita_id: null,
    entro: null,
    giorni_referto: 0,
    referto_ritirato: false,
    nre: "",
    priorita: null,
    data_ricetta: null,
    scadenza_ricetta: null,
    prescrittore: "",
    ricetta_path: null,
    note: "",
    documenti_da_portare: [],
    ...p,
  };
}

export function datiDemo(): Dati {
  const g = oggi();
  const cup = { id: id(), nome: "Prenotazioni Regione Lombardia", tipo: "struttura" as const, email: "", specialita: "Altro", telefono: "800 638 638", orari: "Da cellulare: 02 999 599", sito: "https://www.prenotasalute.regione.lombardia.it/", note: "Numero verde regionale. Si può prenotare anche online." };
  const osp = { id: id(), nome: "Ospedale (esempio)", tipo: "struttura" as const, email: "", specialita: "Altro", telefono: "02 0000 0001", orari: "CUP ospedale lun–ven 8–16", sito: "", note: "Esempio: il più vicino a casa." };
  const lab = { id: id(), nome: "Laboratorio prelievi (esempio)", tipo: "struttura" as const, email: "", specialita: "Laboratorio analisi", telefono: "02 0000 0002", orari: "Prelievi 7:30–10", sito: "", note: "Referti online dopo 3 giorni." };
  const mmg = { id: id(), nome: "Medico di base (esempio)", tipo: "medico" as const, specialita: "Medicina generale", telefono: "", email: "medico.esempio@example.com", orari: "Ricette per email, pronte in 2 giorni", sito: "", note: "" };
  const ema = { id: id(), nome: "Ematologo (esempio)", tipo: "medico" as const, email: "", specialita: "Ematologia", telefono: "02 0000 0004", orari: "", sito: "", note: "" };

  const visitaEma = base({ tipo: "visita", titolo: "Visita ematologica di controllo", specialita: "Ematologia", stato: "prenotato", data: quando(24, "10:30"), luogo: "Ospedale, ambulatorio ematologia", contatto_id: osp.id, portare: "Esami del sangue\nUltimo referto ematologico\nLista farmaci", prescrittore: "Medico di base" });
  const sangue = base({ titolo: "Esami del sangue (emocromo, ferritina)", specialita: "Laboratorio analisi", per_visita_id: visitaEma.id, giorni_referto: 3, nre: "0301A 4000000001", priorita: "D", data_ricetta: aggiungiGiorni(g, -10), scadenza_ricetta: aggiungiGiorni(g, 20), prescrittore: "Medico di base", preparazione: "Digiuno dalla mezzanotte (solo acqua)\nFare l'insulina dopo il prelievo, con la colazione" });
  const ecoAddome = base({ titolo: "Ecografia addome completo", specialita: "Radiologia / Ecografia", per_visita_id: visitaEma.id, giorni_referto: 7, nre: "0301A 4000000002", priorita: "P", data_ricetta: aggiungiGiorni(g, -14), prescrittore: "Ematologo", preparazione: "Digiuno da 6 ore\nBere 1 litro d'acqua un'ora prima e non urinare" });
  const visitaCardio = base({ tipo: "visita", titolo: "Visita cardiologica", specialita: "Cardiologia", stato: "prenotato", data: quando(1, "09:15"), luogo: "Poliambulatorio, piano 2", portare: "Elettrocardiogramma precedente\nLista farmaci", preparazione: "Prendere le pillole della pressione come sempre" });
  const ecgFatto = base({ titolo: "Ecocardiogramma", specialita: "Cardiologia", stato: "fatto", data: quando(-8, "11:00"), giorni_referto: 7, luogo: "Ospedale, cardiologia piano 1", contatto_id: osp.id });
  const visitaNeuro = base({ tipo: "visita", titolo: "Prima visita neurologica (memoria)", specialita: "Neurologia", entro: aggiungiGiorni(g, 40), nre: "0301A 4000000003", priorita: "D", data_ricetta: aggiungiGiorni(g, -5), prescrittore: "Medico di base", note: "Dopo questa visita chiedere al medico la documentazione per l'aggravamento." });
  const visitaNefro = base({ tipo: "visita", titolo: "Visita nefrologica", specialita: "Nefrologia", stato: "fatto", data: quando(-60, "15:00") });
  const visitaDiab = base({ tipo: "visita", titolo: "Controllo diabetologico", specialita: "Diabetologia", entro: aggiungiGiorni(g, 75), note: "Controllo ogni 6 mesi" });
  const glicata = base({ titolo: "Emoglobina glicata", specialita: "Laboratorio analisi", per_visita_id: visitaDiab.id, giorni_referto: 3, scadenza_ricetta: aggiungiGiorni(g, 50) });
  const epato = base({ tipo: "visita", titolo: "Visita epatologica", specialita: "Epatologia", stato: "prenotato", data: quando(45, "14:00"), luogo: "Ospedale, ambulatorio 4" });

  return {
    profilo: {
      nome: "Nonna (esempio)",
      nascita: "1940-03-12",
      cf: "XXXXXX40C52X000X",
      tessera: "80380 0000000000000000",
      esenzioni: "013 diabete (esempio)",
      medico: "Medico di base (esempio)",
      indirizzo: "",
      disponibilita: "Solo mattina. Serve qualcuno che accompagni (la mamma deve prendere permesso).",
      note: "",
    },
    contatti: [cup, osp, lab, mmg, ema],
    impegni: [visitaEma, sangue, ecoAddome, visitaCardio, ecgFatto, visitaNeuro, visitaNefro, visitaDiab, glicata, epato],
    chiamate: [
      { id: id(), impegno_id: ecoAddome.id, contatto_id: cup.id, quando: quando(-3, "09:10"), esito: "Primo posto a marzo, troppo tardi", richiamare_il: g },
      { id: id(), impegno_id: ecoAddome.id, contatto_id: osp.id, quando: quando(-3, "09:40"), esito: "Agende chiuse, riaprono a inizio mese", richiamare_il: aggiungiGiorni(g, 3) },
    ],
    documenti: [
      { id: id(), titolo: "Referto visita nefrologica", tipo: "Referto", specialita: "Nefrologia", data: aggiungiGiorni(g, -60), note: "Esempio senza foto. Controllo tra 1 anno.", file_path: null, file_tipo: "", impegno_id: visitaNefro.id },
      { id: id(), titolo: "Esami del sangue", tipo: "Esami", specialita: "Laboratorio analisi", data: aggiungiGiorni(g, -95), note: "Esempio senza foto.", file_path: null, file_tipo: "", impegno_id: null },
    ],
    farmaci: [
      { id: id(), nome: "Metformina 500 mg", quando: "Durante il pasto", momenti: { colazione: 1, cena: 1 }, per_giorno: 2, scorta: 30, scorta_al: aggiungiGiorni(g, -11), note: "Esempio", attivo: true },
      { id: id(), nome: "Insulina lenta (penna)", quando: "14 unità, dopo aver misurato la glicemia", momenti: { sera: 1 }, per_giorno: 1, scorta: 30, scorta_al: aggiungiGiorni(g, -5), note: "Contata in giorni", attivo: true },
      { id: id(), nome: "Ramipril 5 mg", quando: "", momenti: { colazione: 1 }, per_giorno: 1, scorta: 56, scorta_al: aggiungiGiorni(g, -10), note: "Esempio", attivo: true },
      { id: id(), nome: "Cardioaspirina 100 mg", quando: "", momenti: { pranzo: 1 }, per_giorno: 1, scorta: 30, scorta_al: aggiungiGiorni(g, -21), note: "Esempio", attivo: true },
    ],
    pratiche: [],
  };
}
