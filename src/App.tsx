import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Dati } from "../supabase/functions/_shared/tipi.ts";
import { calcolaAvvisi } from "../supabase/functions/_shared/avvisi.ts";
import { oggi } from "../supabase/functions/_shared/date.ts";
import { AppProvider, useApp, type Vista } from "./lib/app.tsx";
import { CLOUD, backendCloud, backendDemo, supabase, type Backend } from "./lib/backend.ts";
import { SchermataOggi } from "./components/oggi.tsx";
import { DettaglioImpegno, FormImpegno, SceltaDaPortare, SchermataImpegni, type Filtro } from "./components/impegni.tsx";
import { SchermataChiamata, SchermataEsito, SchermataFatto, SchermataPrenotato, SchermataProssimo } from "./components/chiamata.tsx";
import { SchermataRicetta } from "./components/ricetta.tsx";
import { FormComprato, FormCorreggiScorta, FormFarmaco, MessaggioMedico, SchermataFarmaci, StampaTerapia } from "./components/farmaci.tsx";
import { SchedaPratica } from "./components/pratiche.tsx";
import { SchermataFoglio } from "./components/prenotazione.tsx";
import { leggiCacheDati, memoriaLogin } from "./lib/memoria.ts";
import { FormContatto, SchermataRubrica } from "./components/rubrica.tsx";
import { DettaglioDocumento, FormDocumento, SchermataArchivio } from "./components/archivio.tsx";
import { FormProfilo, SchermataImpostazioni } from "./components/impostazioni.tsx";
import { Icona } from "./components/ui.tsx";

type Scheda = "oggi" | "impegni" | "farmaci" | "rubrica" | "archivio";
const SCHEDE: [Scheda, string][] = [
  ["oggi", "Oggi"],
  ["impegni", "Visite"],
  ["farmaci", "Farmaci"],
  ["rubrica", "Rubrica"],
  ["archivio", "Archivio"],
];

function leggiScheda(): Scheda {
  const h = location.hash.slice(1);
  if (h === "calendario") return "impegni";
  return SCHEDE.some(([k]) => k === h) ? (h as Scheda) : "oggi";
}

function Vista1({ v }: { v: Vista }) {
  switch (v.k) {
    case "impegno": return <DettaglioImpegno id={v.id} />;
    case "formImpegno": return <FormImpegno iniziale={v.iniziale} titolo={v.titolo} documento={v.documento} altreDate={v.altreDate} />;
    case "foglio": return <SchermataFoglio id={v.id} />;
    case "chiamata": return <SchermataChiamata id={v.id} />;
    case "esito": return <SchermataEsito impegnoId={v.impegnoId} contattoId={v.contattoId} />;
    case "prenotato": return <SchermataPrenotato impegnoId={v.impegnoId} contattoId={v.contattoId} />;
    case "fatto": return <SchermataFatto impegnoId={v.impegnoId} />;
    case "prossimo": return <SchermataProssimo visitaId={v.visitaId} />;
    case "ricetta": return <SchermataRicetta perVisitaId={v.perVisitaId} />;
    case "contatto": return <FormContatto id={v.id} />;
    case "documento": return <DettaglioDocumento id={v.id} />;
    case "formDocumento": return <FormDocumento iniziale={v.iniziale} file={v.file} />;
    case "farmaco": return <FormFarmaco id={v.id} />;
    case "comprato": return <FormComprato id={v.id} />;
    case "messaggioMedico": return <MessaggioMedico ids={v.ids} />;
    case "profilo": return <FormProfilo />;
    case "impostazioni": return <SchermataImpostazioni />;
    case "portare": return <SceltaDaPortare id={v.id} />;
    case "correggiScorta": return <FormCorreggiScorta id={v.id} />;
    case "stampaTerapia": return <StampaTerapia />;
    case "pratica": return <SchedaPratica id={v.id} />;
  }
}

