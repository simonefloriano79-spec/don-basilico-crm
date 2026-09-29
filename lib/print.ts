// Gestione stampa ordini
// Supporta: Stampa browser (fase 1) + PrintNode (fase 2)

export interface PrintOrdine {
  numero: number;
  sede: string;
  canale: string;
  tipo: string;
  cliente: string;
  telefono?: string;
  indirizzo?: string;
  items: Array<{ nome: string; qty: number; prezzo: number; note?: string }>;
  totale: number;
  costoConsegna?: number;
  note?: string;
  noteDomicilio?: string;
  oraConsegnaComunicata?: string;
  modalitaConsegna?: "appena_possibile" | "non_prima" | null;
  metodoPagamento?: "contanti" | "pos" | null;
  ora: string;
}

// Genera HTML per la stampa termica (80mm)
export function generaTicketHTML(ordine: PrintOrdine): string {
  const linea = "─".repeat(32);
  const itemsHtml = ordine.items
    .map(
      (i) => `
      <tr>
        <td style="width:30px;font-weight:bold">${i.qty}x</td>
        <td>${i.nome}${i.note ? `<br><span style="font-size:14px">${i.note.split("|").map((s) => s.trim()).filter(Boolean).join("<br>")}</span>` : ""}</td>
        <td style="text-align:right">€${(i.prezzo * i.qty).toFixed(2)}</td>
      </tr>`
    )
    .join("");

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
        }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
        .logo { font-size: 22px; font-weight: bold; }
        .sub { font-size: 14px; }
        .info-row { display: flex; justify-content: space-between; font-size: 15px; margin: 3px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 4px 2px; font-size: 16px; }
        .totale { border-top: 1px dashed #000; margin-top: 6px; padding-top: 6px; text-align: right; font-weight: bold; font-size: 20px; }
        .footer { text-align: center; margin-top: 10px; font-size: 13px; }
        .ordine-num { font-size: 32px; font-weight: bold; text-align: center; margin: 6px 0; }
        .badge { display: inline-block; border: 1px solid #000; padding: 3px 10px; font-size: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">DON BASILICO</div>
        <div class="sub">${ordine.sede}</div>
      </div>
      <div class="ordine-num">#${ordine.numero}</div>
      <div style="text-align:center;margin-bottom:6px">
        <span class="badge">${ordine.tipo.toUpperCase()}</span>
      </div>
      <div class="info-row"><span>Cliente:</span><strong>${ordine.cliente}</strong></div>
      ${ordine.telefono ? `<div class="info-row"><span>Tel:</span><span>${ordine.telefono}</span></div>` : ""}
      ${ordine.indirizzo ? `<div class="info-row"><span>Indirizzo:</span><span>${ordine.indirizzo}</span></div>` : ""}
      <div class="info-row"><span>Ora:</span><span>${ordine.ora}</span></div>
      ${ordine.oraConsegnaComunicata ? `<div class="info-row"><span>${ordine.modalitaConsegna === "non_prima" ? "Non prima delle:" : "Appena possibile, entro:"}</span><strong>${ordine.oraConsegnaComunicata}</strong></div>` : ""}
      <hr style="border:none;border-top:1px dashed #000;margin:8px 0">
      <table>
        <tbody>${itemsHtml}</tbody>
      </table>
      ${ordine.costoConsegna ? `<div class="info-row" style="margin-top:6px;border-top:1px dashed #000;padding-top:4px"><span>Consegna:</span><span>€${ordine.costoConsegna.toFixed(2)}</span></div>` : ""}
      ${ordine.metodoPagamento ? `<div class="info-row" style="margin-top:6px;border-top:1px dashed #000;padding-top:4px"><span>Pagamento:</span><strong>${ordine.metodoPagamento === "pos" ? "POS" : "Contanti"}</strong></div>` : ""}
      ${ordine.note ? `<div style="margin-top:6px;font-size:15px;border-top:1px dashed #000;padding-top:4px"><strong>NOTE:</strong> ${ordine.note}</div>` : ""}
      ${ordine.noteDomicilio ? `<div style="margin-top:6px;font-size:15px;border-top:1px dashed #000;padding-top:4px"><strong>NOTE CONSEGNA:</strong> ${ordine.noteDomicilio}</div>` : ""}
      <div class="totale">TOTALE: €${ordine.totale.toFixed(2)}</div>
      <div class="footer">
        Grazie e buon appetito!<br>
        www.donbasilico.it
      </div>
    </body>
    </html>
  `;
}

// Stampa via browser (window.print)
export function stampaBrowser(ordine: PrintOrdine): void {
  const html = generaTicketHTML(ordine);
  const win = window.open("", "_blank", "width=420,height=800");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
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

  const html = generaTicketHTML(ordine);
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
