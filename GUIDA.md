# Cartella della Nonna: guida per metterla online

Questa guida si segue **una volta sola**. Ci vogliono circa 30 minuti.
Alla fine tu e la mamma avrete l'app sul telefono, con gli stessi dati, e un messaggio WhatsApp ogni mattina.

> Prima di configurare tutto puoi già provarla in **modalità prova**: senza Supabase l'app parte con dati di esempio inventati, salvati solo sul telefono.

## Cosa serve

| Servizio | A cosa serve | Costo |
|---|---|---|
| **GitHub** | Tiene il codice e pubblica il sito | Gratis |
| **Supabase** | Database, login e foto (dati condivisi tra te e la mamma) | Gratis |
| **Anthropic (Claude)** | Leggere le foto delle ricette | Pochi centesimi a ricetta (serve una ricarica minima) |
| **CallMeBot** | Mandare i promemoria su WhatsApp | Gratis |

---

## 1. Crea il progetto su Supabase

1. Vai su **supabase.com**, registrati e premi **New project**.
2. Nome: `cartella-nonna`. Regione: **Central EU (Frankfurt)**.
3. Scegli una **password del database** e **salvala** (ti serve dopo).
4. Quando il progetto è pronto, vai in **Project Settings → API** (o **Data API**) e copia:
   - **Project URL** (es. `https://abcdefgh.supabase.co`): le lettere prima di `.supabase.co` sono il **Project ref**
   - la chiave **anon / publishable** (è pubblica, va bene metterla nel sito)
5. Crea un **Access token** personale: icona del profilo → **Account preferences → Access Tokens → Generate new token**. Copialo.

### Login: solo voi due

1. **Authentication → Sign In / Providers**: disattiva **Allow new users to sign up** (così nessun altro può registrarsi).
2. **Authentication → Users → Add user → Create new user**: crea il tuo account e quello della mamma (email + password, con **Auto Confirm User** attivo).

## 2. Chiave di Claude (lettura delle ricette)

1. Vai su **console.anthropic.com**, registrati e aggiungi una piccola ricarica (Billing).
2. **API Keys → Create Key**. Copia la chiave (inizia con `sk-ant-`).

Senza questa chiave l'app funziona lo stesso: le ricette si compilano a mano.

## 3. Configura GitHub

Nel repository su GitHub: **Settings → Secrets and variables → Actions**.

**Scheda "Variables"** (New repository variable):

| Nome | Valore |
|---|---|
| `SUPABASE_URL` | il Project URL |
| `SUPABASE_ANON_KEY` | la chiave anon / publishable |
| `SUPABASE_PROJECT_REF` | il Project ref (le lettere prima di `.supabase.co`) |

**Scheda "Secrets"** (New repository secret):

| Nome | Valore |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | l'access token del punto 1.5 |
| `SUPABASE_DB_PASSWORD` | la password del database |
| `ANTHROPIC_API_KEY` | la chiave di Claude |
| `CRON_SECRET` | una frase lunga inventata, senza spazi (es. `nonna-promemoria-8f3k29xq`) |

Poi **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 4. Avvia tutto

1. Vai nella scheda **Actions** del repository.
2. Apri **Aggiorna Supabase** → **Run workflow**. Crea le tabelle e le funzioni (2 minuti).
3. Apri **Pubblica il sito** → **Run workflow**. Alla fine trovi l'indirizzo del sito, tipo `https://tuonome.github.io/cartella-nonna/`.

## 5. Dì a Supabase chi fa parte della famiglia

Su Supabase apri **SQL Editor**, incolla questo (con le vostre email) e premi **Run**:

```sql
insert into public.membri (email, nome) values
  ('tua@email.it', 'Il tuo nome'),
  ('mamma@email.it', 'Mamma');
```

Solo le email in questa lista possono vedere i dati, anche se qualcuno riuscisse a fare login.

## 6. Mettila sul telefono

