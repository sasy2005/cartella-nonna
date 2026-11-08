// Colori dell'app: ognuno sceglie il suo tema e l'aspetto (chiaro/scuro) sul proprio telefono.

export const TEMI = [
  { id: "prugna", nome: "Prugna", chiaro: "#7a2e6e", scuro: "#e3a6d6" },
  { id: "salvia", nome: "Salvia", chiaro: "#2f6b4f", scuro: "#8fcfae" },
  { id: "petrolio", nome: "Petrolio", chiaro: "#0b6470", scuro: "#7ccbd4" },
  { id: "ciliegia", nome: "Ciliegia", chiaro: "#a3214a", scuro: "#f29ab4" },
] as const;
export type Tema = (typeof TEMI)[number]["id"];
export type Aspetto = "auto" | "chiaro" | "scuro";

const K_TEMA = "cartella-nonna-tema";
const K_ASPETTO = "cartella-nonna-aspetto";

export function leggiTema(): { tema: Tema; aspetto: Aspetto } {
  let tema: string | null = null;
  let aspetto: string | null = null;
  try {
    tema = localStorage.getItem(K_TEMA);
    aspetto = localStorage.getItem(K_ASPETTO);
  } catch {
    /* niente */
  }
  return {
    tema: (TEMI.some((t) => t.id === tema) ? tema : "prugna") as Tema,
    aspetto: (["auto", "chiaro", "scuro"].includes(aspetto ?? "") ? aspetto : "auto") as Aspetto,
  };
}

export function applicaTema(tema: Tema, aspetto: Aspetto) {
  const r = document.documentElement;
  r.dataset.tema = tema;
  if (aspetto === "auto") delete r.dataset.aspetto;
  else r.dataset.aspetto = aspetto;
  const scuro = aspetto === "scuro" || (aspetto === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", scuro ? "#141215" : "#f6f4f1");
}

export function salvaTema(tema: Tema, aspetto: Aspetto) {
  try {
    localStorage.setItem(K_TEMA, tema);
    localStorage.setItem(K_ASPETTO, aspetto);
  } catch {
    /* niente */
  }
  applicaTema(tema, aspetto);
}
