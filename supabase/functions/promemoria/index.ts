// Promemoria del mattino: notifica sul telefono (e WhatsApp tramite CallMeBot, se configurato).
// - Ogni mattina: la chiama GitHub Actions con l'intestazione x-cron-secret (segreto CRON_SECRET).
// - Dall'app: { chiave: true } per iscriversi alle notifiche, { prova: "notifica" | "whatsapp" } per una prova.
import { admin, caricaDati, cors, json, membroDa, type Membro } from "../_shared/server.ts";
import { notificaPromemoria, testoPromemoria } from "../_shared/avvisi.ts";
import { oggi } from "../_shared/date.ts";
import { chiaviVapid, inviaPush, type Iscrizione } from "../_shared/push.ts";

async function inviaWhatsapp(m: Membro, testo: string): Promise<string | null> {
  if (!m.whatsapp_tel || !m.callmebot_key) return "numero o codice CallMeBot mancante";
  const url = new URL("https://api.callmebot.com/whatsapp.php");
  url.searchParams.set("phone", m.whatsapp_tel.replace(/\s/g, ""));
  url.searchParams.set("text", testo);
  url.searchParams.set("apikey", m.callmebot_key);
  try {
    const r = await fetch(url);
    const corpo = await r.text();
    if (!r.ok || /error|invalid|wrong/i.test(corpo.slice(0, 300))) return `CallMeBot ha risposto: ${corpo.replace(/<[^>]+>/g, " ").trim().slice(0, 160)}`;
    return null;
  } catch (e) {
    return "CallMeBot non raggiungibile: " + (e as Error).message;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ errore: "Metodo non permesso" }, 405);
  const sb = admin();
  const segreto = Deno.env.get("CRON_SECRET");
  const daCron = Boolean(segreto) && req.headers.get("x-cron-secret") === segreto;
  let body: { chiave?: boolean; prova?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* corpo vuoto */
  }

  let membro: Membro | null = null;
  if (!daCron) {
    membro = await membroDa(req, sb);
    if (!membro) return json({ errore: "Non autorizzato" }, 401);
  }

  // Chiave pubblica per iscrivere un telefono alle notifiche.
  if (body.chiave && membro) {
    try {
      return json({ chiave: (await chiaviVapid(sb)).publicKey });
    } catch (e) {
      return json({ errore: (e as Error).message }, 500);
    }
  }

  let dati;
  try {
    dati = await caricaDati(sb);
  } catch (e) {
    return json({ errore: "Non riesco a leggere i dati: " + (e as Error).message }, 500);
  }
  const g = oggi();
  const notifica = notificaPromemoria(dati, g);
  const testo = testoPromemoria(dati, g);

  // Indirizzo di contatto richiesto dallo standard: l'email del primo membro.
  const { data: membri } = await sb.from("membri").select("*");
  const tutti = (membri ?? []) as Membro[];
  const contatto = "mailto:" + (membro?.email ?? tutti[0]?.email ?? "cartella-nonna@example.com");

  /* ---------- Prova dall'app ---------- */
  if (membro) {
    if (body.prova === "whatsapp") {
      const err = await inviaWhatsapp(membro, "(prova) " + (testo ?? "✅ Oggi non c'è niente di urgente per la nonna."));
      return err ? json({ errore: err }, 502) : json({ messaggio: "Messaggio inviato: controlla WhatsApp" });
    }
    const { data: iscr } = await sb.from("notifiche_iscrizioni").select("*").ilike("email", membro.email);
    if (!iscr?.length) return json({ errore: "Questo account non ha ancora attivato le notifiche su nessun telefono." }, 400);
    const r = await inviaPush(
      sb,
      iscr as Iscrizione[],
      notifica
        ? { titolo: "Prova · " + notifica.titolo, testo: notifica.testo, tag: "prova" }
        : { titolo: "Le notifiche funzionano ✅", testo: "Oggi non c'è niente di urgente per la nonna.", tag: "prova" },
      contatto,
    );
    if (!r.inviati) return json({ errore: r.errori.join("; ") || "Nessuna notifica inviata" }, 502);
    return json({ messaggio: `Notifica inviata a ${r.inviati} ${r.inviati === 1 ? "telefono" : "telefoni"}`, errori: r.errori });
  }

  /* ---------- Giro del mattino ---------- */
  if (!notifica || !testo) return json({ inviati: 0, messaggio: "Niente da ricordare oggi" });
  const attivi = new Set(tutti.filter((m) => m.promemoria).map((m) => m.email.toLowerCase()));
  const { data: iscr } = await sb.from("notifiche_iscrizioni").select("*");
  const daAvvisare = ((iscr ?? []) as Iscrizione[]).filter((s) => attivi.has(s.email.toLowerCase()));
  const push = await inviaPush(sb, daAvvisare, { ...notifica, tag: "promemoria" }, contatto);

  let whatsapp = 0;
  const errori = [...push.errori];
  for (const m of tutti.filter((x) => x.promemoria && x.whatsapp_tel && x.callmebot_key)) {
    const err = await inviaWhatsapp(m, testo);
    if (err) errori.push(`${m.nome || m.email} (WhatsApp): ${err}`);
    else whatsapp++;
  }
  return json({ notifiche: push.inviati, whatsapp, errori });
});
