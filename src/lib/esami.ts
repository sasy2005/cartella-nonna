// Esami del sangue: confronto con quelli precedenti. Senza React: si può testare.
import { TIPO_ESAMI_SANGUE, type Documento, type Valore } from "../../supabase/functions/_shared/tipi.ts";

/** Nome confrontabile: minuscolo, senza accenti, spazi e simboli superflui. */
export function chiave(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "7,4" → 7.4; "< 0,5" → 0.5; "negativo" → null */
export function numero(v: string): number | null {
  const m = v.replace(/\s/g, "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function esamiDelSangue(documenti: Documento[]): Documento[] {
  return documenti.filter((d) => d.tipo === TIPO_ESAMI_SANGUE).sort((a, b) => b.data.localeCompare(a.data));
}

export interface Riga extends Valore {
  prima?: string;
  andamento: "su" | "giu" | "uguale" | "";
}

/** I valori dell'ultimo esame, con il confronto con l'esame precedente che li conteneva. */
export function confronta(ultimo: Documento, precedenti: Documento[]): Riga[] {
  return (ultimo.valori ?? []).map((v) => {
    const k = chiave(v.nome);
    const prec = precedenti.map((d) => (d.valori ?? []).find((x) => chiave(x.nome) === k)).find(Boolean);
    const a = numero(v.valore);
    const b = prec ? numero(prec.valore) : null;
    const andamento: Riga["andamento"] = a === null || b === null ? "" : a > b ? "su" : a < b ? "giu" : "uguale";
    return { ...v, prima: prec?.valore, andamento };
  });
}
