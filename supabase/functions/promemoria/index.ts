// Manda su WhatsApp (tramite CallMeBot) il riepilogo delle cose da fare.
// - Ogni mattina: la chiama GitHub Actions con l'intestazione x-cron-secret (segreto CRON_SECRET).
// - Dall'app: "Mandami un messaggio di prova" (solo a chi lo chiede).
import { admin, caricaDati, cors, json, membroDa, type Membro } from "../_shared/server.ts";
import { testoPromemoria } from "../_shared/avvisi.ts";
import { oggi } from "../_shared/date.ts";

async function invia(m: Membro, testo: string): Promise<string | null> {
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

  let destinatari: Membro[];
  if (daCron) {
    const { data, error } = await sb.from("membri").select("*").eq("promemoria", true);
    if (error) return json({ errore: error.message }, 500);
    destinatari = data as Membro[];
  } else {
    const m = await membroDa(req, sb);
    if (!m) return json({ errore: "Non autorizzato" }, 401);
    destinatari = [m];
  }

  let testo: string | null;
  try {
    testo = testoPromemoria(await caricaDati(sb), oggi());
  } catch (e) {
    return json({ errore: "Non riesco a leggere i dati: " + (e as Error).message }, 500);
  }

  if (!testo) {
    if (daCron) return json({ inviati: 0, messaggio: "Niente da ricordare oggi" });
    testo = "✅ Messaggio di prova: oggi non c'è niente di urgente per la nonna.";
  } else if (!daCron) {
    testo = "(prova) " + testo;
  }

  const errori: string[] = [];
  let inviati = 0;
  for (const m of destinatari) {
    const err = await invia(m, testo);
    if (err) errori.push(`${m.nome || m.email}: ${err}`);
    else inviati++;
  }
  if (!daCron && errori.length) return json({ errore: errori.join("; ") }, 502);
  return json({ inviati, errori, messaggio: inviati ? "Messaggio inviato: controlla WhatsApp" : "Nessun messaggio inviato" });
});
