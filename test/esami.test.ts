import { test } from "node:test";
import assert from "node:assert/strict";
import { chiave, confronta, esamiDelSangue, numero } from "../src/lib/esami.ts";

const doc = (id: string, data: string, valori: [string, string, ("alto" | "basso" | "")?][], tipo = "Esami del sangue") => ({
  id, titolo: "Esami", tipo, specialita: "Laboratorio analisi", data, note: "", file_path: null, file_tipo: "", impegno_id: null,
  valori: valori.map(([nome, valore, fuori = ""]) => ({ nome, valore, unita: "", riferimento: "", fuori })),
});

test("esami: nomi confrontabili e numeri all'italiana", () => {
  assert.equal(chiave("Emoglobina Glicata (HbA1c)"), "emoglobina glicata");
  assert.equal(chiave("Creatinina  "), chiave("CREATININA"));
  assert.equal(numero("7,4"), 7.4);
  assert.equal(numero("< 0,5"), 0.5);
  assert.equal(numero("negativo"), null);
});

test("esami: il più recente in cima, confronto con il precedente che ha quel valore", () => {
  const vecchio = doc("a", "2026-03-01", [["Glicata", "7,8"], ["Ferritina", "40"]]);
  const medio = doc("b", "2026-07-01", [["Glicata", "7,4"]]);
  const nuovo = doc("c", "2026-11-01", [["Emoglobina glicata", "7,4", "alto"], ["Ferritina", "25", "basso"], ["Sodio", "140"]]);
  const altro = doc("x", "2026-12-01", [["Glicata", "9"]], "Referto");
  const lista = esamiDelSangue([vecchio, altro, nuovo, medio]);
  assert.deepEqual(lista.map((d) => d.id), ["c", "b", "a"]);
  const r = confronta(lista[0], lista.slice(1));
  // "Emoglobina glicata" non è uguale a "Glicata": nessun confronto inventato
  assert.deepEqual(r.map((x) => [x.nome, x.prima ?? "-", x.andamento]), [
    ["Emoglobina glicata", "-", ""],
    ["Ferritina", "40", "giu"],
    ["Sodio", "-", ""],
  ]);
  const r2 = confronta(medio, [vecchio]);
  assert.deepEqual(r2.map((x) => [x.prima, x.andamento]), [["7,8", "giu"]]);
});
