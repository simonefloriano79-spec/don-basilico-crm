// Gestione stampa ordini
// Supporta: Stampa browser (fase 1) + PrintNode (fase 2)

import QRCode from "qrcode";

const TRACKING_APP_URL = "https://don-basilico-tracking.vercel.app";

export interface PrintOrdine {
  numero: number;
  ordineId?: string;
  sede: string;
  canale: string;
  tipo: string;
  cliente: string;
  telefono?: string;
  indirizzo?: string;
  items: Array<{ nome: string; qty: number; prezzo: number; note?: string }>;
  totale: number;
  costoConsegna?: number;
  scontoFedelta?: number;
  scontoCodice?: number;
  codiceSconto?: string;
  /** Ordine online modificato dal cliente: la comanda sostituisce quella già stampata. */
  modificato?: boolean;
  note?: string;
  noteDomicilio?: string;
  nomeCitofono?: string;
  tavolo?: string | null;
  oraConsegnaComunicata?: string;
  modalitaConsegna?: "appena_possibile" | "non_prima" | "alle_ore" | null;
  metodoPagamento?: "contanti" | "pos" | null;
  ora: string;
  /** Righe del foglietto per la friggitoria (le riempie la stampa, chiedendole al server). */
  fritti?: Array<{ nome: string; qty: number; note?: string }>;
  frittiNonLetti?: boolean;
}

// L'orario di ritiro/consegna deve saltare all'occhio: riquadro a parte con le cifre grandi.
// Se non è per oggi («domani 19:00», «28/11 19:00») il giorno sta sopra l'ora, anch'esso ben visibile.
function riquadroOrario(o: PrintOrdine): string {
  if (!o.oraConsegnaComunicata) return "";
  const etichetta = o.modalitaConsegna === "non_prima" ? "Non prima delle"
    : o.modalitaConsegna === "alle_ore" ? (o.tipo === "domicilio" ? "Consegna alle" : "Ritiro alle")
    : "Appena possibile, entro";
  const spazio = o.oraConsegnaComunicata.lastIndexOf(" ");
  const giorno = spazio > 0 ? o.oraConsegnaComunicata.slice(0, spazio) : "";
  const ora = o.oraConsegnaComunicata.slice(spazio + 1);
  return `<div class="orario"><div class="orario-etichetta">${etichetta}</div>${giorno ? `<div class="orario-giorno">${giorno}</div>` : ""}<div class="orario-ora">${ora}</div></div>`;
}

// Secondo foglietto, solo se l'ordine ha dei fritti: numero, nome, orario e i fritti. Va su una pagina a parte
// così la stampante lo taglia separato dalla comanda.
function foglioFritti(o: PrintOrdine): string {
  if (!o.fritti?.length) return "";
  const righe = o.fritti
    .map((f) => `<tr><td style="width:36px">${f.qty}x</td><td>${f.nome}${f.note ? `<br><span style="font-size:14px">${f.note}</span>` : ""}</td></tr>`)
    .join("");
  return `<div class="foglio-fritti">
        ${o.modificato ? `<div style="text-align:center;font-size:18px;border:3px solid #000;padding:4px;margin-bottom:6px">ORDINE MODIFICATO</div>` : ""}
        <div class="ordine-num">#${o.numero}</div>
        <div style="text-align:center;margin-bottom:6px"><span class="badge">FRITTI</span></div>
        <div class="info-row"><span>Cliente:</span><strong>${o.cliente}</strong></div>
        ${riquadroOrario(o) || `<div class="info-row"><span>Ora:</span><span>${o.ora}</span></div>`}
        <hr style="border:none;border-top:1px dashed #000;margin:8px 0">
        <table><tbody>${righe}</tbody></table>
      </div>`;
}

// Chiede al server cosa va in friggitoria. Se non risponde, la comanda esce lo stesso (con un avviso in fondo).
async function conFritti(o: PrintOrdine): Promise<PrintOrdine> {
  if (!o.ordineId || o.fritti) return o;
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 4000);
  try {
    const res = await fetch(`/api/ordini/${o.ordineId}/fritti`, { signal: stop.signal });
    if (res.ok) return { ...o, fritti: await res.json() };
  } catch {
    // rete assente o lenta
  } finally {
    clearTimeout(timer);
  }
  return { ...o, frittiNonLetti: true };
}

