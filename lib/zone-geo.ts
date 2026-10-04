export interface PuntoZona { lat: number; lng: number; }

// GeoJSON (Polygon o MultiPolygon) → elenco di aree, ognuna come anello esterno di punti.
// Si tiene solo l'anello esterno: l'editor delle zone non gestisce buchi.
export function areeDaGeoJson(geojson: any): PuntoZona[][] {
  const poligoni: [number, number][][][] =
    geojson?.type === "MultiPolygon" ? geojson.coordinates ?? [] : geojson?.coordinates ? [geojson.coordinates] : [];
  return poligoni
    .map((p) => (p?.[0] ?? []).map(([lng, lat]) => ({ lat, lng })))
    .filter((anello) => anello.length >= 3);
}
