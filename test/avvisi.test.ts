import { test } from "node:test";
import assert from "node:assert/strict";
import { calcolaAvvisi, scadenzaDi, giorniRimasti, ritiroDi, testoPromemoria, notificaPromemoria } from "../supabase/functions/_shared/avvisi.ts";
import { aggiungiMesi, giornoDi, diffGiorni } from "../supabase/functions/_shared/date.ts";
import type { Dati, Impegno } from "../supabase/functions/_shared/tipi.ts";
import { PROFILO_VUOTO } from "../supabase/functions/_shared/tipi.ts";

const OGGI = "2026-11-07";

function imp(p: Partial<Impegno>): Impegno {
  return {
    id: Math.random().toString(36).slice(2),
    tipo: "esame",
    titolo: "Esame",
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
    ...p,
  };
}
function dati(p: Partial<Dati>): Dati {
  return { profilo: PROFILO_VUOTO, impegni: [], chiamate: [], contatti: [], documenti: [], farmaci: [], ...p };
}

test("date: fuso italiano e mesi", () => {
  assert.equal(giornoDi("2026-11-07T23:30:00Z"), "2026-11-08"); // mezzanotte e mezza in Italia
  assert.equal(aggiungiMesi("2026-08-31", 6), "2027-02-28");
  assert.equal(diffGiorni("2026-03-28", "2026-03-30"), 2); // cambio ora legale
});

test("esame per una visita: scadenza calcolata all'indietro", () => {
  const visita = imp({ id: "v", tipo: "visita", titolo: "Visita cardiologica", stato: "prenotato", data: "2026-12-15T09:00:00+01:00" });
  const eco = imp({ titolo: "Ecocardiogramma", per_visita_id: "v", giorni_referto: 7 });
  const sc = scadenzaDi(eco, { impegni: [visita, eco] });
  assert.equal(sc?.giorno, "2026-12-06"); // 15 - 7 - 2
  assert.match(sc!.motivo, /visita cardiologica/);
});

test("la scadenza più vicina vince", () => {
  const e = imp({ entro: "2026-12-30", priorita: "B", data_ricetta: "2026-11-05" });
  assert.equal(scadenzaDi(e, { impegni: [e] })?.giorno, "2026-11-15");
});

test("avvisi: richiamare, prenotare, ritiro, farmaci, visita domani", () => {
  const visita = imp({ id: "v", tipo: "visita", titolo: "Visita ematologica", stato: "prenotato", data: "2026-11-08T08:30:00Z", preparazione: "Digiuno dalla mezzanotte" });
  const sangue = imp({ id: "s", titolo: "Esami del sangue", per_visita_id: "v" });
  const eco = imp({ id: "e", titolo: "Ecografia addome", entro: "2026-11-30" });
  const fatta = imp({ id: "f", titolo: "Ecografia renale", stato: "fatto", data: "2026-10-30T10:00:00Z", giorni_referto: 7 });
  const d = dati({
    impegni: [visita, sangue, eco, fatta],
    chiamate: [{ id: "c", impegno_id: "e", contatto_id: null, quando: "2026-11-04T09:00:00Z", esito: "Nessun posto", richiamare_il: "2026-11-07" }],
    farmaci: [{ id: "m", nome: "Metformina", quando: "", per_giorno: 2, scorta: 20, scorta_al: "2026-11-01", note: "", attivo: true }],
  });
  const a = calcolaAvvisi(d, OGGI);
  const ids = a.map((x) => x.id);
  assert.ok(ids.includes("visita-v"));
  assert.ok(ids.includes("prenotare-s")); // in ritardo
  assert.ok(ids.includes("richiamare-e"));
  assert.ok(!ids.includes("prenotare-e")); // già coperto da "richiamare"
  assert.ok(ids.includes("ritiro-f"));
  assert.ok(ids.includes("farmaco-m"));
  assert.equal(giorniRimasti(d.farmaci[0], OGGI), 4);
  assert.equal(ritiroDi(fatta), "2026-11-06");
  assert.ok(a.every((x, i) => i === 0 || ["urgente", "attenzione", "info"].indexOf(a[i - 1].livello) <= ["urgente", "attenzione", "info"].indexOf(x.livello)));
  const t = testoPromemoria(d, OGGI)!;
  assert.match(t, /Digiuno/);
  assert.match(t, /Metformina/);
  const n = notificaPromemoria(d, OGGI)!;
  assert.match(n.titolo, /^\d+ cose da fare per la nonna$/);
  assert.ok(n.testo.split("\n").length <= 5);
});

test("nessun avviso = nessun messaggio", () => {
  assert.equal(testoPromemoria(dati({}), OGGI), null);
  assert.equal(notificaPromemoria(dati({}), OGGI), null);
});
