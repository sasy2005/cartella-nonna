import { useState } from "react";
import { PRIORITA, SPECIALITA, type Impegno } from "../../supabase/functions/_shared/tipi.ts";
import { chiamateDi, ritiroDi, scadenzaDi } from "../../supabase/functions/_shared/avvisi.ts";
import { aggiungiMesi, diffGiorni, giornoBreve, giornoDi, giornoEsteso, oggi, oraDi, relativo } from "../../supabase/functions/_shared/date.ts";
import { inputIso, isoInput, righe, useApp } from "../lib/app.tsx";
import { uuid } from "../lib/backend.ts";
import { FileSalvato, Modulo, Sheet, SpecChip, StatoChip, TipoChip, Vuoto, type Campo, type Valori } from "./ui.tsx";

export function nuovoImpegno(p: Partial<Impegno> = {}): Impegno {
  return {
    id: uuid(),
    tipo: "visita",
    titolo: "",
    specialita: "Altro",
    stato: "da_prenotare",
    data: null,
    luogo: "",
    contatto_id: null,
    preparazione: "",
    portare: "",
    per_visita_id: null,
    entro: null,
    giorni_referto: 0,
    referto_ritirato: false,
    nre: "",
    priorita: null,
    data_ricetta: null,
    scadenza_ricetta: null,
    prescrittore: "",
    ricetta_path: null,
    note: "",
    ...p,
  };
}

function DateBox({ imp }: { imp: Impegno }) {
  if (!imp.data) return <div className="datebox vuoto"><b>–</b><span>data</span></div>;
  const g = giornoDi(imp.data);
  const d = new Date(g + "T12:00:00Z");
  return (
    <div className="datebox">
      <b>{d.getUTCDate()}</b>
      <span>{d.toLocaleDateString("it-IT", { month: "short", timeZone: "UTC" })}</span>
    </div>
  );
}

/** Riga di stato: la cosa più importante da sapere su questo impegno. */
export function StatoRiga({ imp }: { imp: Impegno }) {
  const { dati } = useApp();
  const g = oggi();
  if (imp.stato === "da_prenotare") {
    const sc = scadenzaDi(imp, dati);
    const ch = chiamateDi(imp.id, dati.chiamate);
    const ultima = ch[ch.length - 1];
    const n = sc ? diffGiorni(g, sc.giorno) : null;
    return (
      <>
        {sc ? (
          <span className={"small " + (n! <= 14 ? "chip crit" : n! <= 30 ? "chip warn" : "muted")} style={{ whiteSpace: "normal" }}>
            {n! < 0 ? "In ritardo! " : ""}Da fare entro il {giornoBreve(sc.giorno, g)} · {sc.motivo}
          </span>
        ) : (
          <span className="small muted">Nessuna scadenza impostata</span>
        )}
        {ultima && (
          <span className="small muted">
            {ch.length} {ch.length === 1 ? "chiamata" : "chiamate"}, l'ultima {relativo(g, giornoDi(ultima.quando))}: {ultima.esito || "nessun posto"}
            {ultima.richiamare_il && ` · richiamare ${relativo(g, ultima.richiamare_il)}`}
          </span>
        )}
      </>
    );
  }
  if (imp.stato === "prenotato" && imp.data)
    return (
      <span className="small">
        {giornoEsteso(giornoDi(imp.data))}, ore {oraDi(imp.data)}
        {imp.luogo && <span className="muted"> · {imp.luogo}</span>}
      </span>
    );
  const rit = ritiroDi(imp);
  if (rit)
    return (
      <span className={"chip " + (rit <= g ? "warn" : "acc")} style={{ whiteSpace: "normal" }}>
        Referto da ritirare {rit <= g ? "(già pronto)" : "dal " + giornoBreve(rit, g)}
      </span>
    );
  if (imp.data) return <span className="small muted">{giornoBreve(giornoDi(imp.data), g)}</span>;
  return null;
}