Apri l'indirizzo del sito ed entra con email e password.
- **iPhone (Safari)**: tasto Condividi → **Aggiungi alla schermata Home**
- **Android (Chrome)**: menu ⋮ → **Installa app** (o "Aggiungi a schermata Home")

## 7. Notifiche del mattino (ognuno sul suo telefono)

Nell'app: **Oggi → Impostazioni → Notifiche su questo telefono → Attiva le notifiche**, poi **Mandami una prova**.
- **Android**: funziona da Chrome o dall'app installata.
- **iPhone**: prima aggiungi l'app alla schermata Home e aprila da lì, altrimenti iOS non permette le notifiche.

Ogni mattina verso le 7 arriva una notifica con le cose da fare: visite di domani con la preparazione, cose da prenotare in scadenza, richiamate, referti da ritirare, farmaci che finiscono. Se non c'è niente da fare, non arriva niente.

**WhatsApp (facoltativo).** Si può aggiungere anche un messaggio WhatsApp tramite il servizio gratuito CallMeBot (passi in Impostazioni). A novembre 2026 il loro bot era pieno ("This Bot is full"): riprovare più avanti.

## 8. Primi dati da inserire (con la mamma)

1. **Impostazioni → Dati della nonna**: nome, codice fiscale, tessera sanitaria, esenzioni, quando può fare le visite.
2. **Rubrica**: ospedali e laboratori vicini a casa (con telefono e sito per prenotare), medico di base, specialisti. Il numero regionale della Lombardia c'è già: **controllalo**.
3. **Farmaci**: per ognuno quante al giorno e quante ce ne sono in casa.
4. **Visite**: le visite già prenotate e, per ognuna, gli esami da fare prima.
5. Da qui in poi: ogni ricetta nuova → **Fotografa una ricetta**.

---

## Da sapere

- **Il codice è pubblico, i dati no.** GitHub Pages gratis richiede un repository pubblico: si vede il codice dell'app, ma i dati della nonna stanno su Supabase, protetti da login e dalla lista `membri`.
- **Dove passano i dati.** Le foto delle ricette vengono mandate a Claude (Anthropic) per leggerle. Le notifiche arrivano tramite il servizio push del telefono (Google o Apple), cifrate. Il WhatsApp facoltativo passa da CallMeBot, un servizio gratuito esterno: il testo contiene i nomi delle visite.
- **Il promemoria del mattino si ferma dopo 60 giorni senza modifiche al codice.** È una regola di GitHub per i repository pubblici: ti arriva un'email e basta riattivarlo con un clic (Actions → Promemoria del mattino → Enable workflow).
- **Supabase gratuito mette in pausa i progetti inattivi per una settimana.** La chiamata giornaliera per le notifiche lo tiene sveglio. Se si ferma, si riattiva dalla dashboard di Supabase.
- **Copia di sicurezza:** Impostazioni → Scarica i dati. Supabase in più fa i suoi backup.

## Per sviluppare (facoltativo)

```bash
npm install
npm run dev      # senza .env.local parte in modalità prova
npm test         # controlla il calcolo di scadenze e promemoria
```

Per collegarla al tuo Supabase in locale copia `.env.example` in `.env.local` e compila i due valori.

### Com'è fatta

- `src/`: l'app (React). Le schermate sono in `src/components/`.
- `supabase/functions/_shared/avvisi.ts`: **il cervello**. Calcola scadenze (data della visita − giorni per il referto − 2 giorni di margine), richiamate, ritiri e scorte. Lo usano sia la schermata "Oggi" sia il messaggio WhatsApp.
- `supabase/functions/leggi-ricetta`: legge la foto della ricetta con Claude.
- `supabase/functions/promemoria`: manda il riepilogo su WhatsApp.
- `supabase/migrations`: le tabelle e le regole di accesso.
- `.github/workflows`: pubblicazione del sito, aggiornamento di Supabase, promemoria del mattino.
