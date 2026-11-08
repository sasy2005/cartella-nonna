import { useState } from "react";
import { SPECIALITA, type Contatto } from "../../supabase/functions/_shared/tipi.ts";
import { useApp } from "../lib/app.tsx";
import { uuid } from "../lib/backend.ts";
import { Modulo, Sheet, SpecChip, Vuoto, type Campo } from "./ui.tsx";

export function SchermataRubrica() {
  const { dati, apri } = useApp();
  const strutture = dati.contatti.filter((c) => c.tipo === "struttura");
  const medici = dati.contatti.filter((c) => c.tipo === "medico").sort((a, b) => a.specialita.localeCompare(b.specialita));
  const Card = ({ c }: { c: Contatto }) => (
    <div className="card">
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <h3 className="grow">{c.nome}</h3>
        <button className="ghost mini" onClick={() => apri({ k: "contatto", id: c.id })}>
          Modifica
        </button>
      </div>
      {c.telefono && (
        <a className="phone" style={{ fontSize: "1.3rem" }} href={"tel:" + c.telefono.replace(/[^\d+]/g, "")}>
          {c.telefono}
        </a>
      )}
      {c.orari && <span className="small muted">{c.orari}</span>}
      {c.note && <span className="small">{c.note}</span>}
      <div className="row">
        <SpecChip s={c.specialita} />
        {c.sito && (
          <a className="small" href={c.sito} target="_blank" rel="noreferrer">
            Sito →
          </a>
        )}
      </div>
    </div>
  );
  return (
    <>
      <div className="top">
        <h1>Rubrica</h1>
        <button className="primary" onClick={() => apri({ k: "contatto" })}>
          + Contatto
        </button>
      </div>
      <section>
        <h2>Numeri per prenotare</h2>
        <p className="small muted">Il CUP e i siti per prenotare online: li ritrovi in “Sto chiamando”.</p>
        {strutture.length ? strutture.map((c) => <Card key={c.id} c={c} />) : <Vuoto>Aggiungi il numero del CUP.</Vuoto>}
      </section>
      <section>
        <h2>Medici</h2>
        <p className="small muted">Metti almeno il medico di base (reparto “Medicina generale”): così dai Farmaci gli mandi su WhatsApp la richiesta delle ricette.</p>
        {medici.length ? medici.map((c) => <Card key={c.id} c={c} />) : <Vuoto>Aggiungi il medico di base e gli specialisti.</Vuoto>}
      </section>
    </>
  );
}

export function FormContatto({ id }: { id?: string }) {
  const { dati, salva, elimina, chiudi } = useApp();
  const [conferma, setConferma] = useState(false);
  const c: Contatto = dati.contatti.find((x) => x.id === id) ?? { id: uuid(), nome: "", tipo: "medico", specialita: "Medicina generale", telefono: "", orari: "", sito: "", note: "" };
  const campi: Campo[] = [
    { k: "nome", l: "Nome", hint: "Es: Dott.ssa Bianchi (così il messaggio inizia con «Buongiorno Dott.ssa Bianchi»)" },
    { k: "tipo", l: "È un", tipo: "select", opzioni: [["medico", "Medico"], ["struttura", "Numero per prenotare (CUP, ospedale)"]] },
    { k: "specialita", l: "Reparto", tipo: "select", opzioni: SPECIALITA.map((s) => [s, s]) },
    { k: "telefono", l: "Telefono", tipo: "tel" },
    { k: "orari", l: "Orari e come contattarlo", hint: "Es: chiamare dopo le 10, premere 2" },
    { k: "sito", l: "Sito per prenotare online", tipo: "url" },
    { k: "note", l: "Note", tipo: "textarea" },
  ];
  return (
    <Sheet titolo={id ? c.nome : "Nuovo contatto"}>
      <Modulo
        campi={campi}
        iniziali={{ ...c }}
        onSalva={async (v) => {
          await salva("contatti", {
            ...c,
            nome: String(v.nome).trim(),
            tipo: v.tipo as Contatto["tipo"],
            specialita: String(v.specialita),
            telefono: String(v.telefono).trim(),
            orari: String(v.orari).trim(),
            sito: String(v.sito).trim(),
            note: String(v.note).trim(),
          });
          chiudi();
        }}
        extra={
          id &&
          (conferma ? (
            <button
              type="button"
              className="danger"
              onClick={async () => {
                await elimina("contatti", c.id);
                chiudi();
              }}
            >
              Sì, elimina
            </button>
          ) : (
            <button type="button" className="danger" onClick={() => setConferma(true)}>
              Elimina contatto
            </button>
          ))
        }
      />
    </Sheet>
  );
}
