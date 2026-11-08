import { useRef, useState } from "react";
import type { Documento, Impegno } from "../../supabase/functions/_shared/tipi.ts";
import { oggi } from "../../supabase/functions/_shared/date.ts";
import { blobBase64, comprimiImmagine, useApp } from "../lib/app.tsx";
import { daFoglio } from "../lib/foglio.ts";
import { uuid, type LetturaPrenotazione } from "../lib/backend.ts";
import { Sheet } from "./ui.tsx";

export interface FoglioLetto {
  /** Campi della visita ricavati dal foglio (vuoto se la lettura non è riuscita). */
  campi: Partial<Impegno>;
  /** La foto salvata, da mettere in archivio collegata alla visita. */
  documento: Partial<Documento>;
}

/** Pulsanti per fotografare il foglio + lettura. Chiama `fatto` con i campi letti e la foto. */
export function ScattaFoglio({ imp, fatto, salta }: { imp: Partial<Impegno>; fatto: (r: FoglioLetto) => void; salta?: { testo: string; azione: () => void } }) {
  const { backend, toast } = useApp();
  const [leggo, setLeggo] = useState(false);
  const [anteprima, setAnteprima] = useState("");
  const foto = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);

  async function gestisci(file?: File) {
    if (!file) return;
    setLeggo(true);
    try {
      const img = await comprimiImmagine(file);
      setAnteprima(URL.createObjectURL(img));
      const path = await backend.caricaFile(img, "jpg");
      const documento: Partial<Documento> = {
        id: uuid(),
        titolo: "Foglio di prenotazione" + (imp.titolo ? " – " + imp.titolo : ""),
        tipo: "Prenotazione",
        specialita: imp.specialita ?? "Altro",
        data: oggi(),
        note: "",
        file_path: path,
        file_tipo: "image/jpeg",
      };
      let campi: Partial<Impegno> = { stato: "prenotato" };
      if (backend.modalita === "demo") toast("Foto salvata. In modalità prova compila i campi a mano.");
      else {
        try {
          const l = await backend.leggiPrenotazione(await blobBase64(img), "image/jpeg");
          campi = daFoglio(l, imp);
          if (l.prestazione && !imp.titolo) documento.titolo = "Foglio di prenotazione – " + l.prestazione;
          toast(campi.data ? "Foglio letto: controlla i dati" : "Non trovo la data sul foglio: inseriscila tu");
        } catch (e) {
          toast("Non sono riuscito a leggerlo: " + (e as Error).message);
        }
      }
      fatto({ campi, documento });
    } catch (e) {
      toast("Foto non salvata: " + (e as Error).message);
    } finally {
      setLeggo(false);
    }
  }

  if (leggo)
    return (
      <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
        {anteprima && <img src={anteprima} alt="Foglio di prenotazione" className="preview-img" style={{ maxHeight: 260, objectFit: "contain" }} />}
        <div className="spinner" />
        <p>Leggo il foglio di prenotazione…</p>
      </div>
    );
  return (
    <div className="stack">
      <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => gestisci(e.target.files?.[0])} />
      <input ref={album} type="file" accept="image/*" hidden onChange={(e) => gestisci(e.target.files?.[0])} />
      <button className="primary big" onClick={() => foto.current?.click()}>
        Fotografa il foglio di prenotazione
      </button>
      <button className="big" onClick={() => album.current?.click()}>
        Scegli una foto (o uno screenshot dell'email)
      </button>
      {salta && (
        <button className="ghost" onClick={salta.azione}>
          {salta.testo}
        </button>
      )}
    </div>
  );
}

/** Dalla scheda di una visita prenotata: foto del foglio → aggiorna la visita. */
export function SchermataFoglio({ id }: { id: string }) {
  const { dati, sostituisci } = useApp();
  const imp = dati.impegni.find((i) => i.id === id);
  if (!imp) return null;
  return (
    <Sheet titolo="Foglio di prenotazione">
      <p className="muted">
        Leggo data, ora, dove andare, le istruzioni e cosa portare per <b>{imp.titolo}</b>. La foto resta salvata nella visita.
      </p>
      <ScattaFoglio
        imp={imp}
        fatto={({ campi, documento }) =>
          sostituisci({ k: "formImpegno", iniziale: { ...imp, ...campi }, titolo: "Controlla e salva", documento: { ...documento, impegno_id: imp.id } })
        }
      />
    </Sheet>
  );
}
