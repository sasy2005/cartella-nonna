import { useEffect, useRef, useState } from "react";
import { SPECIALITA, TIPO_ESAMI_SANGUE, type Documento, type Valore } from "../../supabase/functions/_shared/tipi.ts";
import { giornoBreve, giornoEsteso, oggi } from "../../supabase/functions/_shared/date.ts";
import { blobBase64, comprimiImmagine, useApp } from "../lib/app.tsx";
import { uuid } from "../lib/backend.ts";
import { confronta, esamiDelSangue, type Riga } from "../lib/esami.ts";
import { FileSalvato, Miniatura, Modulo, Sheet, SpecChip, Vuoto, type Campo, type Valori } from "./ui.tsx";

export const TIPI_DOC = ["Referto", TIPO_ESAMI_SANGUE, "Esami", "Prenotazione", "Ricetta", "Piano terapeutico", "Lettera di dimissione", "Certificato", "Altro"];

const NUOVI_ESAMI: Partial<Documento> = { tipo: TIPO_ESAMI_SANGUE, titolo: TIPO_ESAMI_SANGUE, specialita: "Laboratorio analisi" };

/** Tabella dei valori, con quelli fuori norma in evidenza e la freccia rispetto alla volta prima. */
function TabellaValori({ righe, tutte = false }: { righe: Riga[]; tutte?: boolean }) {
  const [aperta, setAperta] = useState(tutte);
  // prima quelli fuori norma, poi gli altri nell'ordine del referto
  const ordinate = [...righe.filter((r) => r.fuori), ...righe.filter((r) => !r.fuori)];
  const visibili = aperta ? ordinate : ordinate.slice(0, 8);
  const freccia = (r: Riga) => (r.andamento === "su" ? "↑" : r.andamento === "giu" ? "↓" : r.andamento === "uguale" ? "=" : "");
  return (
    <div className="stack" style={{ gap: 6 }}>
      <table className="valori">
        <tbody>
          {visibili.map((r, i) => (
            <tr key={i} className={r.fuori ? "fuori" : ""}>
              <td>
                {r.nome}
                {r.riferimento && <span className="rif">{r.riferimento}</span>}
              </td>
              <td className="num">
                <b>{r.valore}</b> <span className="unita">{r.unita}</span>
                {r.fuori && <span className="segno">{r.fuori === "alto" ? " alto" : " basso"}</span>}
              </td>
              <td className="freccia" title={r.prima ? `Prima: ${r.prima}` : ""}>
                {freccia(r)}
                {r.prima && <span className="prima">{r.prima}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {ordinate.length > 8 && (
        <button className="ghost mini" style={{ alignSelf: "flex-start" }} onClick={() => setAperta((a) => !a)}>
          {aperta ? "Mostra meno" : `Mostra tutti i ${ordinate.length} valori`}
        </button>
      )}
    </div>
  );
}

/** Riquadro fisso in cima all'Archivio: gli ultimi esami del sangue. */
function UltimiEsami() {
  const { dati, apri } = useApp();
  const tutti = esamiDelSangue(dati.documenti);
  const ultimo = tutti[0];
  if (!ultimo)
    return (
      <button className="card esami-fissi" onClick={() => apri({ k: "formDocumento", iniziale: NUOVI_ESAMI })}>
        <span className="eyebrow">In evidenza</span>
        <b>Ultimi esami del sangue</b>
        <span className="small muted">Carica la foto o il PDF degli ultimi esami: leggo i valori e la prossima volta ti dico se sono saliti o scesi.</span>
      </button>
    );
  const righe = confronta(ultimo, tutti.slice(1));
  const fuori = righe.filter((r) => r.fuori).length;
  return (
    <div className="card esami-fissi">
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <span className="eyebrow">In evidenza · ultimi esami del sangue</span>
          <h2 style={{ textTransform: "capitalize" }}>{giornoEsteso(ultimo.data)}</h2>
        </div>
        {righe.length > 0 && <span className={"chip " + (fuori ? "crit" : "ok")}>{fuori ? `${fuori} fuori norma` : "tutto nella norma"}</span>}
      </div>
      {righe.length ? (
        <>
          <TabellaValori righe={righe} />
          {tutti.length > 1 && <span className="small muted">Le frecce confrontano con gli esami del {giornoBreve(tutti[1].data)}.</span>}
        </>
      ) : (
        <span className="small muted">Valori non ancora letti: apri il referto e premi “Leggi i valori”.</span>
      )}
      <div className="row">
        <button className="grow mini" onClick={() => apri({ k: "documento", id: ultimo.id })}>
          Apri il referto
        </button>
        <button className="grow mini primary" onClick={() => apri({ k: "formDocumento", iniziale: NUOVI_ESAMI })}>
          + Nuovi esami
        </button>
      </div>
      {tutti.length > 1 && (
        <div className="row" style={{ gap: 6 }}>
          <span className="small muted">Precedenti:</span>
          {tutti.slice(1, 6).map((d) => (
            <button key={d.id} className="mini" style={{ minHeight: 30, padding: "2px 10px" }} onClick={() => apri({ k: "documento", id: d.id })}>
              {giornoBreve(d.data)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SchermataArchivio() {
  const { dati, apri } = useApp();
  const [spec, setSpec] = useState("Tutte");
  const [cerca, setCerca] = useState("");
  const g = oggi();
  const q = cerca.trim().toLowerCase();
  const lista = dati.documenti
    .filter((d) => (spec === "Tutte" || d.specialita === spec) && (!q || (d.titolo + " " + d.note + " " + d.tipo + " " + (d.valori ?? []).map((v) => v.nome).join(" ")).toLowerCase().includes(q)))
    .sort((a, b) => b.data.localeCompare(a.data));
  const usate = ["Tutte", ...SPECIALITA.filter((s) => dati.documenti.some((d) => d.specialita === s))];
  return (
    <>
      <div className="top">
        <h1>Archivio</h1>
        <button className="primary" onClick={() => apri({ k: "formDocumento", iniziale: { specialita: spec !== "Tutte" ? spec : "Medicina generale" } })}>
          + Documento
        </button>
      </div>
      <section>
        <UltimiEsami />
      </section>
      <section>
        <label htmlFor="cerca">
          <span className="hint">Cerca</span>
          <input id="cerca" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Es: ecografia, glicata…" />
        </label>
        <div className="filters">
          {usate.map((s) => (
            <button key={s} className="mini" aria-pressed={spec === s} onClick={() => setSpec(s)}>
              {s}
            </button>
          ))}
        </div>
      </section>
      <section>
        {lista.length ? (
          <div className="grid">
            {lista.map((d) => (
              <button key={d.id} className="doc" onClick={() => apri({ k: "documento", id: d.id })}>
                <div className="thumb">
                  <Miniatura path={d.file_path} tipo={d.file_tipo} />
                </div>
                <div className="meta">
                  <b className="small">{d.titolo}</b>
                  <span className="small muted">
                    {d.tipo} · {giornoBreve(d.data, g)}
                  </span>
                  <span>
                    <SpecChip s={d.specialita} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Vuoto>Nessun documento. Fotografa un referto o carica un PDF per iniziare.</Vuoto>
        )}
      </section>
    </>
  );
}

/** Chiede all'AI i valori degli esami (foto o PDF già salvati). */
async function leggiValori(backend: ReturnType<typeof useApp>["backend"], path: string, tipo: string) {
  const r = await fetch(await backend.urlFile(path));
  const blob = await r.blob();
  return backend.leggiEsami(await blobBase64(blob), tipo.includes("pdf") ? "application/pdf" : "image/jpeg");
}

export function DettaglioDocumento({ id }: { id: string }) {
  const { dati, apri, elimina, chiudi, backend, salva, toast } = useApp();
  const [conferma, setConferma] = useState(false);
  const [leggo, setLeggo] = useState(false);
  const d = dati.documenti.find((x) => x.id === id);
  if (!d) return null;
  const imp = d.impegno_id ? dati.impegni.find((i) => i.id === d.impegno_id) : null;
  const esami = d.tipo === TIPO_ESAMI_SANGUE;
  const precedenti = esamiDelSangue(dati.documenti).filter((x) => x.data < d.data);
  return (
    <Sheet titolo={d.titolo} sopra={<span className="eyebrow">{d.tipo} · {giornoBreve(d.data)}</span>}>
      <div className="row">
        <SpecChip s={d.specialita} />
      </div>
      {esami && (d.valori?.length ?? 0) > 0 && (
        <div className="card">
          <span className="eyebrow">Valori ({d.valori!.length})</span>
          <TabellaValori righe={confronta(d, precedenti)} tutte />
        </div>
      )}
      {esami && d.file_path && backend.modalita === "cloud" && (
        <button
          disabled={leggo}
          onClick={async () => {
            setLeggo(true);
            try {
              const l = await leggiValori(backend, d.file_path!, d.file_tipo);
              await salva("documenti", { ...d, valori: l.valori, data: /^\d{4}-\d{2}-\d{2}$/.test(l.data_prelievo) ? l.data_prelievo : d.data });
              toast(`Letti ${l.valori.length} valori`);
            } catch (e) {
              toast("Non riesco a leggerli: " + (e as Error).message);
            } finally {
              setLeggo(false);
            }
          }}
        >
          {leggo ? "Leggo i valori…" : d.valori?.length ? "Rileggi i valori" : "Leggi i valori"}
        </button>
      )}
      {d.file_path ? <FileSalvato path={d.file_path} tipo={d.file_tipo} alt={d.titolo} /> : <Vuoto>Nessuna foto o PDF.</Vuoto>}
      {d.note && <div className="card" style={{ whiteSpace: "pre-wrap" }}>{d.note}</div>}
      {imp && (
        <button className="ghost" style={{ justifyContent: "flex-start" }} onClick={() => apri({ k: "impegno", id: imp.id })}>
          Collegato a: {imp.titolo} →
        </button>
      )}
      <div className="row">
        <button className="grow" onClick={() => apri({ k: "formDocumento", iniziale: { ...d } })}>
          Modifica
        </button>
        {conferma ? (
          <button
            className="grow danger"
            onClick={async () => {
              if (d.file_path) await backend.eliminaFile(d.file_path).catch(() => {});
              await elimina("documenti", d.id);
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

export function FormDocumento({ iniziale, file: fileCondiviso }: { iniziale: Partial<Documento>; file?: File }) {
  const { dati, salva, chiudi, backend, toast } = useApp();
  const g = oggi();
  const [doc] = useState<Documento>(() => ({ id: uuid(), titolo: "", tipo: "Referto", specialita: "Medicina generale", data: g, note: "", file_path: null, file_tipo: "", impegno_id: null, valori: [], ...iniziale }));
  const [file, setFile] = useState<{ path: string; tipo: string } | null>(doc.file_path ? { path: doc.file_path, tipo: doc.file_tipo } : null);
  const [carico, setCarico] = useState(false);
  const [leggo, setLeggo] = useState(false);
  const [valori, setValori] = useState<Valore[]>(doc.valori ?? []);
  // i valori del modulo: si aggiornano quando l'AI legge data e laboratorio
  const [modulo, setModulo] = useState<{ v: Valori; n: number }>({ v: { titolo: doc.titolo, tipo: doc.tipo, specialita: doc.specialita, data: doc.data, note: doc.note }, n: 0 });
  const tipoAttuale = useRef(doc.tipo);
  const foto = useRef<HTMLInputElement>(null);
  const altro = useRef<HTMLInputElement>(null);
  const esistente = dati.documenti.some((x) => x.id === doc.id);

  async function leggiEsami(path: string, tipo: string, attuali: Valori) {
    if (backend.modalita !== "cloud") return;
    setLeggo(true);
    try {
      const l = await leggiValori(backend, path, tipo);
      setValori(l.valori);
      const data = /^\d{4}-\d{2}-\d{2}$/.test(l.data_prelievo) ? l.data_prelievo : String(attuali.data);
      const note = [String(attuali.note ?? ""), l.laboratorio && `Laboratorio: ${l.laboratorio}`, l.note_lettura && `Da controllare: ${l.note_lettura}`].filter(Boolean).join("\n");
      setModulo((m) => ({ v: { ...attuali, data, note, tipo: TIPO_ESAMI_SANGUE, specialita: "Laboratorio analisi" }, n: m.n + 1 }));
      const fuori = l.valori.filter((x) => x.fuori).length;
      toast(l.valori.length ? `Letti ${l.valori.length} valori${fuori ? `, ${fuori} fuori norma` : ""}` : "Non trovo valori in questo documento");
    } catch (e) {
      toast("Non riesco a leggere i valori: " + (e as Error).message);
    } finally {
      setLeggo(false);
    }
  }

  async function scegli(f?: File) {
    if (!f) return;
    setCarico(true);
    try {
      let caricato: { path: string; tipo: string };
      if (f.type === "application/pdf") caricato = { path: await backend.caricaFile(f, "pdf"), tipo: "application/pdf" };
      else caricato = { path: await backend.caricaFile(await comprimiImmagine(f), "jpg"), tipo: "image/jpeg" };
      setFile(caricato);
      if (fileCondiviso && f === fileCondiviso && f.name) {
        const nome = f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim();
        if (nome && !modulo.v.titolo) setModulo((m) => ({ v: { ...m.v, titolo: nome }, n: m.n + 1 }));
      }
      if (tipoAttuale.current === TIPO_ESAMI_SANGUE) await leggiEsami(caricato.path, caricato.tipo, modulo.v);
    } catch (e) {
      toast("Caricamento non riuscito: " + (e as Error).message);
    } finally {
      setCarico(false);
    }
  }

  // file arrivato da "Condividi" (Android): si carica subito
  useEffect(() => {
    if (fileCondiviso) scegli(fileCondiviso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const campi = (v: Valori): Campo[] => {
    tipoAttuale.current = String(v.tipo);
    const esami = v.tipo === TIPO_ESAMI_SANGUE;
    return [
      { k: "tipo", l: "Tipo", tipo: "select", opzioni: TIPI_DOC.map((t) => [t, t]) },
      { k: "titolo", l: "Titolo", hint: esami ? "Es: Esami del sangue" : "Es: Referto ecografia addome" },
      { k: "specialita", l: "Reparto", tipo: "select", opzioni: SPECIALITA.map((s) => [s, s]) },
      { k: "data", l: esami ? "Data del prelievo" : "Data", tipo: "date" },
      { k: "note", l: "Cosa dice in breve", tipo: "textarea", hint: esami ? "I valori li leggo io dal referto" : "Valori importanti, cosa ha detto il medico" },
    ];
  };

  return (
    <Sheet titolo={esistente ? "Modifica documento" : doc.tipo === TIPO_ESAMI_SANGUE ? "Nuovi esami del sangue" : "Nuovo documento"}>
      <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => scegli(e.target.files?.[0])} />
      <input ref={altro} type="file" accept="image/*,application/pdf" hidden onChange={(e) => scegli(e.target.files?.[0])} />
      {carico && !leggo ? (
        <div className="row">
          <div className="spinner" /> Carico…
        </div>
      ) : file ? (
        <div className="stack">
          <FileSalvato path={file.path} tipo={file.tipo} alt="Anteprima" />
          <button type="button" className="ghost" onClick={() => altro.current?.click()}>
            Cambia file
          </button>
        </div>
      ) : (
        <div className="row">
          <button type="button" className="primary grow" onClick={() => foto.current?.click()}>
            Scatta una foto
          </button>
          <button type="button" className="grow" onClick={() => altro.current?.click()}>
            Scegli foto o PDF
          </button>
        </div>
      )}
      {leggo && (
        <div className="row">
          <div className="spinner" /> Leggo i valori degli esami…
        </div>
      )}
      {valori.length > 0 && (
        <div className="card">
          <span className="eyebrow">
            Valori letti: {valori.length}
            {valori.some((x) => x.fuori) ? ` · ${valori.filter((x) => x.fuori).length} fuori norma` : ""}
          </span>
          <TabellaValori righe={valori.map((x) => ({ ...x, andamento: "" as const }))} />
          <span className="small muted">Controlla che corrispondano al foglio.</span>
        </div>
      )}
      {file && !leggo && tipoAttuale.current === TIPO_ESAMI_SANGUE && valori.length === 0 && backend.modalita === "cloud" && (
        <button type="button" onClick={() => leggiEsami(file.path, file.tipo, modulo.v)}>
          Leggi i valori
        </button>
      )}
      <Modulo
        key={modulo.n}
        campi={campi}
        iniziali={modulo.v}
        onSalva={async (v) => {
          if (carico || leggo) return toast("Aspetta che finisca");
          await salva("documenti", {
            ...doc,
            titolo: String(v.titolo).trim() || String(v.tipo),
            tipo: String(v.tipo),
            specialita: String(v.specialita),
            data: String(v.data) || g,
            note: String(v.note).trim(),
            file_path: file?.path ?? null,
            file_tipo: file?.tipo ?? "",
            valori: String(v.tipo) === TIPO_ESAMI_SANGUE ? valori : doc.valori ?? [],
          });
          toast("Documento salvato");
          chiudi();
        }}
      />
    </Sheet>
  );
}
