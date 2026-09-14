"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { caricaGoogleMaps } from "@/lib/google-maps-loader";

export default function ZonaConsegnaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  const poligonoRef = useRef<google.maps.Polygon | null>(null);
  // I tipi @types/google.maps non modellano più il costruttore classico di
  // DrawingManager (pensato per il nuovo caricamento a librerie async):
  // il comportamento a runtime resta quello classico, quindi qui usiamo `any`.
  const drawingManagerRef = useRef<any>(null);

  const [sede, setSede] = useState<any>(null);
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [haPoligono, setHaPoligono] = useState(false);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    fetch("/api/sedi").then((r) => r.json()).then((d) => setSede((d ?? []).find((s: any) => s.id === id)));
  }, [id]);

  useEffect(() => {
    if (!sede) return;

    let cancellato = false;
    caricaGoogleMaps()
      .then(async () => {
        if (cancellato || !mapRef.current) return;

        const zonaRes = await fetch(`/api/sedi/${id}/zona`).then((r) => r.json());
        const punti: { lat: number; lng: number }[] | null = zonaRes.punti;

        const map = new google.maps.Map(mapRef.current, {
          zoom: 13,
          center: punti?.length ? punti[0] : { lat: 42.4643, lng: 14.2142 }, // fallback: Pescara
          mapTypeControl: false, streetViewControl: false,
        });
        mapObj.current = map;

        if (punti?.length) {
          disegnaPoligonoEsistente(map, punti);
        } else {
          // Centra sull'indirizzo della sede, poi apre subito la modalità disegno
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ address: `${sede.indirizzo}, ${sede.citta}, Italia` }, (risultati, status) => {
            if (status === "OK" && risultati?.[0]) map.setCenter(risultati[0].geometry.location);
          });
          avviaDisegno(map);
        }

        setPronto(true);
      })
      .catch((e) => setErrore(e.message));

    return () => { cancellato = true; };
  }, [sede, id]);

  function disegnaPoligonoEsistente(map: google.maps.Map, punti: { lat: number; lng: number }[]) {
    const bounds = new google.maps.LatLngBounds();
    punti.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds);

    const poligono = new google.maps.Polygon({
      paths: punti, editable: true, draggable: true,
      strokeColor: "#7ac143", fillColor: "#7ac143", fillOpacity: 0.15, strokeWeight: 2,
    });
    poligono.setMap(map);
    poligonoRef.current = poligono;
    setHaPoligono(true);
  }

  function avviaDisegno(map: google.maps.Map) {
    const DrawingManagerCtor = (google.maps.drawing as any).DrawingManager;
    const dm = new DrawingManagerCtor({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: { strokeColor: "#7ac143", fillColor: "#7ac143", fillOpacity: 0.15, strokeWeight: 2, editable: true, draggable: true },
    });
    dm.setMap(map);
    drawingManagerRef.current = dm;

    google.maps.event.addListener(dm, "polygoncomplete", (poligono: google.maps.Polygon) => {
      poligonoRef.current = poligono;
      dm.setDrawingMode(null);
      setHaPoligono(true);
    });
  }

  function ridisegna() {
    poligonoRef.current?.setMap(null);
    poligonoRef.current = null;
    setHaPoligono(false);
    if (mapObj.current) avviaDisegno(mapObj.current);
  }

  async function salva() {
    if (!poligonoRef.current) return;
    const punti = poligonoRef.current.getPath().getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));

    setSalvando(true);
    const res = await fetch(`/api/sedi/${id}/zona`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ punti }),
    });
    setSalvando(false);

    if (res.ok) { toast.success("Zona di consegna salvata"); router.push("/sedi"); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Errore nel salvataggio"); }
  }

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)" }}>Zona di consegna</h1>
          {sede && <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{sede.nome}</p>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/sedi")} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "9px 16px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)" }}>Annulla</button>
          {haPoligono && (
            <button onClick={ridisegna} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "9px 16px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)" }}>Ridisegna</button>
          )}
          <button onClick={salva} disabled={!haPoligono || salvando} style={{
            background: haPoligono ? "var(--text)" : "var(--border)", color: haPoligono ? "#fff" : "var(--text-faint)",
            border: "none", padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: haPoligono ? "pointer" : "default", fontFamily: "var(--font-ui)",
          }}>{salvando ? "Salvataggio…" : "Salva zona"}</button>
        </div>
      </div>

      {errore && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{errore}</div>}
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Disegna sulla mappa l'area coperta dalla consegna di questa sede. Trascina i vertici per modificarla, poi salva.</p>

      <div ref={mapRef} style={{ width: "100%", height: "70vh", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface-muted)" }} />
    </div>
  );
}
