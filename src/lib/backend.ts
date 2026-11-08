import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import type { Dati, Profilo } from "../../supabase/functions/_shared/tipi.ts";
import { PROFILO_VUOTO } from "../../supabase/functions/_shared/tipi.ts";
import { datiDemo } from "./demo.ts";
import { chiediMemoriaPersistente, fileConCache, memoriaLogin } from "./memoria.ts";

export type Tabella = "impegni" | "chiamate" | "contatti" | "documenti" | "farmaci" | "pratiche";

export interface LetturaRicetta {
  tipo: "visita" | "esame";
  titolo: string;
  prestazioni: string[];
  specialita: string;
  priorita: "U" | "B" | "D" | "P" | "";
  nre: string;
  data_ricetta: string;
  validita_giorni: number;
  prescrittore: string;
  esenzione: string;
  quesito: string;
  appunti_a_mano: string;
  note_lettura: string;
}

export interface Membro {
  email: string;
  nome: string;
  whatsapp_tel: string;
  callmebot_key: string;
  promemoria: boolean;
}

export interface Backend {
  modalita: "demo" | "cloud";
  carica(): Promise<Dati>;
  salva(tabella: Tabella, riga: { id: string }): Promise<void>;
  elimina(tabella: Tabella, id: string): Promise<void>;
  salvaProfilo(p: Profilo): Promise<void>;
  caricaFile(file: Blob, estensione: string): Promise<string>;
  urlFile(path: string): Promise<string>;
  eliminaFile(path: string): Promise<void>;
  leggiRicetta(base64: string, mediaType: string): Promise<LetturaRicetta>;
  membro(): Promise<Membro | null>;
  salvaMembro(m: Partial<Membro>): Promise<void>;
  inviaProva(): Promise<string>;
  chiaveNotifiche(): Promise<string>;
  salvaIscrizione(s: PushSubscription): Promise<void>;
  rimuoviIscrizione(endpoint: string): Promise<void>;
  provaNotifica(): Promise<string>;
  statoPromemoria(): Promise<StatoPromemoria | null>;
  esci(): Promise<void>;
}

export interface StatoPromemoria {
  quando: string;
  notifiche: number;
  whatsapp: number;
  errori: string[];
  niente: boolean;
}

const URL_SB = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY_SB = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const CLOUD = Boolean(URL_SB && KEY_SB);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) {
    chiediMemoriaPersistente();
    client = createClient(URL_SB!, KEY_SB!, {
      auth: { persistSession: true, autoRefreshToken: true, storage: memoriaLogin, storageKey: "cartella-nonna-login" },
    });
  }
  return client;
}

export function uuid(): string {
  return crypto.randomUUID();
}

/* ---------------- Cloud (Supabase) ---------------- */

function cloud(session: Session): Backend {
  const sb = supabase();
  const urlCache = new Map<string, { url: string; scade: number }>();
  const ok = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };
  const invoca = async <T>(nome: string, body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await sb.functions.invoke(nome, { body });
    if (error) {
      let msg = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        const j = ctx ? await ctx.json() : null;
        if (j?.errore) msg = j.errore;
      } catch {
        /* risposta non JSON */
      }
      throw new Error(msg);
    }
    return data as T;
  };

  return {
    modalita: "cloud",
    async carica() {
      const [p, impegni, chiamate, contatti, documenti, farmaci, pratiche] = await Promise.all([
        sb.from("profilo").select("dati").eq("id", 1).maybeSingle(),
        sb.from("impegni").select("*"),
        sb.from("chiamate").select("*"),
        sb.from("contatti").select("*").order("nome"),
        sb.from("documenti").select("*"),
        sb.from("farmaci").select("*").order("nome"),
        sb.from("pratiche").select("*").order("created_at"),
      ]);
      const profilo = { ...PROFILO_VUOTO, ...((ok(p) as { dati?: Profilo } | null)?.dati ?? {}) };
      return {
        profilo,
        impegni: ok(impegni) ?? [],
        chiamate: ok(chiamate) ?? [],
        contatti: ok(contatti) ?? [],
        documenti: ok(documenti) ?? [],
        farmaci: (ok(farmaci) ?? []).map((f: Record<string, unknown>) => ({
          ...f,
          per_giorno: Number(f.per_giorno),
          scorta: Number(f.scorta),
        })),
        pratiche: ok(pratiche) ?? [],
      } as Dati;
    },
    async salva(tabella, riga) {
      ok(await sb.from(tabella).upsert(riga));
    },
    async elimina(tabella, id) {
      ok(await sb.from(tabella).delete().eq("id", id));
    },
    async salvaProfilo(p) {
      ok(await sb.from("profilo").upsert({ id: 1, dati: p }));
    },
    async caricaFile(file, est) {
      const path = `${new Date().getFullYear()}/${uuid()}.${est}`;
      ok(await sb.storage.from("documenti").upload(path, file, { contentType: file.type || undefined }));
      return path;
    },
    async urlFile(path) {
      const c = urlCache.get(path);
      if (c) return c.url;
      const blob = await fileConCache(path, async () => {
        const r = await sb.storage.from("documenti").createSignedUrl(path, 3600);
        if (r.error || !r.data) throw new Error(r.error?.message ?? "File non trovato");
        return r.data.signedUrl;
      });
      const url = URL.createObjectURL(blob);
      urlCache.set(path, { url, scade: Infinity });
      return url;
    },
    async eliminaFile(path) {
      ok(await sb.storage.from("documenti").remove([path]));
    },
    async leggiRicetta(base64, mediaType) {
      return invoca<LetturaRicetta>("leggi-ricetta", { immagine: base64, media_type: mediaType });
    },
    async membro() {
      const r = await sb.from("membri").select("*").maybeSingle();
      return (ok(r) as Membro | null) ?? null;
    },
    async salvaMembro(m) {
      ok(await sb.from("membri").update(m).eq("email", session.user.email!));
    },
    async inviaProva() {
      const r = await invoca<{ messaggio: string }>("promemoria", { prova: "whatsapp" });
      return r.messaggio;
    },
    async chiaveNotifiche() {
      return (await invoca<{ chiave: string }>("promemoria", { chiave: true })).chiave;
    },
    async salvaIscrizione(sub) {
      const j = sub.toJSON();
      ok(
        await sb.from("notifiche_iscrizioni").upsert({
          endpoint: sub.endpoint,
          email: session.user.email!,
          p256dh: j.keys?.p256dh ?? "",
          auth: j.keys?.auth ?? "",
          dispositivo: navigator.userAgent.slice(0, 200),
        }),
      );
    },
    async rimuoviIscrizione(endpoint) {
      ok(await sb.from("notifiche_iscrizioni").delete().eq("endpoint", endpoint));
    },
    async provaNotifica() {
      return (await invoca<{ messaggio: string }>("promemoria", { prova: "notifica" })).messaggio;
    },
    async statoPromemoria() {
      const r = await invoca<Partial<StatoPromemoria>>("promemoria", { stato: true });
      return r.quando ? (r as StatoPromemoria) : null;
    },
    async esci() {
      await sb.auth.signOut();
    },
  };
}

