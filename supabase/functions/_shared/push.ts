// Notifiche Web Push (standard dei browser: Chrome/Android, Safari/iPhone con app sulla Home).
import webpush from "npm:web-push@3.6.7";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface Iscrizione {
  endpoint: string;
  email: string;
  p256dh: string;
  auth: string;
}

export interface Notifica {
  titolo: string;
  testo: string;
  url?: string;
  tag?: string;
}

interface Vapid {
  publicKey: string;
  privateKey: string;
}

/** Le chiavi dell'app per firmare le notifiche: create alla prima richiesta e salvate nel database. */
export async function chiaviVapid(sb: SupabaseClient): Promise<Vapid> {
  const leggi = async () => {
    const { data, error } = await sb.from("config_server").select("valore").eq("chiave", "vapid").maybeSingle();
    if (error) throw new Error("config_server: " + error.message);
    return data ? (JSON.parse(data.valore) as Vapid) : null;
  };
  const esistenti = await leggi();
  if (esistenti) return esistenti;
  const nuove = webpush.generateVAPIDKeys();
  // se due richieste arrivano insieme, vince la prima e l'altra rilegge
  await sb.from("config_server").upsert({ chiave: "vapid", valore: JSON.stringify(nuove) }, { onConflict: "chiave", ignoreDuplicates: true });
  return (await leggi()) ?? nuove;
}

/** Manda la notifica a ogni iscrizione. Cancella quelle non più valide (telefono cambiato, permesso tolto). */
export async function inviaPush(
  sb: SupabaseClient,
  iscrizioni: Iscrizione[],
  n: Notifica,
  contatto: string,
): Promise<{ inviati: number; errori: string[] }> {
  const vapid = await chiaviVapid(sb);
  const payload = JSON.stringify(n);
  let inviati = 0;
  const errori: string[] = [];
  for (const s of iscrizioni) {
    try {
      const det = webpush.generateRequestDetails(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { vapidDetails: { subject: contatto, publicKey: vapid.publicKey, privateKey: vapid.privateKey }, TTL: 12 * 3600, urgency: "high" },
      );
      const r = await fetch(det.endpoint, { method: det.method, headers: det.headers as Record<string, string>, body: det.body });
      if (r.status === 404 || r.status === 410) {
        await sb.from("notifiche_iscrizioni").delete().eq("endpoint", s.endpoint);
        errori.push(`${s.email}: un telefono non è più iscritto (rimosso)`);
      } else if (!r.ok) {
        errori.push(`${s.email}: il servizio notifiche ha risposto ${r.status} ${(await r.text()).slice(0, 120)}`);
      } else {
        inviati++;
      }
    } catch (e) {
      errori.push(`${s.email}: ${(e as Error).message}`);
    }
  }
  return { inviati, errori };
}
