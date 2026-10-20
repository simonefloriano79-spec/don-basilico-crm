# Agente vocale ordini — configurazione Vapi/Retell

Documento di riferimento per collegare la piattaforma voce (Vapi o Retell, la scelta non è ancora stata fatta) al backend `/api/ordini-vocali/*`. I tool qui sotto sono JSON Schema standard: entrambe le piattaforme li supportano nello stesso formato, cambia solo *dove* si configurano nella dashboard — questo documento descrive il contratto, non i click.

Il motore usa **le stesse regole dell'app e della cassa** (`lib/ordini-vocali/pricing.ts`): prezzi della sede, «senza» con compensazione, extra, impasti speciali, maxi, combo, consegna 1,50 €, capienza cucina a peso. I prezzi sono quelli della **cassa** (non i «prezzi app»).

## Configurazione base

- **Server URL**: `https://don-basilico-crm.vercel.app/api/ordini-vocali/<endpoint>` (endpoint: `verifica-indirizzo`, `cerca-menu`, `prepara`, `conferma`), tutti in `POST` con corpo JSON.
- **Autenticazione**: header `x-voice-webhook-secret: <VOICE_WEBHOOK_SECRET>` su ogni chiamata.
- **`provider` e `providerRefId`** (solo `conferma`): NON vanno detti a voce. `provider` è fisso (`"vapi"` o `"retell"`), `providerRefId` è l'id reale della chiamata (Vapi `call.id`, Retell `call_id`), iniettato come variabile dinamica. Servono all'idempotenza: un retry non crea un secondo ordine.
- **`clienteTelefono`**: prendilo dal numero chiamante della piattaforma, non chiederlo a voce (chiedilo solo se è nascosto).
- **Data e ora**: l'assistente non ha un orologio. Inietta l'ora corrente (fuso Europe/Rome) nel prompt, per poter trasformare «alle 21» in un `oraRichiesta` ISO 8601 corretto.

## I 5 tool

### 0. `riconosci_cliente` → `/riconosci-cliente` (a inizio chiamata)

Da chiamare subito, con il numero chiamante (non chiederlo a voce). Mentre risponde, l'assistente può già dire il saluto generico («Don Basilico, buonasera»); poi usa l'esito per personalizzare.

```json
{
  "name": "riconosci_cliente",
  "description": "Cerca il cliente dal numero di telefono chiamante. Chiamalo all'inizio della chiamata.",
  "parameters": {
    "type": "object",
    "properties": { "telefono": { "type": "string", "description": "Numero chiamante (variabile della piattaforma)" } },
    "required": ["telefono"]
  }
}
```
Risposta: `{ riconosciuto, nome, ultimiOrdini[], ultimoOrdine, indirizzoAbituale, fedelta, variabili }`.
- `ultimoOrdine.articoli[]` è già nel formato di `prepara_ordine` (ids, taglia, senza, extra, impasto, combo): se il cliente dice «il solito / come l'ultima volta» si rimanda così, e `prepara_ordine` ricalcola prezzi e disponibilità (se un prodotto non c'è più lo dice).
- `indirizzoAbituale`: `{ indirizzo, coperto, sedeSlug, sedeNome, nomeCitofono }` — l'ultimo indirizzo di consegna, già controllato contro le zone. Se `coperto` è vero si salta `verifica_indirizzo` e si usa `sedeSlug`.
- `fedelta`: come in `prepara_ordine`; se `scontoDisponibile` puoi anticiparlo.
- `variabili`: le stesse informazioni in forma piatta (`nome_cliente`, `indirizzo_abituale`, `ultimo_ordine`, `sconto_fedelta`…) per le piattaforme che le iniettano nel prompt prima del saluto (Retell: webhook di chiamata in ingresso; Vapi: assistant-request). Con la piattaforma scelta si può collegare lo stesso endpoint e si evita la chiamata del tool.

**Riservatezza**: il numero chiamante non prova chi parla. Saluta per nome ma **chiedi conferma, non leggere** dati: «Consegniamo ancora in via…?», mai telefono, importi o altro; se il cliente dice di essere un'altra persona, tratta la chiamata come nuova. Un numero sconosciuto o nascosto non è un errore: `riconosciuto: false`.


### 1. `verifica_indirizzo` → `/verifica-indirizzo` (solo consegna)

Da chiamare appena il cliente dice l'indirizzo, **prima** degli articoli.