export function backendCloud(session: Session): Backend {
  return cloud(session);
}

/* ---------------- Prova (dati nel browser) ---------------- */

const KEY_DEMO = "cartella-nonna-prova-v1";

export function backendDemo(): Backend {
  const leggi = (): Dati => {
    try {
      const s = localStorage.getItem(KEY_DEMO);
      if (s) return { pratiche: [], ...JSON.parse(s) };
    } catch {
      /* storage non disponibile */
    }
    const d = datiDemo();
    scrivi(d);
    return d;
  };
  const scrivi = (d: Dati) => {
    try {
      localStorage.setItem(KEY_DEMO, JSON.stringify(d));
    } catch {
      throw new Error("Memoria del browser piena: in modalità prova si possono salvare poche foto.");
    }
  };
  const fileKey = (p: string) => "cartella-nonna-file:" + p;

  return {
    modalita: "demo",
    async carica() {
      return leggi();
    },
    async salva(tabella, riga) {
      const d = leggi();
      const arr = d[tabella] as { id: string }[];
      const i = arr.findIndex((x) => x.id === riga.id);
      if (i >= 0) arr[i] = riga;
      else arr.push(riga);
      scrivi(d);
    },
    async elimina(tabella, id) {
      const d = leggi();
      (d[tabella] as { id: string }[]) = (d[tabella] as { id: string }[]).filter((x) => x.id !== id);
      if (tabella === "impegni") d.chiamate = d.chiamate.filter((c) => c.impegno_id !== id);
      scrivi(d);
    },
    async salvaProfilo(p) {
      const d = leggi();
      d.profilo = p;
      scrivi(d);
    },
    async caricaFile(file, est) {
      const path = `${uuid()}.${est}`;
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(new Error("File non leggibile"));
        r.readAsDataURL(file);
      });
      try {
        localStorage.setItem(fileKey(path), dataUrl);
      } catch {
        throw new Error("Memoria del browser piena: in modalità prova si possono salvare poche foto.");
      }
      return path;
    },
    async urlFile(path) {
      try {
        return localStorage.getItem(fileKey(path)) ?? "";
      } catch {
        return "";
      }
    },
    async eliminaFile(path) {
      try {
        localStorage.removeItem(fileKey(path));
      } catch {
        /* niente */
      }
    },
    async leggiRicetta() {
      throw new Error("In modalità prova la lettura automatica non è attiva: compila i campi a mano.");
    },
    async membro() {
      return null;
    },
    async salvaMembro() {},
    async inviaProva() {
      throw new Error("I messaggi WhatsApp funzionano solo con l'app collegata a Supabase.");
    },
    async chiaveNotifiche() {
      throw new Error("Le notifiche funzionano solo con l'app collegata a Supabase.");
    },
    async salvaIscrizione() {},
    async rimuoviIscrizione() {},
    async provaNotifica() {
      throw new Error("Le notifiche funzionano solo con l'app collegata a Supabase.");
    },
    async statoPromemoria() {
      return null;
    },
    async esci() {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("cartella-nonna"))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* niente */
      }
    },
  };
}
