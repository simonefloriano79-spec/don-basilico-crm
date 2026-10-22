// Numero di telefono nel formato internazionale (E.164) che Twilio vuole. Un numero italiano dettato a voce arriva
// senza prefisso («351 427 3213»): senza «+39» Twilio lo legge come numero straniero («351» = Portogallo) e lo rifiuta
// con l'errore 21408. Cellulari italiani: 10 cifre che iniziano per 3; fissi: iniziano per 0.
export function telefonoE164(telefono: string | null | undefined): string {
  const t = String(telefono ?? "").trim().replace(/[^\d+]/g, "");
  if (!t) return "";
  if (t.startsWith("+")) return t;
  if (t.startsWith("00")) return `+${t.slice(2)}`;
  // Già con il prefisso 39 davanti (39 + 9-11 cifre): «393514273213» → «+393514273213».
  if (t.startsWith("39") && t.length >= 11 && t.length <= 13) return `+${t}`;
  // Numero italiano senza prefisso: cellulare (3…) o fisso (0…).
  if (/^[03]\d{6,10}$/.test(t)) return `+39${t}`;
  return t.length >= 11 ? `+${t}` : t;
}
