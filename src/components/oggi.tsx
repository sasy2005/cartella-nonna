import { calcolaAvvisi, scadenzaDi, type Avviso, type Categoria } from "../../supabase/functions/_shared/avvisi.ts";
import { giornoDi, giornoEsteso, oggi } from "../../supabase/functions/_shared/date.ts";
import { useApp } from "../lib/app.tsx";
import { Calendario, ImpegnoCard } from "./impegni.tsx";
import { Icona, Vuoto } from "./ui.tsx";

const ICONA_CATEGORIA: Record<Categoria, string> = {
  visita: "impegni",
  prenotare: "rubrica",
  richiamare: "ripeti",
  ritiro: "documento",
  ricetta: "documento",
  farmaco: "farmaci",
};

function saluto(): string {
  const h = new Date().getHours();
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

export function SchermataOggi() {
  const { dati, apri, backend, offline } = useApp();
  const g = oggi();
  const avvisi = calcolaAvvisi(dati, g);
  const prossimi = dati.impegni
    .filter((i) => i.stato === "prenotato" && i.data && giornoDi(i.data) >= g)
    .sort((a, b) => a.data!.localeCompare(b.data!))
    .slice(0, 3);
  const senzaScadenza = dati.impegni.filter((i) => i.stato === "da_prenotare" && !scadenzaDi(i, dati));
  const urgenti = avvisi.filter((a) => a.livello === "urgente").length;

  const tocca = (a: Avviso) => {
    if (a.impegno_id) apri({ k: a.categoria === "richiamare" || a.categoria === "prenotare" ? "chiamata" : "impegno", id: a.impegno_id });
    else if (a.farmaco_id) apri({ k: "messaggioMedico" });
  };

  return (
    <>
      {offline && (
        <div className="banner-offline" role="status">
          <b>Senza internet.</b> Vedi i dati salvati sul telefono ({new Date(offline).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}). Le modifiche non vengono salvate finché non torna la rete.
        </div>
      )}
      {backend.modalita === "demo" && (
        <div className="demo" style={{ marginTop: 8 }}>
          <b>Modalità prova</b>: i dati sono inventati e restano solo su questo telefono.
        </div>
      )}

      <header className="saluto">
        <div className="grow">
          <span className="eyebrow">{giornoEsteso(g)}</span>
          <h1>{saluto()}</h1>
          <span className="muted">
            {avvisi.length === 0
              ? `Per ${dati.profilo.nome || "la nonna"} oggi è tutto a posto.`
              : `${avvisi.length} ${avvisi.length === 1 ? "cosa" : "cose"} da seguire per ${dati.profilo.nome || "la nonna"}${urgenti ? `, ${urgenti} urgenti` : ""}.`}
          </span>
        </div>
        <button className="tondo" onClick={() => apri({ k: "impostazioni" })} aria-label="Impostazioni">
          <Icona nome="ingranaggio" />
        </button>
      </header>

      <section>
        <button className="azione-ricetta" onClick={() => apri({ k: "ricetta" })}>
          <span className="icona">
            <Icona nome="fotocamera" />
          </span>
          <span className="grow">
            <b>Fotografa una ricetta</b>
            <span className="sotto">Leggo io codice, esame e scadenza</span>
          </span>
        </button>
      </section>

      <section>
        <div className="titolo-sezione">
          <h2>Da fare</h2>
          {avvisi.length > 0 && <span className="conta">{avvisi.length}</span>}
        </div>
        {avvisi.length ? (
          <div className="lista-avvisi">
            {avvisi.map((a) => (
              <button key={a.id} className={a.livello} onClick={() => tocca(a)}>
                <span className="bolla">
                  <Icona nome={ICONA_CATEGORIA[a.categoria]} />
                </span>
                <span className="testo">
                  <b>{a.titolo}</b>
                  {a.dettaglio.slice(0, 3).map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </span>
                <span className="freccia">
                  <Icona nome="freccia" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="tutto-ok">
            <span className="bolla">
              <Icona nome="spunta" />
            </span>
            <span>
              <b>Tutto sotto controllo</b>
              <br />
              <span className="small muted">Niente di urgente per oggi.</span>
            </span>
          </div>
        )}
        {senzaScadenza.length > 0 && (
          <p className="small muted">
            {senzaScadenza.length} {senzaScadenza.length === 1 ? "cosa da prenotare non ha" : "cose da prenotare non hanno"} una data limite: aprile e indica
            entro quando vanno fatte, così te le ricordo.
          </p>
        )}
      </section>

      <section>
        <h2>Prossimi appuntamenti</h2>
        {prossimi.length ? prossimi.map((i) => <ImpegnoCard key={i.id} imp={i} />) : <Vuoto>Nessun appuntamento prenotato.</Vuoto>}
      </section>

      <section>
        <div className="card">
          <Calendario compatto />
        </div>
      </section>
    </>
  );
}
