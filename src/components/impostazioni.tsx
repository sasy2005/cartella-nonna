import { useState } from "react";
import { useApp } from "../lib/app.tsx";
import { Modulo, Sheet, type Campo } from "./ui.tsx";
import { CardNotifiche } from "./notifiche.tsx";
import { TEMI, leggiTema, salvaTema, type Aspetto, type Tema } from "../lib/tema.ts";

function CardAspetto() {
  const [scelta, setScelta] = useState(leggiTema);
  const cambia = (tema: Tema, aspetto: Aspetto) => {
    setScelta({ tema, aspetto });
    salvaTema(tema, aspetto);
  };
  return (
    <div className="card">
      <h3>Colori</h3>
      <div className="temi">
        {TEMI.map((t) => (
          <button key={t.id} aria-pressed={scelta.tema === t.id} onClick={() => cambia(t.id, scelta.aspetto)}>
            <span className="campione" style={{ ["--c" as string]: t.chiaro }} />
            {t.nome}
          </button>
        ))}
      </div>
      <div className="segmentato" role="group" aria-label="Aspetto">
        {(
          [
            ["auto", "Automatico"],
            ["chiaro", "Chiaro"],
            ["scuro", "Scuro"],
          ] as [Aspetto, string][]
        ).map(([a, l]) => (
          <button key={a} aria-pressed={scelta.aspetto === a} onClick={() => cambia(scelta.tema, a)}>
            {l}
          </button>
        ))}
      </div>
      <p className="small muted">Vale solo per questo telefono. Automatico segue il telefono (chiaro di giorno, scuro se lo usi scuro).</p>
    </div>
  );
}

export function FormProfilo() {
  const { dati, salvaProfilo, chiudi, toast } = useApp();
  const campi: Campo[] = [
    { k: "nome", l: "Nome e cognome" },
    { k: "nascita", l: "Data di nascita", tipo: "date" },
    { k: "cf", l: "Codice fiscale" },
    { k: "tessera", l: "Numero tessera sanitaria", hint: "Il numero lungo sul retro" },
    { k: "esenzioni", l: "Esenzioni", hint: "Es: 013 diabete" },
    { k: "medico", l: "Medico di base" },
    { k: "indirizzo", l: "Indirizzo di casa" },
    { k: "disponibilita", l: "Quando può fare visite ed esami", tipo: "textarea", hint: "Lo vedi mentre chiami per prenotare" },
    { k: "note", l: "Allergie e cose importanti", tipo: "textarea" },
  ];
  return (
    <Sheet titolo="Dati della nonna">
      <p className="small muted">Servono quando chiami per prenotare: li trovi tutti nella schermata “Sto chiamando”.</p>
      <Modulo
        campi={campi}
        iniziali={{ ...dati.profilo }}
        onSalva={async (v) => {
          await salvaProfilo(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x).trim()])) as never);
          toast("Salvato");
          chiudi();
        }}
      />
    </Sheet>
  );
}

export function SchermataImpostazioni() {
  const { backend, apri, dati, toast } = useApp();
  const [conferma, setConferma] = useState(false);

  const backup = () => {
    const blob = new Blob([JSON.stringify(dati, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cartella-nonna-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  return (
    <Sheet titolo="Impostazioni">
      <a className="card" href="./guida.html" style={{ textDecoration: "none", color: "inherit", fontWeight: 400 }}>
        <b>Come funziona l'app</b>
        <span className="small muted">Una guida breve con le foto, da leggere con calma</span>
      </a>
      <button className="card" onClick={() => apri({ k: "profilo" })}>
        <b>Dati della nonna</b>
        <span className="small muted">{dati.profilo.nome || "Nome, codice fiscale, tessera, esenzioni"}</span>
      </button>

      <CardNotifiche />

      <CardAspetto />

      <div className="card">
        <h3>Copia di sicurezza</h3>
        <p className="small muted">Scarica tutti i dati (senza le foto) in un file. {backend.modalita === "cloud" && "Le foto restano su Supabase."}</p>
        <button onClick={backup}>Scarica i dati</button>
      </div>

      {backend.modalita === "cloud" ? (
        <button className="danger" onClick={() => backend.esci().then(() => location.reload())}>
          Esci
        </button>
      ) : conferma ? (
        <button className="danger" onClick={() => backend.esci().then(() => location.reload())}>
          Sì, ricomincia con gli esempi
        </button>
      ) : (
        <button className="danger" onClick={() => setConferma(true)}>
          Cancella le prove e ricomincia
        </button>
      )}
    </Sheet>
  );
}