// Genera HTML per la stampa termica (80mm). La comanda è a uso interno: niente intestazione né saluti, parte dal numero.
export async function generaTicketHTML(ordine: PrintOrdine): Promise<string> {
  const linea = "─".repeat(32);
  const itemsHtml = ordine.items
    .map(
      (i) => `
      <tr>
        <td style="width:30px;font-weight:bold">${i.qty}x</td>
        <td>${i.nome}${i.note ? `<br><span style="font-size:14px">${i.note.split("|").map((s) => s.trim()).filter(Boolean).map((s) => (s.startsWith("IMPASTO") ? `<b style="font-size:17px">${s}</b>` : s)).join("<br>")}</span>` : ""}</td>
        <td style="text-align:right">€${(i.prezzo * i.qty).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  // errorCorrectionLevel "H" (30%) e risoluzione alta per restare leggibile
  // anche con la qualità di stampa termica (bassa nitidezza, possibili sbavature).
  const qrDataUrl =
    ordine.tipo === "domicilio" && ordine.ordineId
      ? await QRCode.toDataURL(`${TRACKING_APP_URL}/rider?scan=${ordine.ordineId}`, {
          margin: 2,
          width: 300,
          errorCorrectionLevel: "H",
        })
      : null;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { margin: 0; size: 80mm auto; }
        body {
          font-family: 'Courier New', monospace;
          font-size: 16px;
          font-weight: bold;
          width: 76mm;
          margin: 4px;
          color: #000;
          text-transform: uppercase; /* la comanda esce sempre tutta in maiuscolo */
        }
        .info-row { display: flex; justify-content: space-between; font-size: 15px; margin: 3px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 4px 2px; font-size: 16px; }
        .totale { border-top: 1px dashed #000; margin-top: 6px; padding-top: 6px; text-align: right; font-weight: bold; font-size: 20px; }
        .ordine-num { font-size: 32px; font-weight: bold; text-align: center; margin: 0 0 6px; }
        .badge { display: inline-block; border: 1px solid #000; padding: 3px 10px; font-size: 15px; }
        .orario { border: 3px solid #000; text-align: center; width: 78%; margin: 6px auto 0; padding: 2px; }
        .orario-etichetta { font-size: 15px; }
        .orario-giorno { font-size: 19px; }
        .orario-ora { font-size: 34px; line-height: 1.05; }
        .foglio-fritti { break-before: page; page-break-before: always; }
      </style>
    </head>
    <body>
      ${ordine.modificato ? `<div style="text-align:center;font-size:22px;font-weight:bold;border:3px solid #000;padding:6px;margin:6px 0">ORDINE MODIFICATO<div style="font-size:13px;font-weight:normal">sostituisce la comanda precedente</div></div>` : ""}
      <div class="ordine-num">#${ordine.numero}</div>
      <div style="text-align:center;margin-bottom:6px">
        <span class="badge">${ordine.tipo.toUpperCase()}</span>
      </div>
      ${ordine.tavolo ? `<div style="text-align:center;font-size:28px;font-weight:bold;margin:4px 0">TAVOLO ${ordine.tavolo}</div>` : ""}
      <div class="info-row"><span>Cliente:</span><strong>${ordine.cliente}</strong></div>
      ${ordine.telefono ? `<div class="info-row"><span>Tel:</span><span>${ordine.telefono}</span></div>` : ""}
      ${ordine.indirizzo ? `<div class="info-row"><span>Indirizzo:</span><span>${ordine.indirizzo}</span></div>` : ""}
      ${ordine.nomeCitofono ? `<div class="info-row"><span>Citofono:</span><strong>${ordine.nomeCitofono}</strong></div>` : ""}
      <div class="info-row"><span>Ora:</span><span>${ordine.ora}</span></div>
      ${riquadroOrario(ordine)}
      <hr style="border:none;border-top:1px dashed #000;margin:8px 0">
      <table>
        <tbody>${itemsHtml}</tbody>
      </table>
      ${ordine.costoConsegna ? `<div class="info-row" style="margin-top:6px;border-top:1px dashed #000;padding-top:4px"><span>Consegna:</span><span>€${ordine.costoConsegna.toFixed(2)}</span></div>` : ""}
      ${ordine.scontoFedelta ? `<div class="info-row" style="margin-top:6px"><span>Sconto fedeltà:</span><span>-€${ordine.scontoFedelta.toFixed(2)}</span></div>` : ""}
      ${ordine.scontoCodice ? `<div class="info-row" style="margin-top:6px"><span>Codice ${ordine.codiceSconto ?? ""}:</span><span>-€${ordine.scontoCodice.toFixed(2)}</span></div>` : ""}
      ${ordine.metodoPagamento ? `<div class="info-row" style="margin-top:6px;border-top:1px dashed #000;padding-top:4px"><span>Pagamento:</span><strong>${ordine.metodoPagamento === "pos" || (ordine.metodoPagamento as string) === "carta" ? "POS" : "Contanti"}</strong></div>` : ""}
      ${ordine.note ? `<div style="margin-top:6px;font-size:15px;border-top:1px dashed #000;padding-top:4px"><strong>NOTE:</strong> ${ordine.note}</div>` : ""}
      ${ordine.noteDomicilio ? `<div style="margin-top:6px;font-size:15px;border-top:1px dashed #000;padding-top:4px"><strong>NOTE CONSEGNA:</strong> ${ordine.noteDomicilio}</div>` : ""}
      <div class="totale">TOTALE: €${ordine.totale.toFixed(2)}</div>
      ${qrDataUrl ? `<div style="text-align:center;margin-top:10px"><img src="${qrDataUrl}" style="width:150px;height:150px"><div style="font-size:11px;margin-top:2px">Scansiona per la consegna</div></div>` : ""}
      ${ordine.frittiNonLetti ? `<div style="text-align:center;font-size:14px;margin-top:8px">FOGLIETTO FRITTI NON STAMPATO: RISTAMPARE</div>` : ""}
      ${foglioFritti(ordine)}
    </body>
    </html>
  `;
}

// Stampa via browser (window.print). Apre subito il popup (per non farlo
// bloccare dal browser come "non richiesto da un click utente") e ci
// scrive dentro il ticket appena pronto, QR incluso.
export async function stampaBrowser(ordine: PrintOrdine): Promise<void> {
  const win = window.open("", "_blank", "width=420,height=800");
  if (!win) return;
  const html = await generaTicketHTML(await conFritti(ordine));
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
}

// Stampa "silenziosa": niente popup (che il browser bloccherebbe senza un click), il ticket viene scritto in un
// iframe nascosto e stampato da lì. Serve per la stampa automatica: per evitare anche la finestra di conferma
// avviare Chrome/Edge sul PC della cassa con l'opzione --kiosk-printing (stampa subito sulla stampante predefinita).
export async function stampaSilenziosa(ordine: PrintOrdine): Promise<void> {
  const html = await generaTicketHTML(await conFritti(ordine));
  await new Promise<void>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc || !iframe.contentWindow) { iframe.remove(); resolve(); return; }
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow!.focus();
        iframe.contentWindow!.print();
      } catch (e) {
        console.error("Stampa automatica non riuscita", e);
      }
      setTimeout(() => { iframe.remove(); resolve(); }, 1000);
    }, 500);
  });
}

// PrintNode API (fase 2 - stampa automatica)
export async function stampaPrintNode(
  ordine: PrintOrdine,
  printerId: string
): Promise<boolean> {
  const apiKey = process.env.PRINTNODE_API_KEY;
  if (!apiKey) {
    console.warn("PRINTNODE_API_KEY non configurata");
    return false;
  }

  const html = await generaTicketHTML(ordine);
  const base64 = Buffer.from(html).toString("base64");

  const res = await fetch("https://api.printnode.com/printjobs", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      printerId,
      title: `Ordine #${ordine.numero} - Don Basilico`,
      contentType: "raw_html",
      content: base64,
      source: "Don Basilico CRM",
    }),
  });

  return res.ok;
}
