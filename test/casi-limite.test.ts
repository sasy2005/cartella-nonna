// Casi limite dei calcoli: date, scadenze, scorte, promemoria.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcolaAvvisi, cosaPortare, giorniRimasti, notificaPromemoria, ritiroDi, scadenzaDi, scortaAttuale, testoPromemoria } from "../supabase/functions/_shared/avvisi.ts";
import { aggiungiGiorni, aggiungiMesi, diffGiorni, giornoBreve, giornoDi, giornoSettimana, oraItaliana, relativo } from "../supabase/functions/_shared/date.ts";
import { PROFILO_VUOTO, alGiorno, type Dati, type Farmaco, type Impegno } from "../supabase/functions/_shared/tipi.ts";

let n = 0;
function imp(p: Partial<Impegno>): Impegno {
  return {
    id: "i" + n++, tipo: "esame", titolo: "Esame", specialita: "Altro", stato: "da_prenotare", data: null, luogo: "", contatto_id: null,
    preparazione: "", portare: "", per_visita_id: null, entro: null, giorni_referto: 0, referto_ritirato: false, nre: "", priorita: null,
    data_ricetta: null, scadenza_ricetta: null, prescrittore: "", ricetta_path: null, note: "", documenti_da_portare: [], ...p,
  };
}
function farmaco(p: Partial<Farmaco>): Farmaco {
  return { id: "f" + n++, nome: "F", quando: "", momenti: {}, per_giorno: 0, scorta: 0, scorta_al: "2026-11-01", note: "", attivo: true, ...p };
}
const dati = (p: Partial<Dati>): Dati => ({ profilo: PROFILO_VUOTO, impegni: [], chiamate: [], contatti: [], documenti: [], farmaci: [], pratiche: [], ...p });
const ids = (d: Dati, g: string) => calcolaAvvisi(d, g).map((a) => a.id);

test("date: fine anno, bisestile, settimana, ore italiane", () => {
  assert.equal(aggiungiGiorni("2026-12-30", 3), "2027-01-02");
  assert.equal(diffGiorni("2026-12-31", "2027-01-01"), 1);
  assert.equal(aggiungiGiorni("2028-02-28", 1), "2028-02-29");
  assert.equal(aggiungiMesi("2026-01-31", 1), "2026-02-28");
  assert.equal(aggiungiMesi("2026-10-28", 6), "2027-04-28");
  assert.equal(giornoSettimana("2026-11-08"), 7); // domenica
  assert.equal(giornoSettimana("2026-11-09"), 1); // lunedì
  assert.equal(relativo("2026-11-08", "2026-11-06"), "2 giorni fa");
  assert.equal(giornoBreve("2027-01-05", "2026-11-08"), "5 gen 2027");
  assert.equal(giornoDi("2026-03-29T00:30:00Z"), "2026-03-29"); // notte del cambio ora
  assert.equal(oraItaliana(new Date("2026-03-29T05:00:00Z")), 7); // primo giorno di ora legale
  assert.equal(oraItaliana(new Date("2026-10-25T06:00:00Z")), 7); // primo giorno di ora solare
});

test("ricetta: scaduta, in scadenza, lontana", () => {
  const g = "2026-11-08";
  assert.ok(ids(dati({ impegni: [imp({ id: "a", scadenza_ricetta: "2026-11-01" })] }), g).includes("ricetta-a"));
  const vicina = calcolaAvvisi(dati({ impegni: [imp({ id: "b", scadenza_ricetta: "2026-11-12" })] }), g).find((a) => a.id === "ricetta-b");
  assert.equal(vicina?.livello, "urgente");
  assert.ok(!ids(dati({ impegni: [imp({ id: "c", scadenza_ricetta: "2027-04-26" })] }), g).includes("ricetta-c"));
  // ricetta già prenotata: niente avviso di scadenza
  assert.ok(!ids(dati({ impegni: [imp({ id: "d", stato: "prenotato", data: "2026-12-01T09:00:00Z", scadenza_ricetta: "2026-11-10" })] }), g).includes("ricetta-d"));
});

