// Utilità comuni alle funzioni server (Deno, Supabase Edge Functions).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Dati, Profilo } from "./tipi.ts";
import { PROFILO_VUOTO } from "./tipi.ts";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

/** Client con permessi completi: usarlo solo dopo aver controllato chi chiama. */
export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

export interface Membro {
  email: string;
  nome: string;
  whatsapp_tel: string;
  callmebot_key: string;
  promemoria: boolean;
}

/** Il membro della famiglia che sta chiamando, o null se non autorizzato. */
export async function membroDa(req: Request, sb: SupabaseClient): Promise<Membro | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) return null;
  const { data: m } = await sb.from("membri").select("*").ilike("email", email).maybeSingle();
  return (m as Membro | null) ?? null;
}

export async function caricaDati(sb: SupabaseClient): Promise<Dati> {
  const tutto = async (t: string) => {
    const { data, error } = await sb.from(t).select("*");
    if (error) throw new Error(`${t}: ${error.message}`);
    return data ?? [];
  };
  const [p, impegni, chiamate, contatti, documenti, farmaci] = await Promise.all([
    sb.from("profilo").select("dati").eq("id", 1).maybeSingle(),
    tutto("impegni"),
    tutto("chiamate"),
    tutto("contatti"),
    tutto("documenti"),
    tutto("farmaci"),
  ]);
  return {
    profilo: { ...PROFILO_VUOTO, ...((p.data?.dati as Profilo | undefined) ?? {}) },
    impegni,
    chiamate,
    contatti,
    documenti,
    farmaci: farmaci.map((f) => ({ ...f, per_giorno: Number(f.per_giorno), scorta: Number(f.scorta) })),
  } as Dati;
}
