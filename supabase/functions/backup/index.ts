// Copia di sicurezza: restituisce tutti i dati e gli indirizzi temporanei (1 ora) di foto e PDF.
// La chiama solo il workflow GitHub "Backup settimanale" (intestazione x-cron-secret), che cifra tutto.
import { admin, caricaDati, cors, json } from "../_shared/server.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const segreto = Deno.env.get("CRON_SECRET");
  if (!segreto || req.headers.get("x-cron-secret") !== segreto) return json({ errore: "Non autorizzato" }, 401);

  const sb = admin();
  try {
    const dati = await caricaDati(sb);
    const { data: membri } = await sb.from("membri").select("email, nome, promemoria");
    const percorsi = [
      ...new Set([
        ...dati.documenti.map((d) => d.file_path),
        ...dati.impegni.map((i) => i.ricetta_path),
      ].filter((p): p is string => Boolean(p))),
    ];
    const file: { path: string; url: string }[] = [];
    for (let i = 0; i < percorsi.length; i += 100) {
      const { data, error } = await sb.storage.from("documenti").createSignedUrls(percorsi.slice(i, i + 100), 3600);
      if (error) throw new Error("foto: " + error.message);
      for (const f of data ?? []) if (f.signedUrl && f.path) file.push({ path: f.path, url: f.signedUrl });
    }
    return json({ creato: new Date().toISOString(), versione: 1, dati, membri: membri ?? [], file });
  } catch (e) {
    return json({ errore: (e as Error).message }, 500);
  }
});