test("visite: avviso solo nei 2 giorni prima, livelli giusti, annullate ignorate", () => {
  const g = "2026-11-08";
  const v = (id: string, giorno: string, stato: Impegno["stato"] = "prenotato") => imp({ id, tipo: "visita", stato, data: giorno + "T09:00:00+01:00" });
  const a = calcolaAvvisi(dati({ impegni: [v("oggi", "2026-11-08"), v("dopodomani", "2026-11-10"), v("tre", "2026-11-11"), v("ieri", "2026-11-07"), v("annullata", "2026-11-09", "annullato")] }), g);
  const lv = Object.fromEntries(a.map((x) => [x.id, x.livello]));
  assert.equal(lv["visita-oggi"], "urgente");
  assert.equal(lv["visita-dopodomani"], "attenzione");
  assert.ok(!("visita-tre" in lv) && !("visita-ieri" in lv) && !("visita-annullata" in lv));
});

test("da prenotare: senza scadenza nessun avviso; oltre 30 giorni nessun avviso; richiamata futura ignorata", () => {
  const g = "2026-11-08";
  assert.deepEqual(ids(dati({ impegni: [imp({ id: "x" })] }), g), []);
  assert.deepEqual(ids(dati({ impegni: [imp({ id: "y", entro: "2027-02-01" })] }), g), []);
  const d = dati({ impegni: [imp({ id: "z", entro: "2027-02-01" })], chiamate: [{ id: "c", impegno_id: "z", contatto_id: null, quando: "2026-11-07T09:00:00Z", esito: "nessun posto", richiamare_il: "2026-11-10" }] });
  assert.ok(!ids(d, g).includes("richiamare-z"));
  assert.ok(ids(d, "2026-11-10").includes("richiamare-z"));
});

test("esame per visita non ancora prenotata usa la data limite della visita", () => {
  const v = imp({ id: "v", tipo: "visita", entro: "2027-05-01" });
  const e = imp({ id: "e", per_visita_id: "v", giorni_referto: 3 });
  assert.equal(scadenzaDi(e, { impegni: [v, e] })?.giorno, "2027-04-26");
});

test("referti: ritirato o senza giorni → niente da ritirare", () => {
  assert.equal(ritiroDi(imp({ stato: "fatto", data: "2026-11-01T09:00:00Z", giorni_referto: 7, referto_ritirato: true })), null);
  assert.equal(ritiroDi(imp({ stato: "fatto", data: "2026-11-01T09:00:00Z", giorni_referto: 0 })), null);
  assert.equal(ritiroDi(imp({ stato: "prenotato", data: "2026-11-01T09:00:00Z", giorni_referto: 7 })), null);
});

test("farmaci: momenti, mezze pillole, scorta finita, sospesi, vecchi senza momenti", () => {
  const g = "2026-11-08";
  assert.equal(alGiorno(farmaco({ momenti: { colazione: 1, sera: 0.5 } })), 1.5);
  assert.equal(alGiorno(farmaco({ momenti: {}, per_giorno: 2 })), 2);
  const f = farmaco({ momenti: { colazione: 1, cena: 1 }, scorta: 10, scorta_al: "2026-11-01" });
  assert.equal(scortaAttuale(f, g), 0); // 7 giorni × 2 = 14 > 10: non va sotto zero
  assert.equal(giorniRimasti(f, g), 0);
  const a = calcolaAvvisi(dati({ farmaci: [f] }), g)[0];
  assert.match(a.titolo, /è finito/);
  assert.equal(giorniRimasti(farmaco({ attivo: false, momenti: { colazione: 1 }, scorta: 1 }), g), null);
  assert.equal(giorniRimasti(farmaco({ momenti: {}, per_giorno: 0, scorta: 5 }), g), null);
  // scorta inserita "nel futuro" (orologio sballato): non aumenta
  assert.equal(scortaAttuale(farmaco({ momenti: { colazione: 1 }, scorta: 10, scorta_al: "2026-11-20" }), g), 10);
});

test("cosa portare: un referto scelto a mano non viene ripetuto tra i risultati", () => {
  const v = imp({ id: "v", tipo: "visita", documenti_da_portare: ["d"] });
  const e = imp({ id: "e", per_visita_id: "v", stato: "fatto" });
  const doc = { id: "d", titolo: "Referto sangue", tipo: "Esami", specialita: "Altro", data: "2026-11-01", note: "", file_path: null, file_tipo: "", impegno_id: "e" };
  const p = cosaPortare(v, { impegni: [v, e], documenti: [doc] });
  assert.equal(p.length, 1);
  assert.equal(p[0].fonte, "archivio");
});

