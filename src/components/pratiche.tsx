import { useState } from "react";
import type { Pratica } from "../../supabase/functions/_shared/tipi.ts";
import { useApp } from "../lib/app.tsx";
import { uuid } from "../lib/backend.ts";
import { Sheet } from "./ui.tsx";

/** Passi tipici. Le regole cambiano: il patronato conferma come si fa a Milano oggi. */
const MODELLO_104 = {
  titolo: "Aggravamento invalidità e Legge 104",
  note:
    "Il patronato (INCA-CGIL, INAS-CISL, ITAL-UIL, ACLI…) segue la pratica gratis. Dal 2025 la riforma della disabilità sta cambiando la procedura provincia per provincia: chiedere al patronato come funziona adesso a Milano.\n" +
    "Con la 104 in situazione di gravità (art. 3 comma 3) chi assiste la nonna può avere 3 giorni di permesso retribuito al mese.",
  passi: [
    "Visita neurologica: farsi dare la relazione scritta con la diagnosi",
    "Raccogliere i referti recenti di tutti gli specialisti (sono in Archivio)",
    "Preparare la lista dei farmaci e delle terapie (foglio delle pillole)",
    "Prendere appuntamento al patronato",
    "Chiedere al medico di base il certificato medico introduttivo per l'INPS (lo invia lui online)",
    "Conservare la ricevuta del certificato: la domanda va fatta entro 90 giorni",
    "Il patronato presenta la domanda: aggravamento + Legge 104 art. 3 comma 3 (+ accompagnamento se serve)",
    "Se la nonna non può spostarsi, chiedere la visita a domicilio",
    "Visita della commissione: portare tutti i documenti",
    "Arriva il verbale: controllarlo con il patronato",
    "Con la 104: chiedere al datore di lavoro (e all'INPS) i permessi per assistere la nonna",
  ],
};

export function SezionePratiche() {
  const { dati, apri } = useApp();
  return (
    <section>
      <div className="row between">
        <h2>Pratiche</h2>
        <button className="ghost" onClick={() => apri({ k: "pratica" })}>
          + Nuova
        </button>
      </div>
      {dati.pratiche.length ? (
        dati.pratiche.map((p) => {
          const fatti = p.passi.filter((x) => x.fatto).length;
          const prossimo = p.passi.find((x) => !x.fatto);
          return (
            <button key={p.id} className="card" onClick={() => apri({ k: "pratica", id: p.id })}>
              <div className="row between">
                <h3 className="grow">{p.titolo}</h3>
                <span className={"chip " + (fatti === p.passi.length && p.passi.length ? "ok" : "acc")}>
                  {fatti}/{p.passi.length}
                </span>
              </div>
              <div className="bar">
                <span style={{ width: (p.passi.length ? (fatti / p.passi.length) * 100 : 0) + "%" }} />
              </div>
              {prossimo && <span className="small">Prossimo passo: {prossimo.testo}</span>}
            </button>
          );
        })
      ) : (
        <button className="card" onClick={() => apri({ k: "pratica" })}>
          <b>104 e aggravamento dell'invalidità</b>
          <span className="small muted">Dopo la visita dal neurologo: i passi da seguire, da spuntare uno alla volta.</span>
        </button>
      )}
    </section>
  );
}

export function SchedaPratica({ id }: { id?: string }) {
  const { dati, salva, elimina, sostituisci, chiudi, toast } = useApp();
  const [nuovoPasso, setNuovoPasso] = useState("");
  const [conferma, setConferma] = useState(false);
  const p = id ? dati.pratiche.find((x) => x.id === id) : undefined;
  const [note, setNote] = useState(p?.note ?? "");

  const crea = async (modello: { titolo: string; note: string; passi: string[] }) => {
    const nuova: Pratica = { id: uuid(), titolo: modello.titolo, note: modello.note, passi: modello.passi.map((t) => ({ id: uuid(), testo: t, fatto: false })) };
    await salva("pratiche", nuova);
    sostituisci({ k: "pratica", id: nuova.id });
  };

  if (!p)
    return (
      <Sheet titolo="Nuova pratica">
        <button className="card" onClick={() => crea(MODELLO_104)}>
          <b>{MODELLO_104.titolo}</b>
          <span className="small muted">{MODELLO_104.passi.length} passi già pronti, da spuntare. Si possono modificare.</span>
        </button>
        <button className="card" onClick={() => crea({ titolo: "Nuova pratica", note: "", passi: [] })}>
          <b>Pratica vuota</b>
          <span className="small muted">Scrivi tu titolo e passi (es. esenzione, ausili, rinnovo piano terapeutico).</span>
        </button>
      </Sheet>
    );

  const aggiorna = (modifiche: Partial<Pratica>) => salva("pratiche", { ...p, ...modifiche });
  const fatti = p.passi.filter((x) => x.fatto).length;

  return (
    <Sheet
      sopra={<span className="eyebrow">{fatti} di {p.passi.length} passi fatti</span>}
      titolo={
        <input
          aria-label="Titolo della pratica"
          defaultValue={p.titolo}
          style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.2rem" }}
          onBlur={(e) => e.target.value.trim() && e.target.value !== p.titolo && aggiorna({ titolo: e.target.value.trim() })}
        />
      }
    >
      <div className="card">
        {p.passi.map((x, i) => (
          <div key={x.id} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <label className="check-label grow">
              <input type="checkbox" checked={x.fatto} onChange={(e) => aggiorna({ passi: p.passi.map((y) => (y.id === x.id ? { ...y, fatto: e.target.checked } : y)) })} />
              <span style={{ textDecoration: x.fatto ? "line-through" : undefined, opacity: x.fatto ? 0.6 : 1 }}>
                {i + 1}. {x.testo}
              </span>
            </label>
            <button className="ghost mini" aria-label={"Togli il passo " + x.testo} onClick={() => aggiorna({ passi: p.passi.filter((y) => y.id !== x.id) })}>
              ✕
            </button>
          </div>
        ))}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nuovoPasso.trim()) return;
            aggiorna({ passi: [...p.passi, { id: uuid(), testo: nuovoPasso.trim(), fatto: false }] });
            setNuovoPasso("");
          }}
        >
          <input className="grow" aria-label="Nuovo passo" placeholder="Aggiungi un passo…" value={nuovoPasso} onChange={(e) => setNuovoPasso(e.target.value)} style={{ width: "auto" }} />
          <button type="submit">Aggiungi</button>
        </form>
      </div>
      <label htmlFor="note-pratica">
        Note
        <span className="hint">Numeri di protocollo, appuntamenti al patronato, nomi…</span>
        <textarea id="note-pratica" value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 120 }} />
      </label>
      <button
        className="primary"
        disabled={note === p.note}
        onClick={async () => {
          await aggiorna({ note });
          toast("Note salvate");
        }}
      >
        Salva le note
      </button>
      {conferma ? (
        <button
          className="danger"
          onClick={async () => {
            await elimina("pratiche", p.id);
            chiudi();
          }}
        >
          Sì, elimina la pratica
        </button>
      ) : (
        <button className="danger" onClick={() => setConferma(true)}>
          Elimina pratica
        </button>
      )}
    </Sheet>
  );
}
