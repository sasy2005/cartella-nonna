// Promemoria del mattino: notifica sul telefono (e WhatsApp tramite CallMeBot, se configurato).
// - Ogni ora la chiama l'orologio interno di Supabase ({ giro: "auto" }, intestazione x-cron-token):
//   alle 7 italiane manda il riepilogo, una volta al giorno.
// - GitHub Actions: { pianifica: true } dopo ogni aggiornamento (attiva l'orologio), oppure senza corpo
//   per mandare subito il riepilogo (intestazione x-cron-secret).
// - Dall'app: { chiave: true } per iscriversi, { prova: "notifica" | "whatsapp" }, { stato: true }.
import { admin, caricaDati, cors, json, membroDa, type Membro } from "../_shared/server.ts";
import { notificaPromemoria, testoPromemoria } from "../_shared/avvisi.ts";
import { oggi, oraItaliana } from "../_shared/date.ts";
import { chiaviVapid, inviaPush, type Iscrizione } from "../_shared/push.ts";
import Anthropic from "npm:@anthropic-ai/sdk@1.6.0";

/** La chiave di Claude funziona? (chiamata gratuita: elenco modelli) */
async function controllaClaude(): Promise<string> {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return "chiave mancante";
  try {
    await new Anthropic().models.list({ limit: 1 });
    return "ok";
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return "chiave non valida";
    if (e instanceof Anthropic.PermissionDeniedError) return "chiave senza permessi";
    if (e instanceof Anthropic.APIConnectionError) return "servizio non raggiungibile";
    if (e instanceof Anthropic.APIError) return "errore " + e.status;
    return "errore";
  }
}

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
  const daGithub = Boolean(segreto) && req.headers.get("x-cron-secret") === segreto;
  let daOrologio = false;
  const token = req.headers.get("x-cron-token");
  if (token) {
    const { data } = await sb.from("config_server").select("valore").eq("chiave", "cron_token").maybeSingle();
    daOrologio = Boolean(data?.valore) && data!.valore === token;
  }
  const daCron = daGithub || daOrologio;
  let body: { chiave?: boolean; prova?: string; stato?: boolean; pianifica?: boolean; giro?: string; verifica?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* corpo vuoto */
  }

  // Attiva (o riattiva) l'orologio interno di Supabase.
  if (body.pianifica && daGithub) {
    const { data, error } = await sb.rpc("pianifica_promemoria", { base_url: Deno.env.get("SUPABASE_URL")! });
    return error ? json({ errore: error.message }, 500) : json({ messaggio: data });
  }

  // Controllo completo (workflow "Controllo completo"): solo numeri e stati, nessun dato personale.
  if (body.verifica && daGithub) {
    const conta = async (t: string) => (await sb.from(t).select("*", { count: "exact", head: true })).count ?? -1;
    const { data: diag, error: errDiag } = await sb.rpc("diagnostica");
    const { data: vapid } = await sb.from("config_server").select("chiave").eq("chiave", "vapid").maybeSingle();
    const { data: giro } = await sb.from("config_server").select("valore").eq("chiave", "ultimo_giro").maybeSingle();
    let ultimo: Record<string, unknown> | null = null;
    try {
      const u = giro ? JSON.parse(giro.valore) : null;
      ultimo = u ? { quando: u.quando, notifiche: u.notifiche, errori: (u.errori ?? []).length, niente: u.niente } : null;
    } catch {
      /* niente */
    }
    let datiOk = "ok";
    try {
      await caricaDati(sb);
    } catch (e) {
      datiOk = (e as Error).message;
    }
    return json({
      ora_italiana: oraItaliana(),
      diagnostica: errDiag ? "errore: " + errDiag.message : diag,
      chiavi_notifiche: Boolean(vapid),
      telefoni_iscritti: await conta("notifiche_iscrizioni"),
      membri: await conta("membri"),
      impegni: await conta("impegni"),
      farmaci: await conta("farmaci"),
      documenti: await conta("documenti"),
      lettura_dati: datiOk,
      claude: await controllaClaude(),
      ultimo_giro: ultimo,
    });
  }

  // Il giro automatico parte solo alle 7 italiane e una volta al giorno.
  if (body.giro === "auto") {
    if (!daOrologio) return json({ errore: "Non autorizzato" }, 401);
    if (oraItaliana() !== 7) return json({ saltato: "non sono le 7" });
    const { data } = await sb.from("config_server").select("valore").eq("chiave", "ultimo_mattino").maybeSingle();
    if (data?.valore === oggi()) return json({ saltato: "già inviato oggi" });
    await sb.from("config_server").upsert({ chiave: "ultimo_mattino", valore: oggi() });
  }

  let membro: Membro | null = null;
  if (!daCron) {
    membro = await membroDa(req, sb);
    if (!membro) return json({ errore: "Non autorizzato" }, 401);
  }

  // Quando è partito l'ultimo riepilogo (lo mostra l'app in Impostazioni).
  if (body.stato && membro) {
    const { data } = await sb.from("config_server").select("valore").eq("chiave", "ultimo_giro").maybeSingle();
    return json(data ? JSON.parse(data.valore) : {});
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
  const registra = (esito: Record<string, unknown>) =>
    sb.from("config_server").upsert({ chiave: "ultimo_giro", valore: JSON.stringify({ quando: new Date().toISOString(), ...esito }) });
  if (!notifica || !testo) {
    await registra({ notifiche: 0, whatsapp: 0, errori: [], niente: true });
    return json({ inviati: 0, messaggio: "Niente da ricordare oggi" });
  }
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
  await registra({ notifiche: push.inviati, whatsapp, errori, niente: false });
  return json({ notifiche: push.inviati, whatsapp, errori });
});
