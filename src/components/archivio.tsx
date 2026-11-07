import { useRef, useState } from "react";
import { SPECIALITA, type Documento } from "../../supabase/functions/_shared/tipi.ts";
import { giornoBreve, oggi } from "../../supabase/functions/_shared/date.ts";
import { comprimiImmagine, useApp } from "../lib/app.tsx";
import { uuid } from "../lib/backend.ts";
import { FileSalvato, Miniatura, Modulo, Sheet, SpecChip, Vuoto, type Campo } from "./ui.tsx";

export const TIPI_DOC = ["Referto", "Esami", "Ricetta", "Piano terapeutico", "Lettera di dimissione", "Certificato", "Altro"];

export function SchermataArchivio() {
  const { dati, apri } = useApp();
  const [spec, setSpec] = useState("Tutte");
  const [cerca, setCerca] = useState("");
  const g = oggi();
  const q = cerca.trim().toLowerCase();
  const lista = dati.documenti
    .filter((d) => (spec === "Tutte" || d.specialita === spec) && (!q || (d.titolo + " " + d.note + " " + d.tipo).toLowerCase().includes(q)))
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

export function DettaglioDocumento({ id }: { id: string }) {
  const { dati, apri, elimina, chiudi, backend } = useApp();
  const [conferma, setConferma] = useState(false);
  const d = dati.documenti.find((x) => x.id === id);
  if (!d) return null;
  const imp = d.impegno_id ? dati.impegni.find((i) => i.id === d.impegno_id) : null;
  return (
    <Sheet titolo={d.titolo} sopra={<span className="eyebrow">{d.tipo} · {giornoBreve(d.data)}</span>}>
      <div className="row">
        <SpecChip s={d.specialita} />
      </div>
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

export function FormDocumento({ iniziale }: { iniziale: Partial<Documento> }) {
  const { dati, salva, chiudi, backend, toast } = useApp();
  const g = oggi();
  const doc: Documento = { id: uuid(), titolo: "", tipo: "Referto", specialita: "Medicina generale", data: g, note: "", file_path: null, file_tipo: "", impegno_id: null, ...iniziale };
  const [file, setFile] = useState<{ path: string; tipo: string } | null>(doc.file_path ? { path: doc.file_path, tipo: doc.file_tipo } : null);
  const [carico, setCarico] = useState(false);
  const foto = useRef<HTMLInputElement>(null);
  const altro = useRef<HTMLInputElement>(null);
  const esistente = dati.documenti.some((x) => x.id === doc.id);

  async function scegli(f?: File) {
    if (!f) return;
    setCarico(true);
    try {
      if (f.type === "application/pdf") {
        const path = await backend.caricaFile(f, "pdf");
        setFile({ path, tipo: "application/pdf" });
      } else {
        const img = await comprimiImmagine(f);
        const path = await backend.caricaFile(img, "jpg");
        setFile({ path, tipo: "image/jpeg" });
      }
    } catch (e) {
      toast("Caricamento non riuscito: " + (e as Error).message);
    } finally {
      setCarico(false);
    }
  }

  const campi: Campo[] = [
    { k: "titolo", l: "Titolo", hint: "Es: Referto ecografia addome" },
    { k: "tipo", l: "Tipo", tipo: "select", opzioni: TIPI_DOC.map((t) => [t, t]) },
    { k: "specialita", l: "Reparto", tipo: "select", opzioni: SPECIALITA.map((s) => [s, s]) },
    { k: "data", l: "Data", tipo: "date" },
    { k: "note", l: "Cosa dice in breve", tipo: "textarea", hint: "Valori importanti, cosa ha detto il medico" },
  ];

  return (
    <Sheet titolo={esistente ? "Modifica documento" : "Nuovo documento"}>
      <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => scegli(e.target.files?.[0])} />
      <input ref={altro} type="file" accept="image/*,application/pdf" hidden onChange={(e) => scegli(e.target.files?.[0])} />
      {carico ? (
        <div className="row"><div className="spinner" /> Carico…</div>
      ) : file ? (
        <div className="stack">
          <FileSalvato path={file.path} tipo={file.tipo} alt="Anteprima" />
          <button type="button" className="ghost" onClick={() => foto.current?.click()}>
            Rifai la foto
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
      <Modulo
        campi={campi}
        iniziali={{ titolo: doc.titolo, tipo: doc.tipo, specialita: doc.specialita, data: doc.data, note: doc.note }}
        onSalva={async (v) => {
          if (carico) return toast("Aspetta che finisca il caricamento");
          await salva("documenti", {
            ...doc,
            titolo: String(v.titolo).trim() || String(v.tipo),
            tipo: String(v.tipo),
            specialita: String(v.specialita),
            data: String(v.data) || g,
            note: String(v.note).trim(),
            file_path: file?.path ?? null,
            file_tipo: file?.tipo ?? "",
          });
          toast("Documento salvato");
          chiudi();
        }}
      />
    </Sheet>
  );
}
