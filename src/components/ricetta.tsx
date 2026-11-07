import { useRef, useState } from "react";
import { SPECIALITA, type Impegno } from "../../supabase/functions/_shared/tipi.ts";
import { blobBase64, comprimiImmagine, useApp } from "../lib/app.tsx";
import { Sheet } from "./ui.tsx";

/** Foto della ricetta → lettura automatica → modulo già compilato da controllare. */
export function SchermataRicetta({ perVisitaId }: { perVisitaId?: string }) {
  const { backend, sostituisci, toast } = useApp();
  const [fase, setFase] = useState<"scegli" | "leggo">("scegli");
  const [anteprima, setAnteprima] = useState("");
  const foto = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const base: Partial<Impegno> = perVisitaId ? { tipo: "esame", per_visita_id: perVisitaId } : {};

  const vaiAlModulo = (p: Partial<Impegno>) => sostituisci({ k: "formImpegno", iniziale: { ...base, ...p }, titolo: "Controlla e salva" });

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
        return vaiAlModulo({ ricetta_path: path });
      }
      const l = await backend.leggiRicetta(await blobBase64(img), "image/jpeg");
      const note = [
        l.prestazioni.length > 1 ? "Prestazioni: " + l.prestazioni.join(", ") : "",
        l.quesito ? "Motivo: " + l.quesito : "",
        l.esenzione ? "Esenzione: " + l.esenzione : "",
        l.note_lettura ? "Da controllare: " + l.note_lettura : "",
      ]
        .filter(Boolean)
        .join("\n");
      toast("Ricetta letta: controlla i dati");
      vaiAlModulo({
        tipo: perVisitaId ? "esame" : l.tipo,
        titolo: l.titolo,
        specialita: (SPECIALITA as readonly string[]).includes(l.specialita) ? l.specialita : "Altro",
        priorita: l.priorita || null,
        nre: l.nre,
        data_ricetta: /^\d{4}-\d{2}-\d{2}$/.test(l.data_ricetta) ? l.data_ricetta : null,
        prescrittore: l.prescrittore,
        note,
        giorni_referto: l.tipo === "esame" ? (/sangue|emocromo|glic|urin|creatin|ferritin/i.test(l.titolo) ? 3 : /eco/i.test(l.titolo) ? 7 : 0) : 0,
        ricetta_path: path,
      });
    } catch (e) {
      toast("Non sono riuscito a leggerla: " + (e as Error).message);
      vaiAlModulo(path ? { ricetta_path: path } : {});
    }
  }

  return (
    <Sheet titolo="Nuova ricetta">
      {fase === "leggo" ? (
        <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
          {anteprima && <img src={anteprima} alt="Ricetta" className="preview-img" style={{ maxHeight: 260, objectFit: "contain" }} />}
          <div className="spinner" />
          <p>Leggo la ricetta… ci vogliono pochi secondi.</p>
        </div>
      ) : (
        <div className="stack">
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
          <button className="ghost" onClick={() => vaiAlModulo({})}>
            Compila a mano senza foto
          </button>
        </div>
      )}
    </Sheet>
  );
}
