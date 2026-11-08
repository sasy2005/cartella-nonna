import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Dati, Impegno, Profilo } from "../../supabase/functions/_shared/tipi.ts";
import type { Backend, Tabella } from "./backend.ts";
import { salvaCacheDati } from "./memoria.ts";

/** Le schermate che si aprono sopra le schede (una pila: "Indietro" torna alla precedente). */
export type Vista =
  | { k: "impegno"; id: string }
  | { k: "formImpegno"; iniziale: Partial<Impegno>; titolo?: string }
  | { k: "chiamata"; id: string }
  | { k: "esito"; impegnoId: string; contattoId: string | null }
  | { k: "prenotato"; impegnoId: string; contattoId: string | null }
  | { k: "fatto"; impegnoId: string }
  | { k: "prossimo"; visitaId: string }
  | { k: "ricetta"; perVisitaId?: string }
  | { k: "contatto"; id?: string }
  | { k: "documento"; id: string }
  | { k: "formDocumento"; iniziale: Record<string, unknown> }
  | { k: "farmaco"; id?: string }
  | { k: "comprato"; id: string }
  | { k: "messaggioMedico" }
  | { k: "profilo" }
  | { k: "impostazioni" }
  | { k: "portare"; id: string }
  | { k: "correggiScorta"; id: string }
  | { k: "stampaTerapia" }
  | { k: "pratica"; id?: string };

interface Ctx {
  dati: Dati;
  /** Se non c'è internet: da quando sono i dati mostrati (ISO), altrimenti null. */
  offline: string | null;
  backend: Backend;
  salva<T extends { id: string }>(tabella: Tabella, riga: T): Promise<void>;
  elimina(tabella: Tabella, id: string): Promise<void>;
  salvaProfilo(p: Profilo): Promise<void>;
  ricarica(): Promise<void>;
  toast(msg: string): void;
  pila: Vista[];
  apri(v: Vista): void;
  chiudi(n?: number): void;
  sostituisci(v: Vista): void;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fuori dal provider");
  return c;
}

export function AppProvider({
  backend,
  iniziali,
  offlineDal = null,
  children,
}: {
  backend: Backend;
  iniziali: Dati;
  offlineDal?: string | null;
  children: ReactNode;
}) {
  const [dati, setDati] = useState<Dati>(iniziali);
  const [offline, setOffline] = useState<string | null>(offlineDal);
  const [pila, setPila] = useState<Vista[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>(0);

  const toast = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);

  const ricarica = useCallback(async () => {
    try {
      setDati(await backend.carica());
      setOffline(null);
    } catch (e) {
      if (!navigator.onLine) return; // senza rete: restano i dati salvati sul telefono
      toast("Non riesco ad aggiornare: " + (e as Error).message);
    }
  }, [backend, toast]);

  // Copia dei dati sul telefono, per vederli anche senza internet.
  useEffect(() => {
    if (backend.modalita === "cloud" && !offline) salvaCacheDati(dati);
  }, [backend, dati, offline]);

  // Quando si torna sull'app (es. dopo che l'altra persona ha modificato qualcosa) ricarica.
  useEffect(() => {
    const f = () => {
      if (document.visibilityState === "visible") ricarica();
    };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [ricarica]);

  const salva = useCallback(
    async <T extends { id: string }>(tabella: Tabella, riga: T) => {
      setDati((d) => {
        const arr = d[tabella] as unknown as T[];
        const i = arr.findIndex((x) => x.id === riga.id);
        const nuovo = i >= 0 ? arr.map((x) => (x.id === riga.id ? riga : x)) : [...arr, riga];
        return { ...d, [tabella]: nuovo };
      });
      try {
        await backend.salva(tabella, riga);
      } catch (e) {
        toast("Non salvato: " + (e as Error).message);
        await ricarica();
        throw e;
      }
    },
    [backend, toast, ricarica],
  );

  const elimina = useCallback(
    async (tabella: Tabella, id: string) => {
      setDati((d) => ({
        ...d,
        [tabella]: (d[tabella] as { id: string }[]).filter((x) => x.id !== id),
        ...(tabella === "impegni" ? { chiamate: d.chiamate.filter((c) => c.impegno_id !== id) } : {}),
      }));
      try {
        await backend.elimina(tabella, id);
      } catch (e) {
        toast("Non eliminato: " + (e as Error).message);
        await ricarica();
      }
    },
    [backend, toast, ricarica],
  );

  const salvaProfilo = useCallback(
    async (p: Profilo) => {
      setDati((d) => ({ ...d, profilo: p }));
      try {
        await backend.salvaProfilo(p);
      } catch (e) {
        toast("Non salvato: " + (e as Error).message);
      }
    },
    [backend, toast],
  );

  const apri = useCallback((v: Vista) => setPila((p) => [...p, v]), []);
  const chiudi = useCallback((n = 1) => setPila((p) => p.slice(0, Math.max(0, p.length - n))), []);
  const sostituisci = useCallback((v: Vista) => setPila((p) => [...p.slice(0, -1), v]), []);

  // Tasto "indietro" del telefono chiude la schermata aperta.
  const profondita = pila.length;
  useEffect(() => {
    document.body.style.overflow = profondita ? "hidden" : "";
  }, [profondita]);
  useEffect(() => {
    if (!profondita) return;
    history.pushState({ livello: profondita }, "");
    const f = () => setPila((p) => p.slice(0, -1));
    window.addEventListener("popstate", f);
    return () => window.removeEventListener("popstate", f);
  }, [profondita]);

  const value = useMemo(
    () => ({ dati, offline, backend, salva, elimina, salvaProfilo, ricarica, toast, pila, apri, chiudi, sostituisci }),
    [dati, offline, backend, salva, elimina, salvaProfilo, ricarica, toast, pila, apri, chiudi, sostituisci],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </AppCtx.Provider>
  );
}

/* ---------- utilità ---------- */

/** Riduce una foto a max 1600px in JPEG: leggibile ma leggera. */
export async function comprimiImmagine(file: File, max = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Immagine non leggibile"));
      i.src = url;
    });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Compressione fallita"))), "image/jpeg", 0.82));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function blobBase64(b: Blob): Promise<string> {
  const s = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("File non leggibile"));
    r.readAsDataURL(b);
  });
  return s.slice(s.indexOf(",") + 1);
}

/** ISO → valore per <input type="datetime-local"> nell'ora del telefono. */
export function isoInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function inputIso(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

export async function copia(testo: string, toast: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(testo);
    toast("Copiato");
  } catch {
    toast("Non riesco a copiare: tieni premuto sul testo");
  }
}

export function righe(s: string | null | undefined): string[] {
  return (s || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}
