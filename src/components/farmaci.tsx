import { useState } from "react";
import type { Farmaco } from "../../supabase/functions/_shared/tipi.ts";
import { giorniRimasti, scortaAttuale } from "../../supabase/functions/_shared/avvisi.ts";
import { aggiungiGiorni, giornoBreve, oggi } from "../../supabase/functions/_shared/date.ts";
import { copia, useApp } from "../lib/app.tsx";
import { uuid } from "../lib/backend.ts";
import { Modulo, Sheet, Vuoto, type Campo } from "./ui.tsx";

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
            <b>{inEsaurimento.length} {inEsaurimento.length === 1 ? "farmaco sta" : "farmaci stanno"} per finire</b>
            <span className="small">Tocca per preparare il messaggio per il medico</span>
          </button>
        )}
        <p className="small muted">
          Quando compri le scatole premi “Ho comprato”: l'app conta quante ne restano e ti avvisa 10 giorni prima che finiscano.
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
                    <span className="small muted">{f.quando}{f.note && ` · ${f.note}`}</span>
                  </div>
                  {r !== null && (
                    <span className={"chip " + cls}>
                      {r <= 0 ? "Finito" : `${r} giorni`}
                    </span>
                  )}
                </div>
                {r !== null && (
                  <>
                    <div className={"bar " + cls}>
                      <span style={{ width: Math.min(100, (r / 60) * 100) + "%" }} />
                    </div>
                    <span className="small muted">
                      Circa {Math.round(scortaAttuale(f, g))} in casa · finisce verso il {giornoBreve(aggiungiGiorni(g, Math.max(0, r)), g)}
                    </span>
                  </>
                )}
                <div className="row">
                  <button className="grow primary mini" onClick={() => apri({ k: "comprato", id: f.id })}>
                    Ho comprato
                  </button>
                  <button className="grow mini" onClick={() => apri({ k: "farmaco", id: f.id })}>
                    Modifica
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <Vuoto>Aggiungi i farmaci della nonna: nome, quante al giorno e quante ce ne sono in casa.</Vuoto>
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

export function FormFarmaco({ id }: { id?: string }) {
  const { dati, salva, elimina, chiudi } = useApp();
  const [conferma, setConferma] = useState(false);
  const g = oggi();
  const f: Farmaco = dati.farmaci.find((x) => x.id === id) ?? { id: uuid(), nome: "", quando: "", per_giorno: 1, scorta: 0, scorta_al: g, note: "", attivo: true };
  const campi: Campo[] = [
    { k: "nome", l: "Farmaco e dose", hint: "Es: Metformina 500 mg" },
    { k: "quando", l: "Quando lo prende", hint: "Es: Colazione e cena", rapidi: [{ l: "Colazione", v: "Colazione" }, { l: "Pranzo", v: "Pranzo" }, { l: "Cena", v: "Cena" }, { l: "Ai 3 pasti", v: "Colazione, pranzo e cena" }] },
    { k: "per_giorno", l: "Quante al giorno", tipo: "number", hint: "Per l'insulina: 1 = un giorno di penna" },
    { k: "scorta", l: "Quante ce ne sono in casa adesso", tipo: "number", hint: "Conta compresse (non scatole)" },
    { k: "note", l: "Note" },
    { k: "attivo", l: "Lo prende ancora", tipo: "check" },
  ];
  return (
    <Sheet titolo={id ? f.nome : "Nuovo farmaco"}>
      <Modulo
        campi={campi}
        iniziali={{ nome: f.nome, quando: f.quando, per_giorno: String(f.per_giorno), scorta: String(Math.round(scortaAttuale(f, g))), note: f.note, attivo: f.attivo }}
        onSalva={async (v) => {
          await salva("farmaci", {
            ...f,
            nome: String(v.nome).trim(),
            quando: String(v.quando).trim(),
            per_giorno: Number(String(v.per_giorno).replace(",", ".")) || 0,
            scorta: Number(String(v.scorta).replace(",", ".")) || 0,
            scorta_al: g,
            note: String(v.note).trim(),
            attivo: Boolean(v.attivo),
          });
          chiudi();
        }}
        extra={
          id &&
          (conferma ? (
            <button
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
      <Modulo
        campi={[{ k: "n", l: "Quante compresse (o giorni di penna) hai aggiunto", tipo: "number", rapidi: [{ l: "14", v: "14" }, { l: "20", v: "20" }, { l: "28", v: "28" }, { l: "30", v: "30" }, { l: "56", v: "56" }, { l: "60", v: "60" }] }]}
        iniziali={{ n: "" }}
        etichetta="Aggiungi alla scorta"
        onSalva={async (v) => {
          const n = Number(String(v.n).replace(",", "."));
          if (!(n > 0)) return toast("Inserisci un numero");
          await salva("farmaci", { ...f, scorta: scortaAttuale(f, g) + n, scorta_al: g });
          toast("Scorta aggiornata");
          chiudi();
        }}
      />
    </Sheet>
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
      <div className="card" style={{ whiteSpace: "pre-wrap" }}>{testo}</div>
      <a className="btn primary big" href={wa} target="_blank" rel="noreferrer">
        Invia su WhatsApp{medico ? " a " + medico.nome : ""}
      </a>
      <button onClick={() => copia(testo, toast)}>Copia il testo</button>
      {!medico && <p className="small muted">Aggiungi il medico di base nella Rubrica (reparto “Medicina generale”) per mandarglielo direttamente.</p>}
    </Sheet>
  );
}
