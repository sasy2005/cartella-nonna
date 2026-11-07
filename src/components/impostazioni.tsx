import { useEffect, useState } from "react";
import { useApp } from "../lib/app.tsx";
import type { Membro } from "../lib/backend.ts";
import { Modulo, Sheet, type Campo } from "./ui.tsx";
import { CardNotifiche } from "./notifiche.tsx";

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
  const [membro, setMembro] = useState<Membro | null>(null);
  const [invio, setInvio] = useState(false);
  const [conferma, setConferma] = useState(false);

  useEffect(() => {
    backend.membro().then(setMembro).catch(() => {});
  }, [backend]);

  const backup = () => {
    const blob = new Blob([JSON.stringify(dati, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cartella-nonna-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const campiWa: Campo[] = [
    { k: "nome", l: "Il tuo nome" },
    { k: "whatsapp_tel", l: "Il tuo numero WhatsApp", tipo: "tel", hint: "Con il prefisso: +39 333 1234567" },
    { k: "callmebot_key", l: "Codice CallMeBot (apikey)", hint: "Te lo manda il bot su WhatsApp: vedi la guida qui sotto" },
    { k: "promemoria", l: "Mandami il riepilogo ogni mattina", tipo: "check", hint: "vale per notifiche e WhatsApp" },
  ];

  return (
    <Sheet titolo="Impostazioni">
      <button className="card" onClick={() => apri({ k: "profilo" })}>
        <b>Dati della nonna</b>
        <span className="small muted">{dati.profilo.nome || "Nome, codice fiscale, tessera, esenzioni"}</span>
      </button>

      <CardNotifiche />

      <div className="card">
        <h3>WhatsApp (facoltativo)</h3>
        <p className="small muted">Usa il servizio gratuito CallMeBot. Se risponde “This Bot is full”, è pieno: riprova tra qualche giorno con il nuovo numero che trovi sul loro sito.</p>
        {backend.modalita === "demo" ? (
          <p className="small muted">Funzionano quando l'app è collegata a Supabase (vedi GUIDA.md). In modalità prova non partono messaggi.</p>
        ) : membro ? (
          <>
            <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Salva in rubrica il numero di CallMeBot che trovi su callmebot.com (sezione WhatsApp).</li>
              <li>Mandagli su WhatsApp il messaggio: <b>I allow callmebot to send me messages</b></li>
              <li>Ti risponde con un codice (apikey): scrivilo qui sotto.</li>
            </ol>
            <Modulo
              campi={campiWa}
              iniziali={{ ...membro }}
              onSalva={async (v) => {
                const m = { nome: String(v.nome).trim(), whatsapp_tel: String(v.whatsapp_tel).replace(/\s/g, ""), callmebot_key: String(v.callmebot_key).trim(), promemoria: Boolean(v.promemoria) };
                try {
                  await backend.salvaMembro(m);
                  setMembro({ ...membro, ...m });
                  toast("Salvato");
                } catch (e) {
                  toast("Non salvato: " + (e as Error).message);
                }
              }}
            />
            <button
              disabled={invio}
              onClick={async () => {
                setInvio(true);
                try {
                  toast(await backend.inviaProva());
                } catch (e) {
                  toast("Invio non riuscito: " + (e as Error).message);
                } finally {
                  setInvio(false);
                }
              }}
            >
              {invio ? "Invio…" : "Mandami ora un messaggio di prova"}
            </button>
          </>
        ) : (
          <p className="small muted">Il tuo account non è ancora nella lista dei membri della famiglia (tabella “membri” su Supabase).</p>
        )}
      </div>

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
