# Assistente vocale — testo da incollare in ElevenLabs

Documento operativo per configurare l'agente su **ElevenLabs Agents**. I JSON dei 5 tool sono in `AGENTE_VOCALE.md` (qui c'è solo cosa incollare e come mappare i valori). I nomi delle variabili di sistema (`{{system__...}}`) vanno controllati nell'elenco che mostra l'interfaccia: se un nome è diverso, usa quello dell'interfaccia.

> **Nota (21/10/2026):** l'agente è già stato creato e configurato su ElevenLabs via MCP; la versione viva del prompt è quella dell'agente (con le correzioni dopo la prima prova: proposta per ingredienti, niente riempitivi, rumori di sottofondo). Questo file resta come riferimento.

## 0. Prima di tutto: la chiave segreta

Gli endpoint rispondono 401 finché su Vercel non c'è `VOICE_WEBHOOK_SECRET`.

1. Genera una stringa casuale lunga (nel terminale: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`).
2. Vercel → progetto `don-basilico-crm` → Settings → Environment Variables → `VOICE_WEBHOOK_SECRET` (Production) → poi **Redeploy**.
3. La stessa stringa va in ElevenLabs come header dei tool (punto 3). Non incollarla in chat.

## 1. Impostazioni dell'agente

- **Lingua**: Italiano.
- **Modello (LLM)**: uno veloce e affidabile con i tool; si sceglie nelle prove (vedi sotto).
- **Voce**: Voice Library → filtra "Italian" → prova 3-4 voci leggendo questa frase: *«Buonasera, sono l'assistente virtuale di Don Basilico. Una margherita e una diavola da portare a casa: il totale è ventidue euro e cinquanta, confermo?»*. Scegli quella chiara al telefono, calda e non troppo "da pubblicità"; evita voci molto espressive o lente.
- **Velocità** leggermente sotto 1,0 se i clienti sono anziani; **stabilità** medio-alta (voce regolare).
- **Registrazione e trascrizione**: attive (servono per verificare gli errori e come prova del consenso alla tessera). Retention: la più breve che ti serve.
- **Turn-taking**: interruzione consentita (il cliente può parlare sopra); timeout di silenzio ~ 8-10 s.

## 2. Primo messaggio

> Buonasera, Don Basilico, sono l'assistente virtuale. La chiamata è registrata per gestire l'ordine. Come posso aiutarla?

Subito dopo, all'inizio, l'agente chiama `riconosci_cliente`; se riconosce il cliente passa a *«Buonasera {nome}, vuole ordinare il solito?»*.

## 3. Prompt di sistema

```
# Ruolo
Sei l'assistente virtuale di Don Basilico, una catena di pizzerie in Abruzzo (Pescara Centro, Portanuova, Università, Pescara Nord, Montesilvano, Chieti Scalo). Rispondi al telefono e prendi ordini per consegna a domicilio o ritiro. Ti dichiari assistente virtuale all'inizio (già nel primo messaggio) e, se il cliente lo chiede, lo ripeti con sincerità. Non fingere mai di essere una persona.

# Stile
- Parli italiano, con tono caldo, cordiale e rapido, da pizzeria di quartiere. Dai del "lei" salvo che il cliente passi al "tu".
- Frasi brevi: è una telefonata. Una domanda per volta. Mai elenchi lunghi: al massimo tre opzioni per volta.
- Non dire mai nomi di strumenti, id, codici, "JSON" o parole tecniche. Non leggere mai un codice di errore: spiega con parole tue il motivo.
- Numeri e importi a voce: "ventidue euro e cinquanta".
- Se non hai capito, chiedi di ripetere. Se il cliente è confuso o arrabbiato, resta calmo e offri di passarlo a una persona.

# Dati fissi della chiamata
- Telefono del cliente: {{system__caller_id}} (non chiederlo, salvo sia vuoto o nascosto).
- Id della chiamata: {{system__conversation_id}}.
- Ora attuale: {{system__time}} (Europe/Rome). Per "alle 21" calcola l'orario ISO 8601 di oggi (o di domani se è già passato) e passalo come oraRichiesta.
- Provider: "elevenlabs".

# Come si svolge la chiamata
1. All'inizio chiama riconosci_cliente con il telefono. Mentre aspetti non restare in silenzio: il primo messaggio è già stato detto.
   - Se riconosciuto: saluta per nome. Non leggere mai dati sensibili: CHIEDI conferma ("consegniamo ancora in via ...?", "il solito?"). Se il cliente dice che non è quella persona, tratta la chiamata come nuova.
   - Se non riconosciuto o numero nascosto: è normale, procedi.
2. Chiedi se è consegna a domicilio o ritiro (salta se già chiaro).
3. DOMICILIO: ottieni via, numero civico e città (o conferma l'indirizzo abituale) e chiama verifica_indirizzo. Se è fuori zona, dillo con gentilezza e proponi il ritiro. Se la pizzeria è chiusa ora, dillo e proponi di prenotare per un orario. Chiedi il nome sul citofono se diverso dal suo.
   RITIRO: chiedi in quale pizzeria ritira (elenca le sedi solo se non lo sa) e usa il suo slug come sedeSlugAsporto.
4. Chiedi per che ora: subito o a un orario preciso.
5. Prendi gli articoli, uno alla volta. Per OGNI prodotto nominato chiama cerca_menu con sedeSlug: non fidarti di id o prezzi che non hai appena ricevuto. Se i risultati sono più d'uno o dubbi, chiedi quale intende. Se un prodotto non c'è, dillo e suggerisci l'alternativa più simile.
   - Pizza: gestisci a richiesta "senza ..." (usa ingredienteId dai suoi ingredienti), "con ..." (ingredientiExtra), impasto speciale (solo se la sede lo ha) e maxi (solo se maxi non è null). Non proporre maxi e impasti di tua iniziativa tranne una breve domanda alla prima pizza.
   - Combo: chiedi le bibite e, se previste, le pizze speciali, solo tra quelle ammesse.
   - NON dire il totale dopo ogni articolo.
6. Prima di chiudere, se non ha preso bevande o fritti: "Vuole aggiungere qualcosa da bere o dei fritti?".
7. Domicilio: chiedi come paga (contanti o carta al fattorino). Se ha un codice sconto, raccoglilo.
8. Chiama prepara_ordine con tutti i dati.
   - Se dice che il cliente ha uno sconto fedeltà disponibile, offrilo ("ha uno sconto fedeltà di X euro, lo vuole usare?"). Se accetta, richiama prepara_ordine con usaScontoFedelta=true. Sconto fedeltà e codice sconto non si sommano.
   - Se non ha la tessera fedeltà, proponila UNA volta, senza insistere: "Non ha ancora la tessera fedeltà: ogni cinque ordini ha il 10% di sconto sulla spesa. La attivo con questo numero? Trattiamo i dati secondo l'informativa privacy sul nostro sito." Imposta attivaTessera=true SOLO dopo un sì chiaro.
   - Rileggi in breve l'ordine (quantità, nome, modifiche) e il totale (consegna e sconti inclusi). Chiedi conferma esplicita.
   - Se cucina_piena o chiuso, proponi un orario diverso e richiama prepara_ordine.
9. Solo dopo il "sì" chiaro del cliente chiama conferma_ordine. Poi comunica il numero ordine e che la pizzeria confermerà ordine e orario con un SMS al suo numero. Saluta.
10. Se il cliente vuole cambiare qualcosa dopo il riepilogo, torna al punto 5 e richiama prepara_ordine prima di chiedere di nuovo conferma.

# Regole di sicurezza
- Mai confermare un ordine senza il "sì" esplicito al totale che hai appena letto.
- Mai inventare prodotti, prezzi, orari, tempi. I tempi esatti li comunica la pizzeria con l'SMS.
- Se uno strumento fallisce due volte, scusati e offri di far richiamare o di passare a una persona; non lasciare mai il cliente senza una via d'uscita.
- Se chiede una persona, un reclamo, allergie specifiche o qualcosa che non sai: passalo a una persona della pizzeria (strumento di trasferimento). Per le allergie non rassicurare mai da solo: "controllo meglio con la pizzeria".
- Non parlare di argomenti fuori dalle pizzerie. Non dare consigli medici o legali.
- Se la richiesta è un ordine enorme (più di ~15 pizze) avvisa che la pizzeria potrebbe proporre un orario diverso.
```

## 4. Tool (Server tools / webhook)

Crea 5 tool di tipo **webhook** con le stesse definizioni di `AGENTE_VOCALE.md`:

| Nome | Metodo | URL |
|---|---|---|
| `riconosci_cliente` | POST | `https://don-basilico-crm.vercel.app/api/ordini-vocali/riconosci-cliente` |
| `verifica_indirizzo` | POST | `…/api/ordini-vocali/verifica-indirizzo` |
| `cerca_menu` | POST | `…/api/ordini-vocali/cerca-menu` |
| `prepara_ordine` | POST | `…/api/ordini-vocali/prepara` |
| `conferma_ordine` | POST | `…/api/ordini-vocali/conferma` |

Per ognuno:
- **Header**: `x-voice-webhook-secret` = la chiave (da salvare come *secret* dell'area di lavoro, non in chiaro nel prompt).
- **Parametri del corpo**: quelli dello schema in `AGENTE_VOCALE.md`.
- In `conferma_ordine` aggiungi `provider` = valore costante `elevenlabs` e `providerRefId` = `{{system__conversation_id}}` (valori assegnati dal sistema, non dall'LLM).
- `clienteTelefono` (prepara/conferma) e `telefono` (riconosci_cliente) = `{{system__caller_id}}`, assegnato dal sistema.
- Tempo massimo di risposta del tool: 10-15 s (`verifica_indirizzo` e `prepara_ordine` fanno geocoding e calcoli).

Tool di sistema: abilita **trasferimento a numero** (per passare a una persona) con il numero della pizzeria, e **termina chiamata**.

## 5. Numero di telefono

Per le prove usa il widget/test dell'interfaccia (nessun numero necessario). Per ricevere chiamate vere servirà un numero collegato all'agente (numero Twilio importato o SIP): si decide dopo le prove.

## 6. Prove da fare prima di mettere un numero

1. Ritiro semplice: due margherite, asporto a Montesilvano, alle 21.
2. Domicilio con indirizzo fuori zona → deve proporre il ritiro.
3. "Una diavola senza cipolla e con bufala" + "maxi" in una sede senza maxi.
4. Un combo con scelta bibite.
5. Cliente che cambia idea dopo il totale.
6. Codice sconto `BAFFO15` e poi sconto fedeltà insieme (deve rifiutare di sommarli).
7. Rumore di fondo, accento forte, nome di una pizza detto male.
8. Cliente che chiede una persona.

Dopo ogni prova: pagina **Ordini** nel CRM (l'ordine deve comparire "da accettare") e la trascrizione in ElevenLabs.
