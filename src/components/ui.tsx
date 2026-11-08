import { useEffect, useState, type ReactNode } from "react";
import { COLORE_SPECIALITA, type Impegno } from "../../supabase/functions/_shared/tipi.ts";
import { useApp } from "../lib/app.tsx";

export function Sheet({ titolo, children, sopra }: { titolo: ReactNode; children: ReactNode; sopra?: ReactNode }) {
  const { chiudi } = useApp();
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && chiudi()}>
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="maniglia" aria-hidden="true" />
        <div className="row between">
          <div className="grow">{sopra}</div>
          <button className="ghost" onClick={() => chiudi()}>
            Chiudi
          </button>
        </div>
        {typeof titolo === "string" ? <h2>{titolo}</h2> : titolo}
        {children}
      </div>
    </div>
  );
}

export function SpecChip({ s }: { s: string }) {
  return (
    <span className="chip">
      <span className="dot" style={{ ["--c" as string]: COLORE_SPECIALITA[s] ?? COLORE_SPECIALITA.Altro }} />
      {s}
    </span>
  );
}

const STATO: Record<Impegno["stato"], [string, string]> = {
  da_prenotare: ["Da prenotare", "warn"],
  prenotato: ["Prenotato", "acc"],
  fatto: ["Fatto", "ok"],
  annullato: ["Annullato", ""],
};
export function StatoChip({ s }: { s: Impegno["stato"] }) {
  return <span className={"chip " + STATO[s][1]}>{STATO[s][0]}</span>;
}

export function TipoChip({ t }: { t: Impegno["tipo"] }) {
  return <span className="chip">{t === "visita" ? "Visita" : "Esame"}</span>;
}

export function Vuoto({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/* ---------- Moduli ---------- */

export type Campo =
  | { k: string; l: string; tipo?: "text" | "tel" | "email" | "url" | "number" | "date" | "datetime-local"; hint?: string; rapidi?: { l: string; v: string }[] }
  | { k: string; l: string; tipo: "textarea"; hint?: string }
  | { k: string; l: string; tipo: "select"; opzioni: [string, string][]; hint?: string }
  | { k: string; l: string; tipo: "check"; hint?: string };

export type Valori = Record<string, string | boolean>;

export function Modulo({
  campi,
  iniziali,
  onSalva,
  etichetta = "Salva",
  extra,
}: {
  campi: Campo[];
  iniziali: Valori;
  onSalva: (v: Valori) => void | Promise<void>;
  etichetta?: string;
  extra?: ReactNode;
}) {
  const [v, setV] = useState<Valori>(iniziali);
  const [salvo, setSalvo] = useState(false);
  const set = (k: string, x: string | boolean) => setV((o) => ({ ...o, [k]: x }));
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setSalvo(true);
        try {
          await onSalva(v);
        } finally {
          setSalvo(false);
        }
      }}
    >
      {campi.map((c) => {
        const id = "f-" + c.k;
        if (c.tipo === "check")
          return (
            <label key={c.k} className="check-label" htmlFor={id}>
              <input id={id} type="checkbox" checked={Boolean(v[c.k])} onChange={(e) => set(c.k, e.target.checked)} />
              <span>
                {c.l}
                {c.hint && <span className="hint"> · {c.hint}</span>}
              </span>
            </label>
          );
        return (
          <label key={c.k} htmlFor={id}>
            {c.l}
            {c.hint && <span className="hint">{c.hint}</span>}
            {c.tipo === "textarea" ? (
              <textarea id={id} value={String(v[c.k] ?? "")} onChange={(e) => set(c.k, e.target.value)} />
            ) : c.tipo === "select" ? (
              <select id={id} value={String(v[c.k] ?? "")} onChange={(e) => set(c.k, e.target.value)}>
                {c.opzioni.map(([val, lab]) => (
                  <option key={val} value={val}>
                    {lab}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  id={id}
                  type={c.tipo ?? "text"}
                  inputMode={c.tipo === "number" ? "decimal" : undefined}
                  value={String(v[c.k] ?? "")}
                  onChange={(e) => set(c.k, e.target.value)}
                />
                {"rapidi" in c && c.rapidi && (
                  <span className="quick">
                    {c.rapidi.map((r) => (
                      <button type="button" key={r.l} onClick={() => set(c.k, r.v)} aria-pressed={v[c.k] === r.v}>
                        {r.l}
                      </button>
                    ))}
                  </span>
                )}
              </>
            )}
          </label>
        );
      })}
      <button className="primary big" type="submit" disabled={salvo}>
        {salvo ? "Salvo…" : etichetta}
      </button>
      {extra}
    </form>
  );
}

/** Mostra una foto/PDF salvato (chiede l'indirizzo temporaneo al backend). */
export function FileSalvato({ path, tipo, alt }: { path: string; tipo?: string; alt: string }) {
  const { backend } = useApp();
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    let vivo = true;
    backend.urlFile(path).then((u) => vivo && setUrl(u)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [backend, path]);
  if (!url) return <div className="empty">Carico…</div>;
  if ((tipo ?? "").includes("pdf"))
    return (
      <a className="btn primary big" href={url} target="_blank" rel="noreferrer">
        Apri il PDF
      </a>
    );
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img className="preview-img" src={url} alt={alt} />
    </a>
  );
}

export function Miniatura({ path, tipo }: { path: string | null; tipo: string }) {
  const { backend } = useApp();
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!path || tipo.includes("pdf")) return;
    let vivo = true;
    backend.urlFile(path).then((u) => vivo && setUrl(u)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [backend, path, tipo]);
  if (url) return <img src={url} alt="" loading="lazy" />;
  return <span>{tipo.includes("pdf") ? "PDF" : path ? "…" : "Senza foto"}</span>;
}

export const ICONE: Record<string, ReactNode> = {
  oggi: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  impegni: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  farmaci: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <path d="M12 8v8" />
    </>
  ),
  rubrica: <path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a1 1 0 0 1-1 1A17 17 0 0 1 4 5a1 1 0 0 1 1-1z" />,
  archivio: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10h14V9M10 13h4" />
    </>
  ),
  fotocamera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  ripeti: <path d="M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4" />,
  documento: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4" />,
  ingranaggio: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  freccia: <path d="M9 5l7 7-7 7" />,
  spunta: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};

export function Icona({ nome }: { nome: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONE[nome]}
    </svg>
  );
}
