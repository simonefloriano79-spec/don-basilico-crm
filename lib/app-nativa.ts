// Vero quando la pagina gira dentro l'app Android/iOS di Don Basilico (contenitore Capacitor), non nel browser.
// Il contenitore si riconosce da "DonBasilicoApp" nello user agent (impostato in capacitor.config.ts dell'app)
// oppure dal ponte Capacitor, che la WebView inietta anche sulle pagine caricate da un indirizzo remoto.
export function inAppNativa(): boolean {
  if (typeof window === "undefined") return false;
  if (/DonBasilicoApp/.test(navigator.userAgent)) return true;
  try {
    return (window as any).Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
