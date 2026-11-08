# Idee per dopo

## Esami del sangue in evidenza
- Riquadro fisso in cima all'Archivio: "Ultimi esami del sangue", sempre il referto più recente
  (quelli vecchi restano in archivio come storico).
- L'AI legge i valori principali dal referto (glicata, creatinina, emocromo, ferritina, …):
  mostra i numeri, segna quelli fuori norma e se sono saliti o scesi rispetto alla volta prima.
- Gli esami si ripetono ogni tot: promemoria per rifarli (già possibile con "Prossimo controllo").

## Referti che arrivano per email
- Già possibile: scaricare il PDF dall'email → Archivio → + Documento → "Scegli foto o PDF".
- Android (Motorola della mamma): l'app compare in "Condividi" (Web Share Target):
  dall'email, Condividi → Nonna → il PDF viene salvato e letto dall'AI. Su iPhone non è possibile.
- Più avanti: indirizzo email dedicato a cui inoltrare i referti, salvati in automatico.

## Già pronte da riattivare
- Pratiche (104 e aggravamento): codice in src/components/pratiche.tsx, tabella `pratiche` già nel database.
- WhatsApp tramite CallMeBot, quando riaprono le iscrizioni.
