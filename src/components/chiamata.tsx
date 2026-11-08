import { useState } from "react";
import { PRIORITA, type Chiamata, type Impegno } from "../../supabase/functions/_shared/tipi.ts";
import { chiamateDi, scadenzaDi } from "../../supabase/functions/_shared/avvisi.ts";
import { aggiungiGiorni, aggiungiMesi, giornoBreve, giornoDi, giornoSettimana, oggi, oraDi, relativo } from "../../supabase/functions/_shared/date.ts";
import { copia, inputIso, isoInput, useApp } from "../lib/app.tsx";
import { uuid } from "../lib/backend.ts";
import { nuovoImpegno } from "./impegni.tsx";
import { Modulo, Sheet, type Campo } from "./ui.tsx";

/** Schermata a caratteri grandi da tenere aperta durante la telefonata. */
export function SchermataChiamata({ id }: { id: string }) {
  const { dati, apri, chiudi, toast } = useApp();
  const imp = dati.impegni.find((i) => i.id === id);
  if (!imp) return null;
  const p = dati.profilo;
  const g = oggi();
  const sc = scadenzaDi(imp, dati);
  const storico = chiamateDi(imp.id, dati.chiamate);
  const strutture = dati.contatti.filter((c) => c.tipo === "struttura");

  const righe: [string, string, boolean][] = [
    ["Prestazione", imp.titolo, false],
    ["Codice ricetta (NRE)", imp.nre, true],
    ["Priorità", imp.priorita ? `${imp.priorita} · ${PRIORITA[imp.priorita]}` : "", false],
    ["Nome", p.nome, false],
    ["Codice fiscale", p.cf, true],
    ["Tessera sanitaria", p.tessera, true],
    ["Esenzioni", p.esenzioni, false],
    ["Quando può", p.disponibilita, false],
  ];

  return (
    <div className="full" role="dialog" aria-modal="true">
      <div className="wrap stack">
        <div className="row between">
          <span className="eyebrow">Sto chiamando</span>
          <button onClick={() => chiudi()}>Chiudi</button>
        </div>
        <h1>{imp.titolo}</h1>
        {sc && (
          <div className="alert urgente">
            <b>Da fare entro il {giornoBreve(sc.giorno, g)}</b>
            <span className="small">{sc.motivo}. Se propongono una data dopo, è troppo tardi.</span>
          </div>
        )}

        <div>
          {righe
            .filter(([, v]) => v)
            .map(([k, v, c]) => (
              <div className="callrow" key={k}>
                <div>
                  <div className="k">{k}</div>
                  <div className="v">{v}</div>
                </div>
                {c && (
                  <button className="mini" onClick={() => copia(v, toast)}>
                    Copia
                  </button>
                )}
              </div>
            ))}
          {!p.cf && (
            <p className="small muted" style={{ marginTop: 8 }}>
              Mancano i dati della nonna: aggiungili in Impostazioni → Dati della nonna.
            </p>
          )}
        </div>

        {strutture.map((c) => (
          <div className="card" key={c.id}>
            <span className="eyebrow">{c.nome}</span>
            {c.telefono && (
              <a className="phone" href={"tel:" + c.telefono.replace(/[^\d+]/g, "")}>
                {c.telefono}
              </a>
            )}
            {c.orari && <span className="small muted">{c.orari}</span>}
            {c.sito && (
              <a href={c.sito} target="_blank" rel="noreferrer" className="small">
                Prenota online →
              </a>
            )}
          </div>
        ))}
        {strutture.length === 0 && <p className="muted">Aggiungi il numero del CUP in Rubrica, così lo trovi qui.</p>}

        <button className="primary big" onClick={() => apri({ k: "prenotato", impegnoId: imp.id, contattoId: null })}>
          Prenotato!
        </button>
        <button className="big" onClick={() => apri({ k: "esito", impegnoId: imp.id, contattoId: null })}>
          Niente posto
        </button>

        {storico.length > 0 && (
          <div className="card">
            <span className="eyebrow">Chiamate precedenti</span>
            <div className="timeline">
              {storico
                .slice()
                .reverse()
                .map((c) => (
                  <span key={c.id} className="small">
                    <b>{giornoBreve(giornoDi(c.quando), g)} {oraDi(c.quando)}</b>
                    {dati.contatti.find((x) => x.id === c.contatto_id)?.nome && ` · ${dati.contatti.find((x) => x.id === c.contatto_id)!.nome}`}: {c.esito}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function prossimoLunedi(g: string) {
  return aggiungiGiorni(g, 8 - giornoSettimana(g));
}
function inizioMeseProssimo(g: string) {
  return aggiungiMesi(g.slice(0, 8) + "01", 1);
}

/** "Niente posto": annota la chiamata e quando richiamare. */
export function SchermataEsito({ impegnoId, contattoId }: { impegnoId: string; contattoId: string | null }) {
  const { dati, salva, chiudi, toast } = useApp();
  const imp = dati.impegni.find((i) => i.id === impegnoId);
  const g = oggi();
  if (!imp) return null;
  const campi: Campo[] = [
    {
      k: "esito",
      l: "Cosa ti hanno detto",
      rapidi: [
        { l: "Nessun posto", v: "Nessun posto" },
        { l: "Primo posto troppo tardi", v: "Primo posto troppo tardi" },
        { l: "Agende chiuse", v: "Agende chiuse, riaprono più avanti" },
        { l: "Non rispondono", v: "Non rispondono" },
      ],
    },
    {
      k: "richiamare_il",
      l: "Quando richiamare",
      tipo: "date",
      hint: "Ti arriva il promemoria quel giorno",
      rapidi: [
        { l: "Domani", v: aggiungiGiorni(g, 1) },
        { l: "Tra 3 giorni", v: aggiungiGiorni(g, 3) },
        { l: "Lunedì prossimo", v: prossimoLunedi(g) },
        { l: "Inizio mese", v: inizioMeseProssimo(g) },
      ],
    },
  ];
  return (
    <Sheet titolo="Com'è andata la chiamata?">
      <p className="muted">{imp.titolo}</p>
      <Modulo
        campi={campi}
        iniziali={{ esito: "Nessun posto", richiamare_il: aggiungiGiorni(g, 3) }}
        onSalva={async (v) => {
          const c: Chiamata = {
            id: uuid(),
            impegno_id: imp.id,
            contatto_id: contattoId,
            quando: new Date().toISOString(),
            esito: String(v.esito || "Nessun posto"),
            richiamare_il: String(v.richiamare_il) || null,
          };
          await salva("chiamate", c);
          toast(c.richiamare_il ? `Ok, te lo ricordo ${relativo(g, c.richiamare_il)}` : "Chiamata segnata");
          chiudi();
        }}
      />
    </Sheet>
  );
}

/** "Prenotato!": data, luogo e preparazione. */
export function SchermataPrenotato({ impegnoId, contattoId }: { impegnoId: string; contattoId: string | null }) {
  const { dati, salva, chiudi, toast, pila } = useApp();
  const imp = dati.impegni.find((i) => i.id === impegnoId);
  if (!imp) return null;
  const campi: Campo[] = [
    { k: "data", l: "Data e ora", tipo: "datetime-local" },
    { k: "luogo", l: "Dove", hint: "Quello che ti ha detto il CUP: ospedale, padiglione, piano" },
    { k: "preparazione", l: "Istruzioni che ti hanno dato", tipo: "textarea", hint: "Una per riga. Es: Digiuno da 6 ore" },
    { k: "portare", l: "Cosa portare", tipo: "textarea", hint: "Una per riga" },
    ...(imp.tipo === "esame"
      ? ([{ k: "giorni_referto", l: "Il referto è pronto dopo (giorni)", tipo: "number", rapidi: [{ l: "Subito", v: "0" }, { l: "3 giorni", v: "3" }, { l: "1 settimana", v: "7" }] }] as Campo[])
      : []),
  ];
  return (
    <Sheet titolo="Prenotato!">
      <p className="muted">{imp.titolo}</p>
      <Modulo
        campi={campi}
        etichetta="Salva la prenotazione"
        iniziali={{
          data: isoInput(imp.data),
          luogo: imp.luogo,
          preparazione: imp.preparazione,
          portare: imp.portare,
          giorni_referto: String(imp.giorni_referto ?? 0),
        }}
        onSalva={async (v) => {
          const data = inputIso(String(v.data));
          if (!data) return toast("Inserisci data e ora");
          const nuovo: Impegno = {
            ...imp,
            stato: "prenotato",
            data,
            contatto_id: contattoId ?? imp.contatto_id,
            luogo: String(v.luogo).trim(),
            preparazione: String(v.preparazione).trim(),
            portare: String(v.portare).trim(),
            giorni_referto: imp.tipo === "esame" ? Number(v.giorni_referto) || 0 : imp.giorni_referto,
          };
          await salva("impegni", nuovo);
          await salva("chiamate", {
            id: uuid(),
            impegno_id: imp.id,
            contatto_id: nuovo.contatto_id,
            quando: new Date().toISOString(),
            esito: `Prenotato per il ${giornoBreve(giornoDi(data))} alle ${oraDi(data)}`,
            richiamare_il: null,
          } satisfies Chiamata);
          const sc = scadenzaDi(imp, dati);
          if (sc && giornoDi(data) > sc.giorno) toast(`Attenzione: è dopo il ${giornoBreve(sc.giorno)}, il limite per questo esame`);
          else toast("Prenotazione salvata");
          chiudi(pila[pila.length - 2]?.k === "chiamata" ? 2 : 1);
        }}
      />
    </Sheet>
  );
}

/** Dopo la visita o l'esame. */
export function SchermataFatto({ impegnoId }: { impegnoId: string }) {
  const { dati, salva, apri, chiudi, sostituisci } = useApp();
  const [fatto, setFatto] = useState(false);
  const imp = dati.impegni.find((i) => i.id === impegnoId);
  if (!imp) return null;
  if (fatto)
    return (
      <Sheet titolo="Segnato come fatto">
        <div className="stack">
          {imp.giorni_referto > 0 && imp.tipo === "esame" ? (
            <div className="alert info">
              Ti ricordo di ritirare il referto dal {giornoBreve(aggiungiGiorni(giornoDi(imp.data ?? new Date().toISOString()), imp.giorni_referto))}.
            </div>
          ) : (
            <button className="primary big" onClick={() => sostituisci({ k: "formDocumento", iniziale: { titolo: "Referto " + imp.titolo.toLowerCase(), tipo: "Referto", specialita: imp.specialita, impegno_id: imp.id } })}>
              Fotografa il referto
            </button>
          )}
          {imp.tipo === "visita" && (
            <button className="big" onClick={() => sostituisci({ k: "prossimo", visitaId: imp.id })}>
              Il medico ha chiesto un nuovo controllo o degli esami
            </button>
          )}
          <button className="ghost" onClick={() => chiudi()}>
            Fine
          </button>
        </div>
      </Sheet>
    );
  const campi: Campo[] =
    imp.tipo === "esame"
      ? [{ k: "giorni_referto", l: "Il referto è pronto dopo (giorni)", tipo: "number", hint: "0 se te l'hanno dato subito", rapidi: [{ l: "Già dato", v: "0" }, { l: "3 giorni", v: "3" }, { l: "1 settimana", v: "7" }, { l: "2 settimane", v: "14" }] }]
      : [{ k: "note", l: "Cosa ha detto il medico", tipo: "textarea", hint: "Facoltativo: terapia cambiata, cose da ricordare" }];
  return (
    <Sheet titolo={imp.tipo === "visita" ? "Com'è andata la visita?" : "Esame fatto"}>
      <p className="muted">{imp.titolo}</p>
      <Modulo
        campi={campi}
        etichetta="Segna come fatto"
        iniziali={{ giorni_referto: String(imp.giorni_referto ?? 0), note: imp.note }}
        onSalva={async (v) => {
          await salva("impegni", {
            ...imp,
            stato: "fatto",
            data: imp.data ?? new Date().toISOString(),
            giorni_referto: imp.tipo === "esame" ? Number(v.giorni_referto) || 0 : imp.giorni_referto,
            referto_ritirato: imp.tipo === "esame" ? !(Number(v.giorni_referto) > 0) : true,
            note: imp.tipo === "visita" ? String(v.note ?? "").trim() : imp.note,
          });
          setFatto(true);
        }}
      />
      <button className="ghost" onClick={() => apri({ k: "formImpegno", iniziale: imp, titolo: "Modifica" })}>
        Modifica i dettagli
      </button>
    </Sheet>
  );
}

/** Il prossimo anello della catena: nuovo controllo + esami da fare prima. */
export function SchermataProssimo({ visitaId }: { visitaId: string }) {
  const { dati, salva, chiudi, toast } = useApp();
  const v = dati.impegni.find((i) => i.id === visitaId);
  const g = oggi();
  if (!v) return null;
  const campi: Campo[] = [
    { k: "titolo", l: "Prossima visita" },
    { k: "entro", l: "Da fare entro", tipo: "date", rapidi: [{ l: "1 mese", v: aggiungiMesi(g, 1) }, { l: "3 mesi", v: aggiungiMesi(g, 3) }, { l: "6 mesi", v: aggiungiMesi(g, 6) }, { l: "1 anno", v: aggiungiMesi(g, 12) }] },
    { k: "esami", l: "Esami da fare prima", tipo: "textarea", hint: "Uno per riga. Es: Esami del sangue, Ecografia addome" },
  ];
  return (
    <Sheet titolo="Prossimo controllo">
      <p className="muted">Dopo: {v.titolo}. L'app ti dirà entro quando prenotare ogni esame.</p>
      <Modulo
        campi={campi}
        etichetta="Aggiungi"
        iniziali={{ titolo: "Controllo " + v.specialita.toLowerCase(), entro: aggiungiMesi(g, 6), esami: "" }}
        onSalva={async (val) => {
          const nuovaVisita = nuovoImpegno({
            tipo: "visita",
            titolo: String(val.titolo).trim() || "Controllo",
            specialita: v.specialita,
            entro: String(val.entro) || null,
            contatto_id: v.contatto_id,
            luogo: v.luogo,
          });
          await salva("impegni", nuovaVisita);
          const nomi = String(val.esami)
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean);
          for (const n of nomi) {
            const lab = /sangue|urin|glicat|emocromo|prelievo|analisi/i.test(n);
            await salva(
              "impegni",
              nuovoImpegno({
                tipo: "esame",
                titolo: n,
                specialita: lab ? "Laboratorio analisi" : /eco|rx|radiograf|tac|risonanza/i.test(n) ? "Radiologia / Ecografia" : v.specialita,
                per_visita_id: nuovaVisita.id,
                giorni_referto: lab ? 3 : /eco/i.test(n) ? 7 : 0,
              }),
            );
          }
          toast(nomi.length ? `Aggiunti la visita e ${nomi.length} esami da prenotare` : "Visita aggiunta");
          chiudi();
        }}
      />
      <p className="small muted">I giorni per il referto li ho stimati (sangue 3, ecografie 7): correggili nell'esame se serve.</p>
    </Sheet>
  );
}
