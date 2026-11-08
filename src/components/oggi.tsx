import { calcolaAvvisi, scadenzaDi, type Avviso } from "../../supabase/functions/_shared/avvisi.ts";
import { giornoDi, giornoEsteso, oggi } from "../../supabase/functions/_shared/date.ts";
import { useApp } from "../lib/app.tsx";
import { ImpegnoCard } from "./impegni.tsx";
import { Vuoto } from "./ui.tsx";
import { SezionePratiche } from "./pratiche.tsx";

export function SchermataOggi() {
  const { dati, apri, backend, offline } = useApp();
  const g = oggi();
  const avvisi = calcolaAvvisi(dati, g);
  const urgenti = avvisi.filter((a) => a.livello !== "info");
  const info = avvisi.filter((a) => a.livello === "info");
  const prossimi = dati.impegni
    .filter((i) => i.stato === "prenotato" && i.data && giornoDi(i.data) >= g)
    .sort((a, b) => a.data!.localeCompare(b.data!))
    .slice(0, 4);
  const daPrenotare = dati.impegni.filter((i) => i.stato === "da_prenotare");
  const senzaScadenza = daPrenotare.filter((i) => !scadenzaDi(i, dati));

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
        <div className="demo">
          <b>Modalità prova</b>: i dati sono inventati e restano solo su questo telefono. Puoi provare tutto liberamente.
        </div>
      )}
      <div className="top">
        <div className="grow">
          <span className="eyebrow">{giornoEsteso(g)}</span>
          <h1>{dati.profilo.nome || "La nonna"}</h1>
        </div>
        <button onClick={() => apri({ k: "impostazioni" })} aria-label="Impostazioni">
          Impostazioni
        </button>
      </div>

      <section>
        <div className="row">
          <button className="primary grow big" onClick={() => apri({ k: "ricetta" })}>
            Fotografa una ricetta
          </button>
        </div>
      </section>

      <section>
        <h2>Da fare</h2>
        {urgenti.length ? (
          urgenti.map((a) => (
            <button key={a.id} className={"alert " + a.livello} onClick={() => tocca(a)}>
              <b>{a.titolo}</b>
              {a.dettaglio.length > 0 && (
                <ul className="small">
                  {a.dettaglio.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </button>
          ))
        ) : (
          <div className="alert ok">
            <b>Tutto sotto controllo</b>
            <span className="small">Nessuna cosa urgente per oggi.</span>
          </div>
        )}
        {info.map((a) => (
          <button key={a.id} className="alert info" onClick={() => tocca(a)}>
            <b>{a.titolo}</b>
          </button>
        ))}
        {senzaScadenza.length > 0 && (
          <p className="small muted">
            {senzaScadenza.length} {senzaScadenza.length === 1 ? "cosa da prenotare non ha" : "cose da prenotare non hanno"} una scadenza: aprile e
            indica entro quando vanno fatte, così te le ricordo.
          </p>
        )}
      </section>

      <section>
        <div className="row between">
          <h2>Prossimi appuntamenti</h2>
          <a className="btn ghost" href="#calendario">
            Calendario →
          </a>
        </div>
        {prossimi.length ? prossimi.map((i) => <ImpegnoCard key={i.id} imp={i} />) : <Vuoto>Nessun appuntamento prenotato.</Vuoto>}
      </section>

      <SezionePratiche />
    </>
  );
}
