// Legge la foto di una ricetta del Servizio Sanitario e restituisce i campi compilati.
// Richiede il segreto ANTHROPIC_API_KEY (vedi GUIDA.md).
import Anthropic from "npm:@anthropic-ai/sdk@1.6.0";
import { admin, cors, json, membroDa } from "../_shared/server.ts";
import { SPECIALITA } from "../_shared/tipi.ts";

const client = new Anthropic();

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tipo", "titolo", "prestazioni", "specialita", "priorita", "nre", "data_ricetta", "validita_giorni", "prescrittore", "esenzione", "quesito", "appunti_a_mano", "note_lettura"],
  properties: {
    tipo: { type: "string", enum: ["visita", "esame"] },
    titolo: { type: "string" },
    prestazioni: { type: "array", items: { type: "string" } },
    specialita: { type: "string", enum: [...SPECIALITA] },
    priorita: { type: "string", enum: ["U", "B", "D", "P", ""] },
    nre: { type: "string" },
    data_ricetta: { type: "string" },
    validita_giorni: { type: "integer" },
    prescrittore: { type: "string" },
    esenzione: { type: "string" },
    quesito: { type: "string" },
    appunti_a_mano: { type: "string" },
    note_lettura: { type: "string" },
  },
};

const ISTRUZIONI = `Leggi la foto di una ricetta medica italiana del Servizio Sanitario Nazionale (di solito il "promemoria" stampato della ricetta elettronica, a volte la vecchia ricetta rossa). Serve a una figlia che organizza visite ed esami della madre anziana: i dati verranno controllati da lei prima di salvarli, quindi preferisci un campo vuoto a un valore inventato.

Compila così:
- tipo: "visita" se è una visita specialistica (prima visita, visita di controllo), "esame" per analisi del sangue, ecografie, radiografie, elettrocardiogrammi e simili.
- titolo: breve e chiaro per una persona non medica, es. "Visita cardiologica", "Ecografia addome completo", "Esami del sangue (emocromo, glicemia, creatinina…)". Se ci sono molte analisi del sangue, riassumile così.
- prestazioni: l'elenco delle prestazioni come scritte sulla ricetta, senza i codici.
- specialita: il reparto più adatto tra quelli permessi. Le analisi del sangue e delle urine vanno in "Laboratorio analisi", ecografie e radiografie in "Radiologia / Ecografia" (salvo eco cardiache: "Cardiologia").
- priorita: la lettera U, B, D o P indicata nella casella della priorità (a volte è scritta per esteso: Urgente, Breve, Differibile, Programmabile/Programmata); stringa vuota se non c'è o non è leggibile.
- nre: il codice della ricetta (NRE), in alto vicino al codice a barre: 5 caratteri, uno spazio, poi 10 cifre (es. "0301A 4012345678"). Copialo carattere per carattere.
- data_ricetta: la data di compilazione in formato AAAA-MM-GG, stringa vuota se non leggibile.
- validita_giorni: per quanti giorni la ricetta è valida per prenotare, se è scritto (es. "PRESCRIZIONE VALIDA 180 GIORNI AI FINI DELLA PRENOTAZIONE" → 180). 0 se non è indicato.
- prescrittore: nome e cognome del medico che ha firmato.
- esenzione: il codice di esenzione se presente (es. "013"), altrimenti stringa vuota.
- quesito: il quesito o sospetto diagnostico, se scritto.
- appunti_a_mano: le note scritte a mano sul foglio (es. dal medico: "esami tra 12 mesi"), trascritte come sono. Stringa vuota se non ce ne sono.
- note_lettura: cosa non hai potuto leggere con sicurezza (cifre sfocate, parti tagliate). Stringa vuota se è tutto chiaro.
Se la foto non è una ricetta, lascia vuoti i campi e spiegalo in note_lettura.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ errore: "Metodo non permesso" }, 405);

  const membro = await membroDa(req, admin());
  if (!membro) return json({ errore: "Non sei autorizzato: la tua email non è tra i membri della famiglia." }, 401);

  let body: { immagine?: string; media_type?: string };
  try {
    body = await req.json();
  } catch {
    return json({ errore: "Richiesta non valida" }, 400);
  }
  const { immagine, media_type = "image/jpeg" } = body;
  if (!immagine || typeof immagine !== "string") return json({ errore: "Manca la foto" }, 400);
  if (immagine.length > 7_000_000) return json({ errore: "Foto troppo grande" }, 413);
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(media_type)) return json({ errore: "Formato foto non supportato" }, 400);

  try {
    const r = await client.beta.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: ISTRUZIONI,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media_type as "image/jpeg", data: immagine } },
            { type: "text", text: "Leggi questa ricetta e compila i campi." },
          ],
        },
      ],
    });

    if (r.stop_reason === "refusal") return json({ errore: "Non sono riuscito a leggere questa foto. Compila i campi a mano." }, 422);
    if (r.stop_reason === "max_tokens") return json({ errore: "Lettura interrotta. Riprova." }, 502);
    const testo = r.content.find((b) => b.type === "text");
    if (!testo || testo.type !== "text") return json({ errore: "Nessuna risposta dalla lettura" }, 502);
    return json(JSON.parse(testo.text));
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ errore: "La chiave di Claude non è valida: controlla il segreto ANTHROPIC_API_KEY." }, 500);
    if (e instanceof Anthropic.RateLimitError) return json({ errore: "Troppe richieste in poco tempo: riprova tra un minuto." }, 429);
    if (e instanceof Anthropic.BadRequestError) return json({ errore: "Foto non accettata: " + e.message }, 400);
    if (e instanceof Anthropic.APIConnectionError) return json({ errore: "Servizio non raggiungibile, riprova." }, 502);
    if (e instanceof Anthropic.APIError) return json({ errore: "Errore del servizio di lettura (" + e.status + ")" }, 502);
    if (e instanceof SyntaxError) return json({ errore: "Risposta non leggibile, riprova." }, 502);
    console.error(e);
    return json({ errore: "Errore imprevisto" }, 500);
  }
});