function Guscio() {
  const { dati, pila, apri } = useApp();
  const [scheda, setScheda] = useState<Scheda>(leggiScheda);
  const [inizioVisite, setInizioVisite] = useState<{ f: Filtro; n: number }>({ f: location.hash === "#calendario" ? "calendario" : "da_prenotare", n: 0 });
  useEffect(() => {
    const f = () => {
      setScheda(leggiScheda());
      if (location.hash === "#calendario") setInizioVisite((x) => ({ f: "calendario", n: x.n + 1 }));
    };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  // File arrivato da "Condividi → Nonna": si apre il modulo del nuovo documento con il file già caricato
  useEffect(() => {
    if (location.hash !== "#condividi") return;
    history.replaceState(null, "", "#archivio");
    setScheda("archivio");
    (async () => {
      try {
        const c = await caches.open("cartella-nonna-condivisi");
        const r = await c.match("ultimo");
        if (!r) return;
        await c.delete("ultimo");
        const nome = decodeURIComponent(r.headers.get("x-nome") ?? "") || "documento";
        const file = new File([await r.blob()], nome, { type: r.headers.get("content-type") ?? "" });
        const esami = /sangue|analisi|esami|emocromo|laboratorio|lab/i.test(nome);
        apri({ k: "formDocumento", iniziale: esami ? { tipo: "Esami del sangue", titolo: "Esami del sangue", specialita: "Laboratorio analisi" } : {}, file });
      } catch {
        /* niente da aprire */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urgenti = calcolaAvvisi(dati, oggi()).filter((a) => a.livello === "urgente").length;
  const daPrenotare = dati.impegni.filter((i) => i.stato === "da_prenotare").length;
  const cima = pila[pila.length - 1];
  const vai = (s: Scheda) => {
    history.replaceState(null, "", "#" + s);
    if (s === "impegni") setInizioVisite((x) => ({ f: "da_prenotare", n: x.n + 1 }));
    setScheda(s);
    window.scrollTo(0, 0);
  };
  return (
    <>
      <main className="wrap" aria-hidden={cima?.k === "chiamata" ? true : undefined}>
        {scheda === "oggi" && <SchermataOggi />}
        {scheda === "impegni" && <SchermataImpegni key={inizioVisite.n} inizio={inizioVisite.f} />}
        {scheda === "farmaci" && <SchermataFarmaci />}
        {scheda === "rubrica" && <SchermataRubrica />}
        {scheda === "archivio" && <SchermataArchivio />}
      </main>
      <nav className="tabs" aria-label="Sezioni">
        <div className="in">
          {SCHEDE.map(([k, l]) => (
            <button key={k} onClick={() => vai(k)} aria-current={scheda === k ? "page" : undefined}>
              <Icona nome={k} />
              <span>
                {l}
                {k === "oggi" && urgenti > 0 && <span className="badge">{urgenti}</span>}
                {k === "impegni" && daPrenotare > 0 && <span className="badge" style={{ background: "var(--warn)" }}>{daPrenotare}</span>}
              </span>
            </button>
          ))}
        </div>
      </nav>
      {/* Si mostra solo la schermata in cima, tranne "Sto chiamando" che resta sotto a esito/prenotato */}
      {pila.map((v, i) => {
        const ultima = i === pila.length - 1;
        const sottoChiamata = v.k === "chiamata" && i === pila.length - 2;
        return ultima || sottoChiamata ? <Vista1 key={i + v.k} v={v} /> : null;
      })}
    </>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [attendi, setAttendi] = useState(false);
  return (
    <main className="wrap" style={{ maxWidth: 420 }}>
      <form
        className="stack"
        style={{ marginTop: 40 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setAttendi(true);
          setErr("");
          const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: pw });
          if (error)
            setErr(
              error.message === "Invalid login credentials"
                ? "Email o password sbagliate."
                : /fetch|network/i.test(error.message)
                  ? "Connessione non riuscita: controlla internet e riprova."
                  : error.message,
            );
          setAttendi(false);
        }}
      >
        <h1>Cartella della Nonna</h1>
        <p className="muted">Entra con l'account che ti hanno creato.</p>
        <label htmlFor="email">
          Email
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label htmlFor="pw">
          Password
          <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </label>
        {err && <div className="alert urgente">{err}</div>}
        <button className="primary big" disabled={attendi}>
          {attendi ? "Entro…" : "Entra"}
        </button>
      </form>
    </main>
  );
}

function Caricamento({ testo }: { testo: string }) {
  return (
    <main className="wrap">
      <div className="row" style={{ marginTop: 60, justifyContent: "center" }}>
        <div className="spinner" /> {testo}
      </div>
    </main>
  );
}

export function App() {
  const [sessione, setSessione] = useState<Session | null | undefined>(CLOUD ? undefined : null);
  const [stato, setStato] = useState<{ backend: Backend; dati: Dati; offlineDal?: string } | null>(null);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    if (!CLOUD) return;
    const sb = supabase();
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session) return setSessione(data.session);
      // Senza internet il login non si può rinnovare: si usa quello salvato, in sola lettura.
      if (!navigator.onLine) {
        try {
          const salvata = JSON.parse((await memoriaLogin.getItem("cartella-nonna-login")) ?? "null");
          if (salvata?.user) return setSessione(salvata as Session);
        } catch {
          /* niente */
        }
      }
      setSessione(null);
    });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSessione(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const utente = sessione?.user.id;
  useEffect(() => {
    if (CLOUD && !sessione) return;
    const b = CLOUD ? backendCloud(sessione!) : backendDemo();
    b.carica()
      .then((dati) => setStato({ backend: b, dati }))
      .catch(async (e) => {
        const copia = CLOUD ? await leggiCacheDati<Dati>() : null;
        if (copia) setStato({ backend: b, dati: { ...copia.dati, pratiche: copia.dati.pratiche ?? [] }, offlineDal: copia.quando });
        else setErrore((e as Error).message);
      });
    // ricarica solo quando cambia l'utente, non a ogni rinnovo del token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utente]);

  if (CLOUD && sessione === undefined) return <Caricamento testo="Un attimo…" />;
  if (CLOUD && !sessione) return <Login />;
  if (errore)
    return (
      <main className="wrap stack">
        <h1>Qualcosa non va</h1>
        <div className="alert urgente">{errore}</div>
        <p className="muted">Se hai appena creato l'account, controlla che la tua email sia nella tabella “membri” (vedi GUIDA.md).</p>
        <button onClick={(e) => { e.currentTarget.textContent = "Riprovo…"; e.currentTarget.disabled = true; location.reload(); }}>Riprova</button>
        {CLOUD && <button onClick={() => supabase().auth.signOut().then(() => location.reload())}>Esci</button>}
      </main>
    );
  if (!stato) return <Caricamento testo="Carico i dati…" />;
  return (
    <AppProvider backend={stato.backend} iniziali={stato.dati} offlineDal={stato.offlineDal ?? null}>
      <Guscio />
    </AppProvider>
  );
}
