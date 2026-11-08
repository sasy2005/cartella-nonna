// Date sempre nel fuso orario italiano, sia nel browser sia sul server (che gira in UTC).
// Un "giorno" è una stringa YYYY-MM-DD.

export const FUSO = "Europe/Rome";

const fmtGiorno = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function giornoDi(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return fmtGiorno.format(d);
}

export function oggi(adesso: Date = new Date()): string {
  return giornoDi(adesso);
}

function utc(giorno: string): number {
  const [y, m, d] = giorno.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function aggiungiGiorni(giorno: string, n: number): string {
  const d = new Date(utc(giorno) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

export function aggiungiMesi(giorno: string, n: number): string {
  const [y, m, d] = giorno.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, ultimo));
  return t.toISOString().slice(0, 10);
}

/** Quanti giorni da `da` a `a` (positivo se `a` è dopo). */
export function diffGiorni(da: string, a: string): number {
  return Math.round((utc(a) - utc(da)) / 86400000);
}

export function oraDi(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

/** "lunedì 9 novembre" */
export function giornoEsteso(giorno: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(utc(giorno)),
  );
}

/** "9 nov" (con l'anno se diverso da quello di riferimento) */
export function giornoBreve(giorno: string, riferimento: string = oggi()): string {
  const stessoAnno = riferimento.slice(0, 4) === giorno.slice(0, 4);
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(stessoAnno ? {} : { year: "numeric" }),
  }).format(new Date(utc(giorno)));
}

/** "oggi", "domani", "tra 5 giorni", "3 giorni fa" */
export function relativo(da: string, a: string): string {
  const n = diffGiorni(da, a);
  if (n === 0) return "oggi";
  if (n === 1) return "domani";
  if (n === -1) return "ieri";
  if (n > 1) return `tra ${n} giorni`;
  return `${-n} giorni fa`;
}

/** Il giorno della settimana (1 = lunedì … 7 = domenica). */
export function giornoSettimana(giorno: string): number {
  const d = new Date(utc(giorno)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** L'ora (0-23) adesso in Italia. */
export function oraItaliana(adesso: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" }).format(adesso));
}
