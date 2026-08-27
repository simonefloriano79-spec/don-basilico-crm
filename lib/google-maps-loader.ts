"use client";

// Carica la Google Maps JavaScript API + Drawing library una sola volta,
// senza dipendenze npm aggiuntive (script tag iniettato a runtime).

let promessaCaricamento: Promise<void> | null = null;

export function caricaGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Solo client-side"));
  if ((window as any).google?.maps?.drawing) return Promise.resolve();
  if (promessaCaricamento) return promessaCaricamento;

  promessaCaricamento = new Promise((resolve, reject) => {
    const chiave = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!chiave) { reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_KEY non configurata")); return; }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${chiave}&libraries=drawing&language=it&region=IT`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossibile caricare Google Maps"));
    document.head.appendChild(script);
  });

  return promessaCaricamento;
}
