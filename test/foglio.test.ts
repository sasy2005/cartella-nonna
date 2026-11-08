import { test } from "node:test";
import assert from "node:assert/strict";
import { daFoglio } from "../src/lib/foglio.ts";

const L = (p: Record<string, unknown>) => ({ data: "", ora: "", prestazione: "", struttura: "", indirizzo: "", reparto: "", preparazione: [], portare: [], codice_prenotazione: "", ticket: "", note_lettura: "", ...p }) as never;

test("foglio: data e ora diventano l'appuntamento (ora italiana)", () => {
  process.env.TZ = "Europe/Rome";
  const c = daFoglio(L({ data: "2026-12-03", ora: "9:30" }), {});
  assert.equal(new Date(c.data!).toLocaleString("it-IT", { timeZone: "Europe/Rome" }), "03/12/2026, 09:30:00");
  assert.equal(c.stato, "prenotato");
});

test("foglio: luogo composto, istruzioni e cose da portare senza doppioni", () => {
  const c = daFoglio(
    L({ data: "2026-12-03", ora: "08:15", struttura: "Ospedale Niguarda", reparto: "Padiglione 3, piano 1", indirizzo: "Piazza Ospedale Maggiore 3, Milano", preparazione: ["Digiuno da 8 ore", "digiuno da 8 ore"], portare: ["Impegnativa", "Tessera sanitaria"], codice_prenotazione: "PR-123", ticket: "36,15 €" }),
    { portare: "Tessera sanitaria\nLista farmaci", note: "Accompagna la mamma" },
  );
  assert.equal(c.luogo, "Ospedale Niguarda, Padiglione 3, piano 1, Piazza Ospedale Maggiore 3, Milano");
  assert.equal(c.preparazione, "Digiuno da 8 ore");
  assert.equal(c.portare, undefined); // dal foglio solo cose scontate: quello che c era resta com era
  assert.equal(c.note, "Accompagna la mamma\nCodice prenotazione: PR-123\nTicket: 36,15 €");
});

test("foglio: senza data non inventa niente, il titolo esistente non viene sovrascritto", () => {
  const c = daFoglio(L({ prestazione: "Ecografia", ora: "10:00" }), { titolo: "Ecografia addome completo" });
  assert.equal(c.data, undefined);
  assert.equal(c.titolo, undefined);
  assert.equal(daFoglio(L({ prestazione: "Ecografia" }), {}).titolo, "Ecografia");
  assert.equal(daFoglio(L({ data: "3/12/2026" }), {}).data, undefined); // formato sbagliato: niente data
});

test("foglio: non copia tessera, impegnativa e documentazione precedente", () => {
  const c = daFoglio(L({ portare: ["Impegnativa del medico curante", "Tessera sanitaria", "Documentazione clinica precedente", "Ultimo ECG"] }), {});
  assert.equal(c.portare, "Ultimo ECG");
  assert.equal(daFoglio(L({ portare: ["Tessera sanitaria"] }), {}).portare, undefined);
});
