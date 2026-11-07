import { useEffect, useState } from "react";
import { useApp } from "../lib/app.tsx";

type Stato = "carico" | "non-supportato" | "ios-home" | "negato" | "attive" | "spente";

function chiaveBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

const supportate = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const iOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const daHome = () => matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

async function registrazione() {
  const r = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("./sw.js"));
  await navigator.serviceWorker.ready;
  return r;
}

/** Riquadro in Impostazioni: attiva le notifiche su QUESTO telefono. */
export function CardNotifiche() {
  const { backend, toast } = useApp();
  const [stato, setStato] = useState<Stato>("carico");
  const [lavoro, setLavoro] = useState(false);

  useEffect(() => {
    (async () => {
      if (!supportate()) return setStato(iOS() && !daHome() ? "ios-home" : "non-supportato");
      if (Notification.permission === "denied") return setStato("negato");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") {
        // tiene allineato il server (es. dopo un cambio di account)
        backend.salvaIscrizione(sub).catch(() => {});
        setStato("attive");
      } else setStato("spente");
    })().catch(() => setStato("spente"));
  }, [backend]);

  async function attiva() {
    setLavoro(true);
    try {
      const permesso = await Notification.requestPermission();
      if (permesso !== "granted") {
        setStato(permesso === "denied" ? "negato" : "spente");
        return;
      }
      const reg = await registrazione();
      const chiave = await backend.chiaveNotifiche();
      const vecchia = await reg.pushManager.getSubscription();
      if (vecchia) await vecchia.unsubscribe();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveBytes(chiave) });
      await backend.salvaIscrizione(sub);
      setStato("attive");
      toast("Notifiche attive su questo telefono");
    } catch (e) {
      toast("Non riesco ad attivarle: " + (e as Error).message);
    } finally {
      setLavoro(false);
    }
  }

  async function disattiva() {
    setLavoro(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await backend.rimuoviIscrizione(sub.endpoint);
        await sub.unsubscribe();
      }
      setStato("spente");
      toast("Notifiche spente su questo telefono");
    } catch (e) {
      toast("Errore: " + (e as Error).message);
    } finally {
      setLavoro(false);
    }
  }

  async function prova() {
    setLavoro(true);
    try {
      toast(await backend.provaNotifica());
    } catch (e) {
      toast("Prova non riuscita: " + (e as Error).message);
    } finally {
      setLavoro(false);
    }
  }

  return (
    <div className="card">
      <div className="row between">
        <h3>Notifiche su questo telefono</h3>
        {stato === "attive" && <span className="chip ok">Attive</span>}
      </div>
      <p className="small muted">Ogni mattina verso le 7 arriva una notifica con le cose da fare. Se non c'è niente, non arriva niente.</p>
      {backend.modalita === "demo" ? (
        <p className="small muted">Funzionano quando l'app è collegata a Supabase.</p>
      ) : stato === "carico" ? (
        <div className="spinner" />
      ) : stato === "ios-home" ? (
        <div className="alert info small">
          Su iPhone le notifiche funzionano solo aprendo l'app dall'icona sulla schermata Home. In Safari: tasto Condividi → “Aggiungi alla schermata Home”, poi apri l'app da lì e torna qui.
        </div>
      ) : stato === "non-supportato" ? (
        <div className="alert small">Questo browser non supporta le notifiche. Su Android usa Chrome, su iPhone apri l'app dalla schermata Home.</div>
      ) : stato === "negato" ? (
        <div className="alert small">
          Le notifiche sono bloccate per questo sito. Per sbloccarle:
          <br />• <b>Android</b>: Impostazioni del telefono → App → Chrome (o l'app “Nonna”) → Notifiche → attiva.
          <br />• <b>iPhone</b>: Impostazioni → Notifiche → Nonna → Consenti notifiche.
          <br />Poi riapri l'app.
        </div>
      ) : stato === "spente" ? (
        <button className="primary big" disabled={lavoro} onClick={attiva}>
          {lavoro ? "Attivo…" : "Attiva le notifiche"}
        </button>
      ) : (
        <div className="row">
          <button className="grow primary" disabled={lavoro} onClick={prova}>
            Mandami una prova
          </button>
          <button className="grow" disabled={lavoro} onClick={disattiva}>
            Spegni
          </button>
        </div>
      )}
    </div>
  );
}
