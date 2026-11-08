import { useState } from "react";
import { MOMENTI, NOME_MOMENTO, alGiorno, type Farmaco, type Momento } from "../../supabase/functions/_shared/tipi.ts";
import { giorniRimasti, scortaAttuale } from "../../supabase/functions/_shared/avvisi.ts";
import { aggiungiGiorni, giornoBreve, giornoEsteso, oggi } from "../../supabase/functions/_shared/date.ts";
import { copia, useApp } from "../lib/app.tsx";
import { uuid } from "../lib/backend.ts";
import { Modulo, Sheet, Vuoto, type Campo } from "./ui.tsx";

const numero = (v: unknown) => Number(String(v ?? "").replace(",", ".")) || 0;

/** 0.5 → "½", 1.5 → "1½" */
export function quantita(n: number | undefined): string {
  if (!n) return "";
  const intero = Math.floor(n);
  const resto = n - intero;
  const fr = Math.abs(resto - 0.5) < 0.01 ? "½" : Math.abs(resto - 0.25) < 0.01 ? "¼" : Math.abs(resto - 0.75) < 0.01 ? "¾" : resto ? String(resto).slice(1) : "";
  return (intero ? String(intero) : "") + fr;
}

function orari(f: Farmaco): string {
  const m = MOMENTI.filter((x) => Number(f.momenti?.[x]) > 0).map((x) => `${NOME_MOMENTO[x]} ${quantita(f.momenti[x])}`);
  return m.length ? m.join(" · ") : `${alGiorno(f)} al giorno`;
}

