import { prisma } from "@/lib/prisma";

export interface Geocode {
  lat: number;
  lng: number;
  indirizzoFormattato: string;
}

// Geocoding via Google Maps. Ritorna null se l'indirizzo non è riconosciuto
// (l'assistente dovrà chiedere al cliente di ripeterlo/precisarlo).
export async function geocodificaIndirizzo(indirizzo: string): Promise<Geocode | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY non configurata");

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", indirizzo);
  url.searchParams.set("region", "it");
  url.searchParams.set("components", "country:IT");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" || !data.results?.length) return null;

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    indirizzoFormattato: result.formatted_address,
  };
}

export interface SedeCoperta {
  sedeId: string;
  nome: string;
}

// Determina quale sede copre l'indirizzo: prima le zone poligonali disegnate
// a mano (precise), poi come fallback il raggio_km per le sedi senza zona
// ancora definita. Le due modalità sono mutuamente esclusive per riga:
// se una sede ha una zona, quella sede NON usa più il raggio come ripiego.
export async function trovaSedeCompetente(lat: number, lng: number): Promise<SedeCoperta | null> {
  const risultati = await prisma.$queryRaw<{ sede_id: string; nome: string }[]>`
    SELECT sc.sede_id, s.nome
    FROM sedi_copertura sc
    JOIN sedi s ON s.id = sc.sede_id
    WHERE sc.attiva = true AND s.attiva = true
      AND (
        (sc.zona IS NOT NULL AND ST_Contains(sc.zona::geometry, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)))
        OR
        (sc.zona IS NULL AND sc.raggio_km IS NOT NULL AND
         ST_DistanceSphere(
           ST_MakePoint(sc.lng::float8, sc.lat::float8),
           ST_MakePoint(${lng}::float8, ${lat}::float8)
         ) <= sc.raggio_km * 1000)
      )
    ORDER BY (sc.zona IS NOT NULL) DESC
    LIMIT 1
  `;

  if (!risultati.length) return null;
  return { sedeId: risultati[0].sede_id, nome: risultati[0].nome };
}