test("promemoria: molti avvisi vengono riassunti, ordine urgente → attenzione", () => {
  const g = "2026-11-08";
  const tanti = Array.from({ length: 15 }, (_, i) => farmaco({ id: "m" + i, nome: "Farmaco " + i, momenti: { colazione: 1 }, scorta: i % 2 ? 2 : 7, scorta_al: g }));
  const d = dati({ farmaci: tanti });
  const a = calcolaAvvisi(d, g);
  const primoAttenzione = a.findIndex((x) => x.livello === "attenzione");
  assert.ok(a.slice(0, primoAttenzione).every((x) => x.livello === "urgente"));
  assert.match(testoPromemoria(d, g)!, /e altre 3 cose nell'app/);
  const notif = notificaPromemoria(d, g)!;
  assert.equal(notif.titolo, "15 cose da fare per la nonna");
  assert.match(notif.testo, /…e altre 11$/);
});

test("cosa portare: le cose che si portano sempre non vengono ricordate", async () => {
  const { eScontato } = await import("../supabase/functions/_shared/avvisi.ts");
  for (const x of ["Tessera sanitaria", "Tessera Sanitaria/CRS", "Impegnativa del medico", "Prescrizione medica", "Ricetta", "Documento d'identità", "Carta d'identità", "Documentazione precedente", "Referti precedenti", "Esami precedenti", "Eventuale documentazione clinica precedente", "Documentazione sanitaria", "Codice fiscale"])
    assert.ok(eScontato(x), "doveva essere scontato: " + x);
  for (const x of ["Ultimo elettrocardiogramma", "Esami del sangue di settembre", "Lista farmaci", "Urine del mattino in contenitore sterile", "Referto ecografia 2025", "Holter precedente"])
    assert.ok(!eScontato(x), "non doveva essere scontato: " + x);
  const v = imp({ id: "v", tipo: "visita", portare: "Tessera sanitaria\nImpegnativa\nLista farmaci\nDocumentazione precedente" });
  assert.deepEqual(cosaPortare(v, { impegni: [v], documenti: [] }).map((p) => p.testo), ["Lista farmaci"]);
});

test("notifiche: solo nei giorni giusti (7, 2, 0 giorni prima)", async () => {
  const { avvisiDelGiorno } = await import("../supabase/functions/_shared/avvisi.ts");
  const ricetta = imp({ id: "r", scadenza_ricetta: "2026-12-01" });
  const quando = (g: string) => avvisiDelGiorno(dati({ impegni: [ricetta] }), g).map((a) => a.id);
  assert.deepEqual(quando("2026-11-24"), ["ricetta-r"]); // 7 giorni prima
  assert.deepEqual(quando("2026-11-25"), []); // 6 giorni prima: niente notifica
  assert.deepEqual(quando("2026-11-29"), ["ricetta-r"]); // 2 giorni prima
  assert.deepEqual(quando("2026-11-30"), []);
  assert.deepEqual(quando("2026-12-01"), ["ricetta-r"]); // il giorno stesso
  assert.deepEqual(quando("2026-12-08"), ["ricetta-r"]); // scaduta da una settimana
  const visita = imp({ id: "v", tipo: "visita", stato: "prenotato", data: "2026-12-10T09:00:00+01:00" });
  const giorniVisita = ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10"].map((g) => avvisiDelGiorno(dati({ impegni: [visita] }), g).length);
  assert.deepEqual(giorniVisita, [0, 1, 1, 1]); // 2 giorni prima, il giorno prima, il giorno stesso
  const f = (giorni: number) => farmaco({ id: "f", momenti: { colazione: 1 }, scorta: giorni, scorta_al: "2026-11-08" });
  assert.deepEqual([10, 7, 5, 2, 1, 0].map((n) => avvisiDelGiorno(dati({ farmaci: [f(n)] }), "2026-11-08").length), [0, 1, 0, 1, 0, 1]);
  // nella schermata Oggi invece si vede sempre
  assert.equal(calcolaAvvisi(dati({ farmaci: [f(5)] }), "2026-11-08").length, 1);
});
