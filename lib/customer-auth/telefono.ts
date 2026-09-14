// Normalizza un numero italiano in formato E.164 (+39...), richiesto da Twilio.
export function normalizzaTelefono(input: string): string | null {
  const pulito = input.trim().replace(/[\s-]/g, "");
  if (/^\+\d{8,15}$/.test(pulito)) return pulito;
  if (/^3\d{8,9}$/.test(pulito)) return `+39${pulito}`;
  return null;
}
