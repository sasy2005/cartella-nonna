import { useRef, useState } from "react";
import { SPECIALITA, type Impegno } from "../../supabase/functions/_shared/tipi.ts";
import { aggiungiGiorni } from "../../supabase/functions/_shared/date.ts";
import { blobBase64, comprimiImmagine, useApp } from "../lib/app.tsx";
import { Sheet } from "./ui.tsx";
import { ScattaFoglio } from "./prenotazione.tsx";
import { uuid } from "../lib/backend.ts";

/** Foto della ricetta → lettura automatica → modulo già compilato da controllare. */
export function SchermataRicetta({ perVisitaId }: { perVisitaId?: string }) {
  const { backend, sostituisci, toast } = useApp();
  const [fase, setFase] = useState<"stato" | "scegli" | "leggo" | "foglio">("stato");
  const [idNuovo] = useState(uuid);
  const [dallaRicetta, setDallaRicetta] = useState<Partial<Impegno>>({});
  const [stato, setStato] = useState<Impegno["stato"]>("da_prenotare");
  const [anteprima, setAnteprima] = useState("");
  const foto = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const base: Partial<Impegno> = { id: idNuovo, ...(perVisitaId ? { tipo: "esame", per_visita_id: perVisitaId } : {}) };

  const NOMI: Partial<Record<Impegno["stato"], string>> = { da_prenotare: "da prenotare", prenotato: "già prenotata", fatto: "già fatta" };
  const vaiAlModulo = (p: Partial<Impegno>) =>
    sostituisci({
      k: "formImpegno",
      iniziale: { ...base, ...p, stato, ...(stato === "fatto" ? { referto_ritirato: true } : {}) },
      titolo: `Controlla e salva · ${NOMI[stato]}`,
    });
  /** Dopo la ricetta: se è già prenotata, chiede anche il foglio di prenotazione. */
  const dopoRicetta = (p: Partial<Impegno>) => {
    if (stato !== "prenotato") return vaiAlModulo(p);
    setDallaRicetta(p);
    setFase("foglio");
  };

  async function gestisci(file: File | undefined) {
    if (!file) return;
    setFase("leggo");
    let path: string | null = null;
    try {
      const img = await comprimiImmagine(file);
      setAnteprima(URL.createObjectURL(img));
      path = await backend.caricaFile(img, "jpg");
      if (backend.modalita === "demo") {
        toast("Foto salvata. In modalità prova compila i campi a mano.");
        return dopoRicetta({ ricetta_path: path });
      }
      const l = await backend.leggiRicetta(await blobBase64(img), "image/jpeg");
      const note = [
        l.prestazioni.length > 1 ? "Prestazioni: " + l.prestazioni.join(", ") : "",
        l.appunti_a_mano ? "Scritto a mano: " + l.appunti_a_mano : "",
        l.quesito ? "Motivo: " + l.quesito : "",
        l.esenzione ? "Esenzione: " + l.esenzione : "",
        l.note_lettura ? "Da controllare: " + l.note_lettura : "",
      ]
        .filter(Boolean)
        .join("\n");
      const data = /^\d{4}-\d{2}-\d{2}$/.test(l.data_ricetta) ? l.data_ricetta : null;
      const validita = Number(l.validita_giorni) > 0 ? Number(l.validita_giorni) : 0;
      toast("Ricetta letta");
      dopoRicetta({
        tipo: perVisitaId ? "esame" : l.tipo,
        titolo: l.titolo,
        specialita: (SPECIALITA as readonly string[]).includes(l.specialita) ? l.specialita : "Altro",
        priorita: l.priorita || null,
        nre: l.nre,
        data_ricetta: data,
        scadenza_ricetta: data && validita ? aggiungiGiorni(data, validita) : null,
        prescrittore: l.prescrittore,
        note,
        giorni_referto: l.tipo === "esame" ? (/sangue|emocromo|glic|urin|creatin|ferritin/i.test(l.titolo) ? 3 : /eco/i.test(l.titolo) ? 7 : 0) : 0,
        ricetta_path: path,
      });
    } catch (e) {
      toast("Non sono riuscito a leggerla: " + (e as Error).message);
      dopoRicetta(path ? { ricetta_path: path } : {});
    }
  }

  return (
    <Sheet titolo="Nuova ricetta">
      {fase === "stato" ? (
        <div className="stack">
          <p className="muted">Questa ricetta è…</p>
          {(
            [
              ["da_prenotare", "Da prenotare", "Ricetta nuova: ti ricordo di prenotare e la scadenza"],
              ["prenotato", "Già prenotata", "Inserisci data, ora e dove: ti ricordo l'appuntamento"],
              ["fatto", "Già fatta", "Una vecchia da tenere in archivio: nessun promemoria"],
            ] as [Impegno["stato"], string, string][]
          ).map(([k, t, d]) => (
            <button
              key={k}
              className={"card" + (k === "da_prenotare" ? " scelta-principale" : "")}
              onClick={() => {
                setStato(k);
                setFase("scegli");
              }}
            >
              <b style={{ fontSize: "1.1rem" }}>{t}</b>
              <span className="small muted">{d}</span>
            </button>
          ))}
        </div>
      ) : fase === "foglio" ? (
        <div className="stack">
          <div className="alert ok">
            <b>{dallaRicetta.titolo || "Ricetta"}: fatto</b>
            <span className="small">Ora fotografa il foglio di prenotazione: leggo data, ora, dove andare, le istruzioni e cosa portare.</span>
          </div>
          <ScattaFoglio
            imp={{ ...base, ...dallaRicetta }}
            fatto={({ campi, documento }) =>
              sostituisci({
                k: "formImpegno",
                iniziale: { ...base, ...dallaRicetta, ...campi, stato: "prenotato" },
                titolo: "Controlla e salva · già prenotata",
                documento,
              })
            }
            salta={{ testo: "Non ce l'ho: inserisco data e luogo a mano", azione: () => vaiAlModulo(dallaRicetta) }}
          />
        </div>
      ) : fase === "leggo" ? (
        <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
          {anteprima && <img src={anteprima} alt="Ricetta" className="preview-img" style={{ maxHeight: 260, objectFit: "contain" }} />}
          <div className="spinner" />
          <p>Leggo la ricetta… ci vogliono pochi secondi.</p>
        </div>
      ) : (
        <div className="stack">
          <button className="ghost" style={{ alignSelf: "flex-start", padding: 0, minHeight: 0 }} onClick={() => setFase("stato")}>
            ← Ricetta {NOMI[stato]}
          </button>
          <p className="muted">
            Fotografa la ricetta dall'alto, con buona luce, tutta dentro l'inquadratura. {backend.modalita === "cloud" && "Leggo io codice, esame e priorità."}
          </p>
          <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => gestisci(e.target.files?.[0])} />
          <input ref={album} type="file" accept="image/*" hidden onChange={(e) => gestisci(e.target.files?.[0])} />
          <button className="primary big" onClick={() => foto.current?.click()}>
            Scatta una foto
          </button>
          <button className="big" onClick={() => album.current?.click()}>
            Scegli una foto già fatta
          </button>
          <button className="ghost" onClick={() => dopoRicetta({})}>
            Compila a mano senza foto
          </button>
        </div>
      )}
    </Sheet>
  );
}