```json
{
  "name": "verifica_indirizzo",
  "description": "Controlla se l'indirizzo di consegna è coperto e da quale pizzeria. Chiamalo subito dopo che il cliente ha detto l'indirizzo, prima di prendere l'ordine.",
  "parameters": {
    "type": "object",
    "properties": {
      "indirizzo": { "type": "string", "description": "Indirizzo completo: via, numero civico, città" }
    },
    "required": ["indirizzo"]
  }
}
```
Risposta ok: `{ ok: true, sedeSlug, sedeNome, indirizzoConfermato, apertaOra, orario }`. Se `apertaOra` è falso si può comunque prenotare per un orario futuro. Se `ok: false`: `esito` = `fuori_zona` (proponi il ritiro in una sede) o `errore` (indirizzo non capito: fallo ripetere); leggi `motivo` in modo naturale, mai il codice.

### 2. `cerca_menu` → `/cerca-menu`

Da richiamare ogni volta che il cliente nomina un piatto, una bevanda o un ingrediente. Passa sempre `sedeSlug` (da `verifica_indirizzo`, o la sede scelta per l'asporto): così vedi solo ciò che quella pizzeria ha, ai suoi prezzi.

```json
{
  "name": "cerca_menu",
  "description": "Cerca un prodotto del menù o un ingrediente extra per nome, nel menù della pizzeria scelta. Usalo SEMPRE quando il cliente nomina un piatto o un ingrediente: non fidarti mai di un id che non hai appena ottenuto da questo tool.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Il nome detto dal cliente, es. 'diavola' o 'mozzarella di bufala'" },
      "sedeSlug": { "type": "string", "description": "Slug della pizzeria (vedi tabella sedi)" }
    },
    "required": ["query", "sedeSlug"]
  }
}
```
Risposta:
```
{ sede, prodotti: [...], ingredientiExtra: [...], impasti?: [...] }
```
- `prodotti[]` (max 5, per rilevanza): `menuItemId, nome, categoria, descrizione, prezzo` e, per le pizze:
  - `ingredienti: [{ingredienteId, nome}]` — gli ingredienti di base: per un «senza X» usa l'`ingredienteId` di X, mai uno inventato;
  - `maxi: {prezzo} | null` — se non è `null` la maxi esiste per quel prodotto in quella sede (prezzo già moltiplicato);
  - `impastoSpeciale: true|false` — se accetta un impasto diverso dal classico.
- **Ricerca per ingredienti**: se il cliente non dice il nome ma gli ingredienti («patate e salsiccia»), `cerca_menu` abbina anche per ingredienti (singolare/plurale e piccoli errori inclusi). Le pizze che li hanno tutti vanno in testa e portano il campo `trovataPerIngredienti` (gli ingredienti riconosciuti): l'assistente la **propone** leggendo nome e ingredienti («Allora è la Campagnola: fior di latte, patate alla brace e salsiccia. Va bene?») e aspetta il sì.
- `ingredientiExtra[]` (max 5): `ingredienteId, nome, prezzoAggiunta` — per le aggiunte («con bufala»). Sulla maxi gli extra costano il doppio (lo calcola `prepara`).
- `impasti[]` (se tra i risultati c'è una pizza che li accetta): `impastoId, nome, supplemento`. Il classico è sempre incluso, non è in elenco.
- Combo (`categoria: "combo"`): `combo: { disponibile, contiene[], bibiteDaScegliere, pizzeSpecialiDaScegliere, bibiteAmmesse[], pizzeSpecialiAmmesse[] }`. Se `disponibile` è falso, il combo non c'è in quella sede.

Se la lista è vuota o ambigua l'assistente chiede al cliente quale intende.

### 3. `prepara_ordine` → `/prepara` (preventivo, non salva nulla)

Da chiamare **una sola volta**, quando il cliente ha finito di ordinare, per poter dire il totale vero.

```json
{
  "name": "prepara_ordine",
  "description": "Calcola sede, disponibilità e totale reale (consegna inclusa) SENZA salvare. Chiamalo quando il cliente ha finito di ordinare, per dirgli il totale e chiedere conferma.",
  "parameters": {
    "type": "object",
    "properties": {
      "clienteNome": { "type": "string" },
      "clienteTelefono": { "type": "string" },
      "tipo": { "type": "string", "enum": ["domicilio", "asporto"] },
      "clienteIndirizzo": { "type": "string", "description": "Obbligatorio se tipo=domicilio" },
      "nomeCitofono": { "type": "string", "description": "Solo domicilio: il nome sul citofono, se diverso dal cliente" },
      "sedeSlugAsporto": { "type": "string", "description": "Obbligatorio se tipo=asporto" },
      "metodoPagamento": { "type": "string", "enum": ["contanti", "carta"], "description": "Obbligatorio per il domicilio: come paga al fattorino (carta = POS)" },
      "usaScontoFedelta": { "type": "boolean", "description": "true solo se il cliente ha uno sconto fedeltà disponibile (vedi fedelta nella risposta di prepara) e vuole usarlo" },
      "codiceSconto": { "type": "string", "description": "Codice sconto detto dal cliente, es. BAFFO15. Non si somma allo sconto fedeltà" },
      "attivaTessera": { "type": "boolean", "description": "true SOLO se il cliente non ha la tessera fedeltà e ha detto sì esplicito ad attivarla (consenso privacy a voce)" },
      "oraRichiesta": { "type": "string", "description": "ISO 8601, solo se il cliente vuole un orario preciso (ritiro alle / consegna non prima delle). Se vuole 'subito', omettilo" },
      "articoli": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "menuItemId": { "type": "string", "description": "Id ottenuto da cerca_menu" },
            "quantita": { "type": "integer" },
            "taglia": { "type": "string", "enum": ["normale", "maxi"], "description": "'maxi' solo se la riga di cerca_menu ha maxi diverso da null e il cliente la vuole" },
            "ingredientiAggiuntiIds": { "type": "array", "items": { "type": "string" }, "description": "ingredienteId da ingredientiExtra" },
            "ingredientiRimossi": { "type": "array", "items": { "type": "string" }, "description": "ingredienteId da prodotto.ingredienti (i «senza»)" },
            "impastoId": { "type": "string", "description": "impastoId da impasti, solo se il cliente lo chiede" },
            "comboScelte": {
              "type": "object",
              "description": "Solo per i combo",
              "properties": {
                "bibite": { "type": "array", "items": { "type": "string" }, "description": "menuItemId da bibiteAmmesse, tante quante bibiteDaScegliere" },
                "pizze": { "type": "array", "items": { "type": "string" }, "description": "menuItemId da pizzeSpecialiAmmesse, tante quante pizzeSpecialiDaScegliere" }
              }
            },
            "note": { "type": "string" }
          },
          "required": ["menuItemId", "quantita"]
        }
      },
      "note": { "type": "string", "description": "Note generali, es. 'citofono rotto, chiamare all'arrivo'" }
    },
    "required": ["clienteNome", "clienteTelefono", "tipo", "articoli"]
  }
}
```

Risposta ok: `{ ok: true, sede, totale, totaleProdotti, costoConsegna, scontoFedelta, scontoCodice, codiceSconto, fedelta, articoli[], indirizzoConfermato }`. Il **`totale` include già la consegna (1,50 €) e gli sconti richiesti**: è quello da leggere al cliente e quello che poi salva `conferma`. Gli sconti toccano solo i prodotti, mai la consegna.

`fedelta` = `{ haTessera, timbri, timbriPerCiclo, scontoDisponibile, importoSconto }`. Se `scontoDisponibile` è vero, dillo al cliente («ha uno sconto fedeltà di X euro, lo vuole usare?»); se accetta richiama `prepara_ordine` con `usaScontoFedelta: true` per avere il totale scontato. Se `haTessera` è falso puoi proporre di attivarla (vedi sotto). Un codice sbagliato o scaduto torna come `ok: false` con il motivo. Ogni articolo ha `nome, quantita, maxi, prezzoUnitario, senza[], conExtra[], impasto, contenutoCombo, note`.

Risposta se qualcosa non va: `{ ok: false, esito: "fuori_zona"|"cucina_piena"|"chiuso"|"errore", motivo }` — comunica `motivo` in modo naturale, mai il codice. Con `cucina_piena` proponi un orario più tardi (richiama `prepara` con un altro `oraRichiesta`).

### 4. `conferma_ordine` → `/conferma` (salva davvero)

**Stessi parametri di `prepara_ordine`**, più `provider`, `providerRefId` e, opzionali, `telefonoChiamante` e `trascrizione`. Da chiamare **solo dopo il sì esplicito** del cliente al totale letto. Rifà lo stesso calcolo, applica gli sconti, salva l'ordine, lo lega all'anagrafica cliente per telefono e avvisa la sede.

**L'ordine nasce «da accettare», come quelli dell'app.** Compare nella pagina Ordini (anche nella vista Online) con l'etichetta «Ordine telefonico (assistente) — da accettare» e NON va in cucina né in stampa finché la pizzeria non lo accetta (può cambiare l'orario) o lo rifiuta. Solo all'accettazione il cliente riceve l'**SMS di conferma** al suo numero. Se l'ordine è rifiutato o annullato lo sconto fedeltà usato torna disponibile.

**Tessera fedeltà**, come per l'app: il timbro (importo = prodotti pagati, consegna esclusa) si aggiunge quando l'ordine diventa «pronto» o «consegnato». La tessera esiste già se il cliente è registrato nell'app o l'ha avuta in cassa; se non esiste viene creata solo con `attivaTessera: true`, cioè dopo un sì esplicito a voce. Frase suggerita: «Non ha ancora la tessera fedeltà: ogni cinque ordini ha il 10% di sconto sulla spesa. La attivo con questo numero? Trattiamo i suoi dati secondo l'informativa privacy sul nostro sito.»

Risposta: `{ ok: true, numeroOrdine, sede, totale, prossimoPasso }` — chiudi la chiamata leggendo `numeroOrdine` e dicendo che la pizzeria confermerà l'ordine e l'orario con un SMS. Se la risposta ha `giaConfermato: true` l'ordine esisteva già: non è un errore, non rileggerlo come nuovo.

## Sedi (per `sedeSlug` / `sedeSlugAsporto`)

| Sede | Slug |
|---|---|
| Pescara Centro | `centro` |
| Portanuova | `portanuova` |
| Università | `universita` |
| Pescara Nord | `pescara-nord` |
| Montesilvano | `montesilvano` |
| Chieti Scalo | `chieti-scalo` |

## Struttura della conversazione (system prompt)

Indirizzo e sede vanno chiesti *prima* degli articoli: serve a bocciare subito un indirizzo fuori zona e a cercare nel menù della pizzeria giusta (prezzi, maxi e impasti dipendono dalla sede).

1. **Saluto** (dichiarati assistente virtuale, avvisa che la chiamata è registrata) e chiama `riconosci_cliente`. Se è riconosciuto: «Buonasera Mario, vuole ordinare il solito?» / «consegna in via…?» oppure chiedi se è consegna o ritiro.
2. **Domicilio**: chiedi l'indirizzo completo, chiama `verifica_indirizzo`; se fuori zona proponi il ritiro. Chiedi il nome sul citofono. **Asporto**: chiedi in quale sede ritira (elenca le 6 se non lo sa).
3. Chiedi **per che ora** (subito o a un orario preciso).
4. Raccogli gli articoli uno alla volta, ogni volta con `cerca_menu(sedeSlug)`. Per ogni pizza gestisci a richiesta: «senza…», «con…», impasto speciale (solo se la sede lo ha), maxi (solo se `maxi` non è `null`). Per un combo chiedi le bibite e, se previste, le pizze speciali tra quelle ammesse.
5. **Non dire il totale parziale** dopo ogni articolo. Solo alla fine.
6. Prima di chiudere, se non ha ordinato bevande o fritti: «Vuole aggiungere qualcosa da bere o dei fritti?».
7. Domicilio: chiedi come paga (contanti o carta al fattorino). Se ha un codice sconto, raccoglilo ora.
8. Chiama `prepara_ordine`. Se la risposta dice che ha uno sconto fedeltà disponibile, offrilo e, se accetta, richiama `prepara_ordine` con `usaScontoFedelta: true`. Se non ha la tessera, proponila (una sola volta, senza insistere). Rileggi riepilogo e totale (consegna e sconti inclusi) e chiedi conferma esplicita.
9. Solo se il cliente dice sì, chiama `conferma_ordine`. Comunica il numero ordine e che la pizzeria gli confermerà ordine e orario con un SMS, poi saluta.
10. Se vuole cambiare qualcosa, torna al punto 4 e richiama `prepara_ordine` prima di chiedere di nuovo conferma.
11. Se chiede di parlare con una persona, passa la chiamata (da configurare sulla piattaforma).

## Cosa NON fa ancora

Non timbra la tessera per gli ordini presi dallo staff in cassa (restano timbrati dal pannello della tessera, come prima). Le notifiche alla sede richiedono `TWILIO_PHONE_NUMBER` / `TWILIO_WHATSAPP_FROM` su Vercel; l'SMS al cliente usa la stessa configurazione Twilio dell'app.
