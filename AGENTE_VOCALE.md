# Agente vocale ordini — configurazione Vapi/Retell

Documento di riferimento per collegare la piattaforma voce (Vapi o Retell, la scelta non è ancora stata fatta) al backend `/api/ordini-vocali/*` già costruito. Le function/tool qui sotto sono JSON Schema standard: entrambe le piattaforme le supportano nello stesso formato (derivano dalle "function calling" di OpenAI), cambia solo *dove* si configurano nell'interfaccia — questo documento descrive il contratto, non i click esatti sulla dashboard (che può cambiare nel tempo).

## Configurazione base

- **Server URL webhook**: `https://don-basilico-crm.vercel.app/api/ordini-vocali/<tool>`
- **Autenticazione**: header custom `x-voice-webhook-secret: <VOICE_WEBHOOK_SECRET>` su ogni chiamata verso i 3 tool. Va configurato come "custom header" nella sezione tool/function della piattaforma scelta.
- **`providerRefId`** (usato da `conferma_ordine` per l'idempotenza): NON deve essere un parametro che l'assistente "inventa" a voce — va popolato automaticamente dalla piattaforma con l'id reale della chiamata (Vapi espone `call.id`, Retell espone `call_id` come variabile dinamica iniettabile nei parametri della function call). Configuralo come parametro pre-compilato/dinamico, non conversazionale.

## I 3 tool

### 1. `cerca_menu` — ricerca prodotto/ingrediente

Da richiamare ogni volta che il cliente nomina un piatto o un extra, per ottenere id reale + prezzo (matching approssimativo, tollera imprecisioni della trascrizione).

```json
{
  "name": "cerca_menu",
  "description": "Cerca un prodotto del menù o un ingrediente extra per nome. Usalo SEMPRE quando il cliente nomina un piatto o un ingrediente, prima di aggiungerlo all'ordine — non fidarti mai di un id che non hai appena ottenuto da questo tool.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Il nome detto dal cliente, es. 'diavola' o 'mozzarella extra'" }
    },
    "required": ["query"]
  }
}
```
Risposta: `{ prodotti: [{menuItemId, nome, categoria, prezzoBase}], ingredienti: [{ingredienteId, nome, prezzoAggiunta}] }` (max 5 ciascuno, ordinati per rilevanza). Se la lista è vuota o ambigua (più risultati simili), l'assistente deve chiedere al cliente di confermare quale intende.

### 2. `prepara_ordine` — preventivo (non salva nulla)

Da chiamare **una sola volta**, quando il cliente ha finito di elencare tutto l'ordine (pizze + eventuali fritti/bevande). Serve per poter dire il totale reale prima di chiedere conferma.

```json
{
  "name": "prepara_ordine",
  "description": "Calcola sede assegnata, disponibilità e totale reale dell'ordine SENZA salvarlo. Chiamalo quando il cliente ha finito di ordinare, per comunicargli il totale e chiedergli conferma prima di salvare.",
  "parameters": {
    "type": "object",
    "properties": {
      "clienteNome": { "type": "string" },
      "clienteTelefono": { "type": "string" },
      "tipo": { "type": "string", "enum": ["domicilio", "asporto"] },
      "clienteIndirizzo": { "type": "string", "description": "Obbligatorio se tipo=domicilio: indirizzo completo detto dal cliente" },
      "sedeSlugAsporto": { "type": "string", "description": "Obbligatorio se tipo=asporto: slug della sede scelta (vedi elenco sedi sotto)" },
      "articoli": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "menuItemId": { "type": "string", "description": "Id ottenuto da cerca_menu, mai inventato" },
            "quantita": { "type": "integer" },
            "taglia": { "type": "string", "enum": ["normale", "maxi"], "description": "'maxi' solo se il cliente la chiede esplicitamente E la sede è Chieti Scalo o Università" },
            "ingredientiAggiuntiIds": { "type": "array", "items": { "type": "string" } },
            "note": { "type": "string" }
          },
          "required": ["menuItemId", "quantita"]
        }
      },
      "note": { "type": "string", "description": "Note generali sull'ordine, es. 'citofono rotto, chiamare all'arrivo'" }
    },
    "required": ["clienteNome", "clienteTelefono", "tipo", "articoli"]
  }
}
```

Risposta se tutto ok: `{ ok: true, sede, totale, articoli, indirizzoConfermato }`.
Risposta se qualcosa non va: `{ ok: false, esito: "fuori_zona"|"cucina_piena"|"chiuso"|"errore", motivo }` — l'assistente deve comunicare `motivo` al cliente in modo naturale (mai leggere il codice `esito`).

### 3. `conferma_ordine` — salva davvero

**Stessi parametri di `prepara_ordine`**, da chiamare **solo dopo che il cliente ha detto esplicitamente di sì** al totale letto ad alta voce. Ripete lo stesso calcolo (mai riusare un totale "a memoria" di una chiamata precedente nella conversazione) e questa volta salva l'ordine e avvisa la sede.

Risposta: `{ ok: true, numeroOrdine, sede, totale }` — l'assistente deve chiudere la chiamata leggendo `numeroOrdine` come riferimento per il cliente.

## Sedi (per `sedeSlugAsporto`)

| Sede | Slug |
|---|---|
| Pescara Centro | `centro` |
| Portanuova | `portanuova` |
| Università | `universita` |
| Pescara Nord | `pescara-nord` |
| Montesilvano | `montesilvano` |
| Chieti Scalo | `chieti-scalo` |

## Struttura della conversazione (system prompt)

Ordine consigliato dei passaggi — **importante**: indirizzo e sede vanno chiesti *prima* degli articoli, non dopo, sia per bocciare subito un indirizzo fuori zona sia perché il prezzo (maxi) dipende dalla sede assegnata.

1. **Saluto** + chiedi se l'ordine è per consegna a domicilio o ritiro in sede.
2. Se **domicilio**: chiedi indirizzo completo (via, civico, città). Se **asporto**: chiedi presso quale sede vuole ritirare (elenca le 6 sedi se non lo sa).
3. Raccogli gli articoli uno alla volta. Per ogni piatto nominato, chiama `cerca_menu` per confermarlo. Se è una pizza rossa/bianca e la sede è Chieti Scalo o Università, chiedi "normale o maxi?" — altrove non proporre mai la maxi.
4. **Non dire mai il totale parziale dopo ogni articolo.** Solo alla fine.
5. Prima di chiudere l'ordine, chiedi sempre: *"Vuole aggiungere qualcosa da bere o dei fritti?"* — se non ha già ordinato bevande/fritti.
6. Chiama `prepara_ordine`. Leggi il totale al cliente e chiedi conferma esplicita ("Confermo l'ordine, il totale è €X, va bene?").
7. Solo se il cliente conferma, chiama `conferma_ordine`. Comunica il numero ordine e i tempi indicativi, poi saluta.
8. Se il cliente rifiuta o vuole modificare qualcosa, torna al punto 3 e richiama `prepara_ordine` daccapo prima di richiedere conferma.

## Nota per te

Questo documento presuppone che tu scelga Vapi o Retell — il contratto dei tool non cambia, cambia solo dove incolli questi JSON Schema nella dashboard della piattaforma. Quando hai deciso quale usare, se vuoi posso guidarti nei dettagli specifici di quella piattaforma (es. come iniettare `providerRefId` dalle variabili dinamiche, come impostare il webhook di post-call per il fallback).