export function ImpegnoCard({ imp }: { imp: Impegno }) {
  const { apri, dati } = useApp();
  const visita = imp.per_visita_id ? dati.impegni.find((v) => v.id === imp.per_visita_id) : null;
  const esami = imp.tipo === "visita" ? dati.impegni.filter((e) => e.per_visita_id === imp.id && e.stato !== "annullato") : [];
  const esamiMancanti = esami.filter((e) => e.stato !== "fatto").length;
  return (
    <button className="card" onClick={() => apri({ k: "impegno", id: imp.id })}>
      <div className="item">
        <DateBox imp={imp} />
        <div className="body">
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <h3 className="grow">{imp.titolo || "(senza titolo)"}</h3>
            {imp.priorita && <span className="prio" title={PRIORITA[imp.priorita]}>{imp.priorita}</span>}
          </div>
          <StatoRiga imp={imp} />
          <div className="row">
            <TipoChip t={imp.tipo} />
            <SpecChip s={imp.specialita} />
            {visita && <span className="chip">per {visita.titolo.toLowerCase()}</span>}
            {esami.length > 0 && (
              <span className={"chip " + (esamiMancanti ? "warn" : "ok")}>
                {esamiMancanti ? `${esamiMancanti} ${esamiMancanti === 1 ? "esame" : "esami"} da fare prima` : "esami fatti"}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ---------- Scheda Impegni ---------- */

type Filtro = "da_prenotare" | "prenotato" | "ritirare" | "fatto";

export function SchermataImpegni() {
  const { dati, apri } = useApp();
  const [filtro, setFiltro] = useState<Filtro>("da_prenotare");
  const [spec, setSpec] = useState("Tutte");
  const g = oggi();

  const conta = (f: Filtro) => dati.impegni.filter((i) => passa(i, f)).length;
  function passa(i: Impegno, f: Filtro) {
    if (f === "ritirare") return ritiroDi(i) !== null;
    if (f === "fatto") return i.stato === "fatto" || i.stato === "annullato";
    return i.stato === f;
  }
  let lista = dati.impegni.filter((i) => passa(i, filtro) && (spec === "Tutte" || i.specialita === spec));
  if (filtro === "da_prenotare")
    lista = lista.sort((a, b) => (scadenzaDi(a, dati)?.giorno ?? "9999").localeCompare(scadenzaDi(b, dati)?.giorno ?? "9999"));
  else if (filtro === "fatto") lista = lista.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  else lista = lista.sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
  const specUsate = ["Tutte", ...SPECIALITA.filter((s) => dati.impegni.some((i) => i.specialita === s))];

  return (
    <>
      <div className="top">
        <h1>Visite ed esami</h1>
        <button className="primary" onClick={() => apri({ k: "ricetta" })}>
          + Ricetta
        </button>
      </div>
      <section>
        <div className="filters" role="tablist">
          {(
            [
              ["da_prenotare", "Da prenotare"],
              ["prenotato", "In programma"],
              ["ritirare", "Referti da ritirare"],
              ["fatto", "Fatti"],
            ] as [Filtro, string][]
          ).map(([f, l]) => (
            <button key={f} aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
              {l} ({conta(f)})
            </button>
          ))}
        </div>
        <div className="filters">
          {specUsate.map((s) => (
            <button key={s} className="mini" aria-pressed={spec === s} onClick={() => setSpec(s)}>
              {s}
            </button>
          ))}
        </div>
      </section>
      <section>
        {lista.length ? (
          lista.map((i) => <ImpegnoCard key={i.id} imp={i} />)
        ) : (
          <Vuoto>
            {filtro === "da_prenotare"
              ? "Niente da prenotare. Quando arriva una ricetta, premi “+ Ricetta”."
              : filtro === "ritirare"
                ? "Nessun referto da ritirare."
                : "Niente qui."}
          </Vuoto>
        )}
        <button onClick={() => apri({ k: "formImpegno", iniziale: { stato: filtro === "prenotato" ? "prenotato" : "da_prenotare" } })}>
          + Aggiungi senza ricetta
        </button>
        {filtro === "fatto" && lista.length > 0 && <p className="small muted">Ordinati dal più recente. Oggi è {giornoEsteso(g)}.</p>}
      </section>
    </>
  );
}

/* ---------- Dettaglio ---------- */

export function DettaglioImpegno({ id }: { id: string }) {
  const { dati, apri, salva, elimina, chiudi, backend } = useApp();
  const [conferma, setConferma] = useState(false);
  const imp = dati.impegni.find((i) => i.id === id);
  if (!imp)
    return (
      <Sheet titolo="Non trovato">
        <p>Questo impegno è stato eliminato.</p>
      </Sheet>
    );
  const g = oggi();
  const visita = imp.per_visita_id ? dati.impegni.find((v) => v.id === imp.per_visita_id) : null;
  const esami = dati.impegni.filter((e) => e.per_visita_id === imp.id);
  const storico = chiamateDi(imp.id, dati.chiamate);
  const contatto = dati.contatti.find((c) => c.id === imp.contatto_id);
  const docs = dati.documenti.filter((d) => d.impegno_id === imp.id);
  const prep = righe(imp.preparazione);
  const port = righe(imp.portare);
  const rit = ritiroDi(imp);
  const nomeC = (cid: string | null) => dati.contatti.find((c) => c.id === cid)?.nome;

  return (
    <Sheet
      sopra={
        <div className="row">
          <TipoChip t={imp.tipo} />
          <SpecChip s={imp.specialita} />
          <StatoChip s={imp.stato} />
        </div>
      }
      titolo={imp.titolo || "(senza titolo)"}
    >
      <div className="card">
        <StatoRiga imp={imp} />
        {contatto && <span className="small">Presso: {contatto.nome}</span>}
        {visita && (
          <button className="ghost" style={{ justifyContent: "flex-start", padding: 0 }} onClick={() => apri({ k: "impegno", id: visita.id })}>
            Serve per: {visita.titolo} →
          </button>
        )}
      </div>

      {/* Azioni principali in base allo stato */}
      {imp.stato === "da_prenotare" && (
        <div className="stack">
          <button className="primary big" onClick={() => apri({ k: "chiamata", id: imp.id })}>
            Sto chiamando per prenotare
          </button>
          <div className="row">
            <button className="grow" onClick={() => apri({ k: "prenotato", impegnoId: imp.id, contattoId: null })}>
              Ho già prenotato
            </button>
            <button className="grow" onClick={() => apri({ k: "esito", impegnoId: imp.id, contattoId: null })}>
              Segna una chiamata
            </button>
          </div>
        </div>
      )}
      {imp.stato === "prenotato" && (
        <button className="primary big" onClick={() => apri({ k: "fatto", impegnoId: imp.id })}>
          Fatto! {imp.tipo === "visita" ? "Com'è andata la visita" : "Esame fatto"}
        </button>
      )}
      {rit && (
        <button
          className="primary big"
          onClick={async () => {
            await salva("impegni", { ...imp, referto_ritirato: true });
            apri({ k: "formDocumento", iniziale: { titolo: "Referto " + imp.titolo.toLowerCase(), tipo: "Referto", specialita: imp.specialita, impegno_id: imp.id } });
          }}
        >
          Ho ritirato il referto: aggiungi la foto
        </button>
      )}
      {imp.stato === "fatto" && imp.tipo === "visita" && (
        <button onClick={() => apri({ k: "prossimo", visitaId: imp.id })}>Programma il prossimo controllo</button>
      )}

      {prep.length > 0 && (
        <div className="alert">
          <span className="eyebrow">Prima {imp.tipo === "visita" ? "della visita" : "dell'esame"}</span>
          <ul className="check">{prep.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      {port.length > 0 && (
        <div className="card">
          <span className="eyebrow">Da portare</span>
          <ul className="check">{port.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}

      {imp.tipo === "visita" && (
        <div className="card">
          <div className="row between">
            <span className="eyebrow">Esami da fare prima</span>
            <button
              className="ghost mini"
              onClick={() =>
                apri({
                  k: "formImpegno",
                  titolo: "Esame richiesto",
                  iniziale: { tipo: "esame", per_visita_id: imp.id, specialita: "Laboratorio analisi" },
                })
              }
            >
              + Esame
            </button>
          </div>
          {esami.length ? (
            esami.map((e) => (
              <button key={e.id} className="row between ghost" style={{ color: "inherit", padding: "4px 0", justifyContent: "space-between" }} onClick={() => apri({ k: "impegno", id: e.id })}>
                <span className="grow" style={{ textAlign: "left" }}>{e.titolo}</span>
                <StatoChip s={e.stato} />
              </button>
            ))
          ) : (
            <span className="small muted">Se lo specialista ha chiesto esami per questa visita, aggiungili qui: l'app calcola entro quando farli.</span>
          )}
          {esami.length > 0 && (
            <button className="ghost mini" style={{ justifySelf: "start" }} onClick={() => apri({ k: "ricetta", perVisitaId: imp.id })}>
              Fotografa una ricetta per questa visita
            </button>
          )}
        </div>
      )}

      {storico.length > 0 && (
        <div className="card">
          <span className="eyebrow">Chiamate</span>
          <div className="timeline">
            {storico
              .slice()
              .reverse()
              .map((c) => (
                <div key={c.id} className="small">
                  <b>{relativo(g, giornoDi(c.quando))}</b>
                  {nomeC(c.contatto_id) && ` · ${nomeC(c.contatto_id)}`}: {c.esito || "nessun posto"}
                  {c.richiamare_il && <span className="muted"> · richiamare {giornoBreve(c.richiamare_il, g)}</span>}
                </div>
              ))}
          </div>
        </div>
      )}

      {(imp.nre || imp.priorita || imp.data_ricetta || imp.ricetta_path) && (
        <div className="card">
          <span className="eyebrow">Ricetta</span>
          {imp.nre && <span>Codice (NRE): <b>{imp.nre}</b></span>}
          {imp.priorita && <span>Priorità {imp.priorita}: {PRIORITA[imp.priorita]}</span>}
          {imp.data_ricetta && <span className="small">Del {giornoBreve(imp.data_ricetta, g)}{imp.prescrittore && ` · ${imp.prescrittore}`}</span>}
          {imp.scadenza_ricetta && <span className="small">Scade il {giornoBreve(imp.scadenza_ricetta, g)}</span>}
          {imp.ricetta_path && <FileSalvato path={imp.ricetta_path} alt="Foto della ricetta" />}
        </div>
      )}

      {docs.length > 0 && (
        <div className="card">
          <span className="eyebrow">Referti</span>
          {docs.map((d) => (
            <button key={d.id} className="ghost" style={{ justifyContent: "flex-start", padding: 0 }} onClick={() => apri({ k: "documento", id: d.id })}>
              {d.titolo} →
            </button>
          ))}
        </div>
      )}
      {imp.note && <div className="card"><span className="eyebrow">Note</span><span>{imp.note}</span></div>}

      <div className="row">
        <button className="grow" onClick={() => apri({ k: "formImpegno", iniziale: imp, titolo: "Modifica" })}>
          Modifica
        </button>
        {conferma ? (
          <button
            className="grow danger"
            onClick={async () => {
              if (imp.ricetta_path) await backend.eliminaFile(imp.ricetta_path).catch(() => {});
              await elimina("impegni", imp.id);
              chiudi();
            }}
          >
            Sì, elimina
          </button>
        ) : (
          <button className="grow danger" onClick={() => setConferma(true)}>
            Elimina
          </button>
        )}
      </div>
    </Sheet>
  );
}

/* ---------- Modulo ---------- */

export function FormImpegno({ iniziale, titolo }: { iniziale: Partial<Impegno>; titolo?: string }) {
  const { dati, salva, chiudi, toast } = useApp();
  const imp = nuovoImpegno(iniziale);
  const esistente = dati.impegni.some((i) => i.id === imp.id);
  const g = oggi();
  const visite = dati.impegni.filter((v) => v.tipo === "visita" && v.stato !== "fatto" && v.stato !== "annullato" && v.id !== imp.id);
  const strutture = dati.contatti.filter((c) => c.tipo === "struttura");

  const campi: Campo[] = [
    { k: "tipo", l: "È una", tipo: "select", opzioni: [["visita", "Visita"], ["esame", "Esame (sangue, ecografia, …)"]] },
    { k: "titolo", l: "Cosa", hint: "Es: Visita cardiologica, Ecografia addome" },
    { k: "specialita", l: "Reparto", tipo: "select", opzioni: SPECIALITA.map((s) => [s, s]) },
    {
      k: "stato",
      l: "Stato",
      tipo: "select",
      opzioni: [
        ["da_prenotare", "Da prenotare"],
        ["prenotato", "Prenotato"],
        ["fatto", "Fatto"],
        ["annullato", "Annullato"],
      ],
    },
    { k: "data", l: "Data e ora dell'appuntamento", tipo: "datetime-local", hint: "Solo se è prenotato" },
    { k: "luogo", l: "Dove", hint: "Ospedale, padiglione, piano, ambulatorio" },
    { k: "contatto_id", l: "Struttura", tipo: "select", opzioni: [["", "—"], ...strutture.map((c) => [c.id, c.nome] as [string, string])] },
    { k: "per_visita_id", l: "Serve per la visita", tipo: "select", hint: "Per gli esami da portare a una visita", opzioni: [["", "— nessuna"], ...visite.map((v) => [v.id, v.titolo + (v.data ? " (" + giornoBreve(giornoDi(v.data), g) + ")" : "")] as [string, string])] },
    { k: "giorni_referto", l: "Dopo quanti giorni è pronto il referto", tipo: "number", hint: "0 se lo danno subito", rapidi: [{ l: "Subito", v: "0" }, { l: "3 giorni", v: "3" }, { l: "1 settimana", v: "7" }, { l: "2 settimane", v: "14" }] },
    { k: "entro", l: "Da fare entro", tipo: "date", hint: "Se c'è una data limite (es. controllo tra 6 mesi)", rapidi: [{ l: "1 mese", v: aggiungiMesi(g, 1) }, { l: "3 mesi", v: aggiungiMesi(g, 3) }, { l: "6 mesi", v: aggiungiMesi(g, 6) }, { l: "1 anno", v: aggiungiMesi(g, 12) }] },
    { k: "preparazione", l: "Istruzioni prima", tipo: "textarea", hint: "Una per riga. Es: Digiuno dalla mezzanotte" },
    { k: "portare", l: "Cosa portare", tipo: "textarea", hint: "Una per riga" },
    { k: "nre", l: "Codice ricetta (NRE)", hint: "In alto sulla ricetta, sotto il codice a barre" },
    { k: "priorita", l: "Priorità sulla ricetta", tipo: "select", opzioni: [["", "—"], ...(Object.entries(PRIORITA) as [string, string][]).map(([k, v]) => [k, `${k} · ${v}`] as [string, string])] },
    { k: "data_ricetta", l: "Data della ricetta", tipo: "date" },
    { k: "scadenza_ricetta", l: "La ricetta scade il", tipo: "date", hint: "Se non lo sai, chiedi al medico o al CUP" },
    { k: "prescrittore", l: "Chi l'ha prescritta" },
    { k: "note", l: "Note", tipo: "textarea" },
  ];

  const iniz: Valori = {
    ...Object.fromEntries(Object.entries(imp).map(([k, v]) => [k, v === null ? "" : typeof v === "boolean" ? v : String(v)])),
    data: isoInput(imp.data),
  };

  const salvaV = async (v: Valori) => {
    const s = (k: string) => String(v[k] ?? "").trim();
    const nuovo: Impegno = {
      ...imp,
      tipo: s("tipo") as Impegno["tipo"],
      titolo: s("titolo"),
      specialita: s("specialita"),
      stato: s("stato") as Impegno["stato"],
      data: inputIso(s("data")),
      luogo: s("luogo"),
      contatto_id: s("contatto_id") || null,
      per_visita_id: s("per_visita_id") || null,
      giorni_referto: Number(s("giorni_referto")) || 0,
      entro: s("entro") || null,
      preparazione: s("preparazione"),
      portare: s("portare"),
      nre: s("nre"),
      priorita: (s("priorita") || null) as Impegno["priorita"],
      data_ricetta: s("data_ricetta") || null,
      scadenza_ricetta: s("scadenza_ricetta") || null,
      prescrittore: s("prescrittore"),
      note: s("note"),
    };
    if (!nuovo.titolo) return toast("Scrivi almeno cosa c'è da fare");
    if (nuovo.stato === "prenotato" && !nuovo.data) return toast("Inserisci data e ora della prenotazione");
    await salva("impegni", nuovo);
    toast("Salvato");
    chiudi();
  };

  return (
    <Sheet titolo={titolo ?? (esistente ? "Modifica" : "Nuova visita o esame")}>
      <Modulo campi={campi} iniziali={iniz} onSalva={salvaV} />
    </Sheet>
  );
}