export function SchermataFarmaci() {
  const { dati, apri } = useApp();
  const g = oggi();
  const attivi = dati.farmaci.filter((f) => f.attivo).sort((a, b) => (giorniRimasti(a, g) ?? 999) - (giorniRimasti(b, g) ?? 999));
  const sospesi = dati.farmaci.filter((f) => !f.attivo);
  const inEsaurimento = attivi.filter((f) => (giorniRimasti(f, g) ?? 99) <= 10);
  return (
    <>
      <div className="top">
        <h1>Farmaci</h1>
        <button className="primary" onClick={() => apri({ k: "farmaco" })}>
          + Farmaco
        </button>
      </div>
      <section>
        {inEsaurimento.length > 0 && (
          <button className="alert urgente" onClick={() => apri({ k: "messaggioMedico" })}>
            <b>
              {inEsaurimento.length} {inEsaurimento.length === 1 ? "farmaco sta" : "farmaci stanno"} per finire
            </b>
            <span className="small">Tocca per preparare il messaggio per il medico</span>
          </button>
        )}
        {attivi.length > 0 && (
          <button className="big" onClick={() => apri({ k: "stampaTerapia" })}>
            Foglio delle pillole per la nonna
          </button>
        )}
        <p className="small muted">
          L'app toglie ogni giorno le pillole che la nonna prende. Quando comprate una scatola premi “Ho comprato”. Se i conti non tornano, premi “Correggi” e scrivi quante ce ne sono davvero.
        </p>
      </section>
      <section>
        {attivi.length ? (
          attivi.map((f) => {
            const r = giorniRimasti(f, g);
            const cls = r === null ? "" : r <= 5 ? "crit" : r <= 10 ? "warn" : "";
            return (
              <div className="card" key={f.id}>
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <div className="grow">
                    <h3>{f.nome}</h3>
                    <span className="small muted">
                      {orari(f)}
                      {f.quando && ` · ${f.quando}`}
                    </span>
                  </div>
                  {r !== null && <span className={"chip " + cls}>{r <= 0 ? "Finito" : `${r} giorni`}</span>}
                </div>
                {r !== null && (
                  <>
                    <div className={"bar " + cls}>
                      <span style={{ width: Math.min(100, (r / 60) * 100) + "%" }} />
                    </div>
                    <span className="small muted">
                      Circa {quantita(scortaAttuale(f, g)) || "0"} in casa · finisce verso il {giornoBreve(aggiungiGiorni(g, Math.max(0, r)), g)}
                    </span>
                  </>
                )}
                <div className="row">
                  <button className="grow primary mini" onClick={() => apri({ k: "comprato", id: f.id })}>
                    Ho comprato
                  </button>
                  <button className="grow mini" onClick={() => apri({ k: "correggiScorta", id: f.id })}>
                    Correggi
                  </button>
                  <button className="grow mini" onClick={() => apri({ k: "farmaco", id: f.id })}>
                    Modifica
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <Vuoto>Aggiungi i farmaci della nonna: quante pillole a colazione, pranzo, cena e sera, e quante ce ne sono in casa.</Vuoto>
        )}
      </section>
      {sospesi.length > 0 && (
        <section>
          <h2>Sospesi</h2>
          {sospesi.map((f) => (
            <button className="card" key={f.id} onClick={() => apri({ k: "farmaco", id: f.id })}>
              <span>{f.nome}</span>
            </button>
          ))}
        </section>
      )}
    </>
  );
}

const RAPIDI = [
  { l: "0", v: "0" },
  { l: "½", v: "0.5" },
  { l: "1", v: "1" },
  { l: "2", v: "2" },
];

export function FormFarmaco({ id }: { id?: string }) {
  const { dati, salva, elimina, chiudi, toast } = useApp();
  const [conferma, setConferma] = useState(false);
  const g = oggi();
  const esistente = dati.farmaci.find((x) => x.id === id);
  const f: Farmaco = esistente ?? { id: uuid(), nome: "", quando: "", momenti: {}, per_giorno: 0, scorta: 0, scorta_al: g, note: "", attivo: true };
  const campi: Campo[] = [
    { k: "nome", l: "Farmaco e dose", hint: "Es: Metformina 500 mg" },
    ...MOMENTI.map((m) => ({ k: "m_" + m, l: `Quante a ${NOME_MOMENTO[m].toLowerCase()}`, tipo: "number" as const, rapidi: RAPIDI })),
    { k: "quando", l: "Istruzioni", hint: "Es: durante il pasto, 14 unità dopo la glicemia" },
    {
      k: "scorta",
      l: "Quante pillole ci sono in casa adesso",
      tipo: "number",
      hint: "Conta le pillole di tutte le scatole, anche quelle aperte. Per l'insulina: quante dosi restano.",
    },
    { k: "note", l: "Note" },
    { k: "attivo", l: "Lo prende ancora", tipo: "check" },
  ];
  const iniziali = {
    nome: f.nome,
    quando: f.quando,
    ...Object.fromEntries(MOMENTI.map((m) => ["m_" + m, f.momenti?.[m] ? String(f.momenti[m]) : "0"])),
    scorta: esistente ? String(Math.round(scortaAttuale(f, g) * 10) / 10) : "",
    note: f.note,
    attivo: f.attivo,
  };
  return (
    <Sheet titolo={id ? f.nome : "Nuovo farmaco"}>
      <Modulo
        campi={campi}
        iniziali={iniziali}
        onSalva={async (v) => {
          const momenti = Object.fromEntries(MOMENTI.map((m) => [m, numero(v["m_" + m])]).filter(([, n]) => Number(n) > 0)) as Partial<Record<Momento, number>>;
          const nuovo: Farmaco = {
            ...f,
            nome: String(v.nome).trim(),
            quando: String(v.quando).trim(),
            momenti,
            per_giorno: 0,
            scorta: numero(v.scorta),
            scorta_al: g,
            note: String(v.note).trim(),
            attivo: Boolean(v.attivo),
          };
          nuovo.per_giorno = alGiorno(nuovo);
          if (!nuovo.nome) return toast("Scrivi il nome del farmaco");
          await salva("farmaci", nuovo);
          chiudi();
        }}
        extra={
          id &&
          (conferma ? (
            <button
              type="button"
              className="danger"
              onClick={async () => {
                await elimina("farmaci", f.id);
                chiudi();
              }}
            >
              Sì, elimina
            </button>
          ) : (
            <button type="button" className="danger" onClick={() => setConferma(true)}>
              Elimina farmaco
            </button>
          ))
        }
      />
    </Sheet>
  );
}

export function FormComprato({ id }: { id: string }) {
  const { dati, salva, chiudi, toast } = useApp();
  const f = dati.farmaci.find((x) => x.id === id);
  const g = oggi();
  if (!f) return null;
  return (
    <Sheet titolo={"Ho comprato: " + f.nome}>
      <p className="muted">Adesso in casa: circa {quantita(scortaAttuale(f, g)) || "0"}.</p>
      <Modulo
        campi={[{ k: "n", l: "Quante pillole hai aggiunto", tipo: "number", hint: "Quelle nella scatola nuova", rapidi: [14, 20, 28, 30, 56, 60].map((n) => ({ l: String(n), v: String(n) })) }]}
        iniziali={{ n: "" }}
        etichetta="Aggiungi"
        onSalva={async (v) => {
          const n = numero(v.n);
          if (!(n > 0)) return toast("Inserisci un numero");
          await salva("farmaci", { ...f, scorta: scortaAttuale(f, g) + n, scorta_al: g });
          toast("Scorta aggiornata");
          chiudi();
        }}
      />
    </Sheet>
  );
}

/** Quando i conti non tornano: si scrive quante pillole ci sono davvero adesso. */
export function FormCorreggiScorta({ id }: { id: string }) {
  const { dati, salva, chiudi, toast } = useApp();
  const f = dati.farmaci.find((x) => x.id === id);
  const g = oggi();
  if (!f) return null;
  return (
    <Sheet titolo={"Quante ne restano: " + f.nome}>
      <p className="muted">
        Secondo l'app dovrebbero essercene circa {quantita(scortaAttuale(f, g)) || "0"}. Conta quelle vere in tutte le scatole e scrivi il numero: da oggi l'app riparte da lì.
      </p>
      <Modulo
        campi={[{ k: "n", l: "Pillole in casa adesso", tipo: "number" }]}
        iniziali={{ n: "" }}
        etichetta="Salva"
        onSalva={async (v) => {
          if (String(v.n).trim() === "") return toast("Inserisci un numero");
          await salva("farmaci", { ...f, scorta: numero(v.n), scorta_al: g });
          toast("Conteggio corretto");
          chiudi();
        }}
      />
    </Sheet>
  );
}

/** Foglio grande da stampare e appendere vicino alle pillole. */
export function StampaTerapia() {
  const { dati, chiudi } = useApp();
  const attivi = dati.farmaci.filter((f) => f.attivo).sort((a, b) => a.nome.localeCompare(b.nome));
  const usati = MOMENTI.filter((m) => attivi.some((f) => Number(f.momenti?.[m]) > 0));
  const colonne = usati.length ? usati : MOMENTI;
  const nome = dati.profilo.nome || "la nonna";
  return (
    <div className="full stampa" role="dialog" aria-modal="true">
      <div className="wrap stack">
        <div className="row between no-print">
          <button onClick={() => chiudi()}>Chiudi</button>
          <button className="primary" onClick={() => window.print()}>
            Stampa
          </button>
        </div>
        <p className="small muted no-print">Dal computer: premi Stampa. Dal telefono: Stampa, oppure condividi la schermata. Ristampalo ogni volta che cambia la terapia.</p>
        <div className="foglio">
          <h1>Le pillole di {nome}</h1>
          <p className="muted">Aggiornato {giornoEsteso(oggi())}</p>
          <div style={{ overflowX: "auto" }}>
            <table className="terapia">
              <thead>
                <tr>
                  <th>Farmaco</th>
                  {colonne.map((m) => (
                    <th key={m}>{NOME_MOMENTO[m]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attivi.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <b>{f.nome}</b>
                      {f.quando && <div className="istr">{f.quando}</div>}
                    </td>
                    {colonne.map((m) => (
                      <td key={m} className="q">
                        {quantita(f.momenti?.[m])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {attivi.some((f) => !MOMENTI.some((m) => Number(f.momenti?.[m]) > 0)) && (
            <p className="small no-print" style={{ color: "var(--warn)" }}>
              Alcuni farmaci non hanno gli orari: aprili in Farmaci → Modifica e indica quante a colazione, pranzo, cena e sera.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function MessaggioMedico() {
  const { dati, toast } = useApp();
  const g = oggi();
  const tutti = dati.farmaci.filter((f) => f.attivo);
  const [scelti, setScelti] = useState<string[]>(tutti.filter((f) => (giorniRimasti(f, g) ?? 99) <= 15).map((f) => f.id));
  const medico = dati.contatti.find((c) => c.specialita === "Medicina generale" && c.tipo === "medico");
  const nomi = tutti.filter((f) => scelti.includes(f.id)).map((f) => "- " + f.nome);
  const testo = `Buongiorno, avrei bisogno delle ricette per ${dati.profilo.nome || "mia madre"}${dati.profilo.cf ? " (" + dati.profilo.cf + ")" : ""}:\n${nomi.join("\n")}\nGrazie mille!`;
  const tel = medico?.telefono.replace(/[^\d]/g, "") ?? "";
  const wa = `https://wa.me/${tel ? (tel.startsWith("39") ? tel : "39" + tel) : ""}?text=${encodeURIComponent(testo)}`;
  return (
    <Sheet titolo="Messaggio per il medico">
      <div className="card">
        {tutti.map((f) => (
          <label key={f.id} className="check-label">
            <input type="checkbox" checked={scelti.includes(f.id)} onChange={(e) => setScelti((s) => (e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id)))} />
            <span>
              {f.nome} <span className="hint">· {giorniRimasti(f, g) ?? "–"} giorni</span>
            </span>
          </label>
        ))}
      </div>
      <div className="card" style={{ whiteSpace: "pre-wrap" }}>
        {testo}
      </div>
      <a className="btn primary big" href={wa} target="_blank" rel="noreferrer">
        Invia su WhatsApp{medico ? " a " + medico.nome : ""}
      </a>
      <button onClick={() => copia(testo, toast)}>Copia il testo</button>
      {!medico && <p className="small muted">Aggiungi il medico di base nella Rubrica (reparto “Medicina generale”) per mandarglielo direttamente.</p>}
    </Sheet>
  );
}
