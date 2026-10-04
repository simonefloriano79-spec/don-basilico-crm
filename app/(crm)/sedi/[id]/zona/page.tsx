"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { caricaGoogleMaps } from "@/lib/google-maps-loader";

type Punto = { lat: number; lng: number };

const STILE_AREA = { strokeColor: "#7ac143", fillColor: "#7ac143", fillOpacity: 0.15, strokeWeight: 2 };
const STILE_AREA_SELEZIONATA = { strokeColor: "#2f7d0f", fillColor: "#7ac143", fillOpacity: 0.3, strokeWeight: 4 };

const btnChiaro: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)", color: "var(--text-2)", padding: "9px 16px", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)" };

export default function ZonaConsegnaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  // Una sede può avere più aree (es. due quartieri non contigui): si possono aggiungere
  // nuove aree senza toccare quelle già salvate.
  const areeRef = useRef<google.maps.Polygon[]>([]);
  const selezionataRef = useRef<google.maps.Polygon | null>(null);
  // Disegno a click: Google ha rimosso DrawingManager dalla v3.65, quindi i
  // vertici si raccolgono a mano con un listener sul click della mappa.
  const bozzaRef = useRef<{ punti: google.maps.LatLng[]; linea: google.maps.Polyline; marker: google.maps.Marker[]; ascolto: google.maps.MapsEventListener } | null>(null);

  const sedePosRef = useRef<{ lat: number; lng: number } | null>(null);
  const [sede, setSede] = useState<any>(null);
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nAree, setNAree] = useState(0);
  const [selezione, setSelezione] = useState(false);
  const [nPunti, setNPunti] = useState(0);
  const [disegnando, setDisegnando] = useState(false);
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
        const aree: Punto[][] = Array.isArray(zonaRes.aree) ? zonaRes.aree : zonaRes.punti ? [zonaRes.punti] : [];

        const map = new google.maps.Map(mapRef.current, {
          zoom: 13,
          center: aree[0]?.length ? aree[0][0] : { lat: 42.4643, lng: 14.2142 }, // fallback: Pescara
          mapTypeControl: false, streetViewControl: false,
        });
        mapObj.current = map;

        // Posizione reale della sede: serve a scegliere la sede più vicina quando due zone si sovrappongono.
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: `${sede.indirizzo}, ${sede.citta}, Italia` }, (risultati, status) => {
          if (status === "OK" && risultati?.[0]) {
            const loc = risultati[0].geometry.location;
            sedePosRef.current = { lat: loc.lat(), lng: loc.lng() };
            if (!aree.length) map.setCenter(loc);
          }
        });

        if (aree.length) {
          const bounds = new google.maps.LatLngBounds();
          aree.forEach((punti) => { aggiungiArea(map, punti); punti.forEach((p) => bounds.extend(p)); });
          map.fitBounds(bounds);
        } else {
          avviaDisegno(map);
        }

        mostraAltreSedi(map, geocoder).catch(() => {});

        setPronto(true);
      })
      .catch((e) => setErrore(e.message));

    return () => { cancellato = true; };
  }, [sede, id]);

  // Pin rossi su tutte le sedi + confini delle zone già assegnate alle altre sedi (sola lettura:
  // clickable false, così i click passano alla mappa e si può disegnare anche sopra).
  async function mostraAltreSedi(map: google.maps.Map, geocoder: google.maps.Geocoder) {
    const [elenco, zone] = await Promise.all([
      fetch("/api/sedi").then((r) => r.json()),
      fetch("/api/sedi/zone").then((r) => r.json()),
    ]);
    const COLORI = ["#2563eb", "#d97706", "#7c3aed", "#db2777", "#0d9488", "#ea580c"];
    const corto = (nome: string) => String(nome).replace(/^Don Basilico\s*/i, "");

    (Array.isArray(zone) ? zone : []).filter((z: any) => z.sedeId !== id).forEach((z: any, i: number) => {
      const colore = COLORI[i % COLORI.length];
      const bounds = new google.maps.LatLngBounds();
      (z.aree ?? []).forEach((punti: Punto[]) => {
        new google.maps.Polygon({
          paths: punti, map, clickable: false,
          strokeColor: colore, fillColor: colore, fillOpacity: 0.12, strokeWeight: 2,
        });
        punti.forEach((p) => bounds.extend(p));
      });
      if (bounds.isEmpty()) return;
      new google.maps.Marker({
        position: bounds.getCenter(), map, clickable: false,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: { text: `Zona ${corto(z.nome)}`, color: colore, fontSize: "12px", fontWeight: "700" },
      });
    });

    (Array.isArray(elenco) ? elenco : []).forEach((s: any) => {
      geocoder.geocode({ address: `${s.indirizzo}, ${s.citta}, Italia` }, (risultati, status) => {
        if (status !== "OK" || !risultati?.[0]) return;
        const corrente = s.id === id;
        new google.maps.Marker({
          position: risultati[0].geometry.location, map, clickable: false, zIndex: corrente ? 20 : 10,
          icon: {
            path: "M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z",
            fillColor: "#dc2626", fillOpacity: 1, strokeColor: corrente ? "#111" : "#fff", strokeWeight: corrente ? 2 : 1.2,
            scale: corrente ? 1.9 : 1.5, anchor: new google.maps.Point(12, 22), labelOrigin: new google.maps.Point(12, 28),
          },
          label: { text: corto(s.nome), color: "#111", fontSize: "12px", fontWeight: corrente ? "800" : "600", className: "pin-sede-label" },
        });
      });
    });
  }

  function selezionaArea(poligono: google.maps.Polygon | null) {
    areeRef.current.forEach((p) => p.setOptions(STILE_AREA));
    selezionataRef.current = poligono;
    if (poligono) poligono.setOptions(STILE_AREA_SELEZIONATA);
    setSelezione(!!poligono);
  }

  function aggiungiArea(map: google.maps.Map, punti: Punto[]) {
    const poligono = new google.maps.Polygon({ paths: punti, editable: true, draggable: true, ...STILE_AREA });
    poligono.setMap(map);
    poligono.addListener("click", () => selezionaArea(selezionataRef.current === poligono ? null : poligono));
    areeRef.current.push(poligono);
    setNAree(areeRef.current.length);
  }

  // Durante il disegno le aree esistenti non devono "mangiare" i click né spostarsi per sbaglio.
  function bloccaAree(bloccate: boolean) {
    areeRef.current.forEach((p) => p.setOptions({ clickable: !bloccate, editable: !bloccate, draggable: !bloccate }));
  }

  function eliminaSelezionata() {
    const p = selezionataRef.current;
    if (!p) return;
    p.setMap(null);
    areeRef.current = areeRef.current.filter((x) => x !== p);
    selezionataRef.current = null;
    setSelezione(false);
    setNAree(areeRef.current.length);
    if (!areeRef.current.length && mapObj.current) avviaDisegno(mapObj.current);
  }

  function pulisciBozza() {
    const b = bozzaRef.current;
    if (!b) return;
    google.maps.event.removeListener(b.ascolto);
    b.linea.setMap(null);
    b.marker.forEach((m) => m.setMap(null));
    bozzaRef.current = null;
    setNPunti(0);
    setDisegnando(false);
    bloccaAree(false);
    if (mapObj.current) mapObj.current.setOptions({ draggableCursor: undefined });
  }

  function chiudiZona(map: google.maps.Map) {
    const b = bozzaRef.current;
    if (!b || b.punti.length < 3) return;
    const punti = b.punti.map((p) => ({ lat: p.lat(), lng: p.lng() }));
    pulisciBozza();
    aggiungiArea(map, punti);
  }

  function avviaDisegno(map: google.maps.Map) {
    pulisciBozza();
    selezionaArea(null);
    bloccaAree(true);
    setDisegnando(true);
    map.setOptions({ draggableCursor: "crosshair" });
    const linea = new google.maps.Polyline({
      path: [], strokeColor: "#7ac143", strokeWeight: 2, map,
    });
    const bozza = {
      punti: [] as google.maps.LatLng[], linea, marker: [] as google.maps.Marker[],
      ascolto: map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        bozza.punti.push(e.latLng);
        linea.setPath(bozza.punti);
        const primo = bozza.punti.length === 1;
        const marker = new google.maps.Marker({
          position: e.latLng, map, clickable: primo,
          title: primo ? "Clicca qui per chiudere la zona" : undefined,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: primo ? 9 : 6, fillColor: primo ? "#e14b3b" : "#7ac143", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        });
        if (primo) marker.addListener("click", () => chiudiZona(map));
        bozza.marker.push(marker);
        setNPunti(bozza.punti.length);
      }),
    };
    bozzaRef.current = bozza;
  }

  function annullaUltimoPunto() {
    const b = bozzaRef.current;
    if (!b || !b.punti.length) return;
    b.punti.pop();
    b.marker.pop()?.setMap(null);
    b.linea.setPath(b.punti);
    setNPunti(b.punti.length);
  }

  // Annulla il disegno in corso: le aree già presenti restano com'erano.
  function annullaDisegno() {
    pulisciBozza();
  }

  async function salva(forza = false) {
    if (!areeRef.current.length) return;
    const aree = areeRef.current.map((p) => p.getPath().getArray().map((q) => ({ lat: q.lat(), lng: q.lng() })));

    setSalvando(true);
    const res = await fetch(`/api/sedi/${id}/zona`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aree, centro: sedePosRef.current, forza }),
    });
    setSalvando(false);

    if (res.ok) { toast.success("Zona di consegna salvata"); router.push("/sedi"); return; }
    const d = await res.json().catch(() => ({}));
    if (res.status === 409 && Array.isArray(d.sovrapposizioni)) {
      const elenco = d.sovrapposizioni.map((s: any) => `• ${s.nome} (circa ${s.mq.toLocaleString("it-IT")} m²)`).join("\n");
      if (confirm(`Questa zona si sovrappone a:\n${elenco}\n\nNelle parti in comune vincerà la sede più vicina all'indirizzo.\nSalvare comunque?`)) salva(true);
      return;
    }
    toast.error(d.error ?? "Errore nel salvataggio");
  }

  const puoSalvare = nAree > 0 && !disegnando && !salvando;

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)" }}>Zona di consegna</h1>
          {sede && <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{sede.nome}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/sedi")} style={btnChiaro}>Esci senza salvare</button>
          {disegnando && nPunti > 0 && <button onClick={annullaUltimoPunto} style={btnChiaro}>Togli ultimo punto</button>}
          {disegnando && nPunti >= 3 && (
            <button onClick={() => mapObj.current && chiudiZona(mapObj.current)} style={{ background: "var(--accent-ink)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}>Chiudi area</button>
          )}
          {disegnando && nAree > 0 && <button onClick={annullaDisegno} style={btnChiaro}>Annulla questo disegno</button>}
          {!disegnando && nAree > 0 && (
            <button onClick={() => mapObj.current && avviaDisegno(mapObj.current)} style={btnChiaro}>+ Aggiungi un'altra area</button>
          )}
          {!disegnando && selezione && (
            <button onClick={eliminaSelezionata} style={{ ...btnChiaro, color: "var(--danger)", borderColor: "var(--danger-border)" }}>Elimina area selezionata</button>
          )}
          <button onClick={() => salva()} disabled={!puoSalvare} style={{
            background: puoSalvare ? "var(--text)" : "var(--border)", color: puoSalvare ? "#fff" : "var(--text-faint)",
            border: "none", padding: "9px 18px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: puoSalvare ? "pointer" : "default", fontFamily: "var(--font-ui)",
          }}>{salvando ? "Salvataggio…" : "Salva zona"}</button>
        </div>
      </div>

      {errore && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{errore}</div>}
      <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
        {disegnando
          ? nAree > 0
            ? `Stai aggiungendo una nuova area: le ${nAree === 1 ? "area già presente resta" : nAree + " aree già presenti restano"} com'${nAree === 1 ? "è" : "erano"}. ` +
              (nPunti === 0 ? "Clicca sulla mappa per mettere il primo punto." : nPunti < 3 ? `Hai messo ${nPunti} ${nPunti === 1 ? "punto" : "punti"}: ne servono almeno 3.` : "Per finire clicca sul pallino rosso (il primo punto) oppure premi Chiudi area.")
            : nPunti === 0
              ? "Clicca sulla mappa per mettere il primo punto, poi gli altri attorno all'area coperta dalla consegna."
              : nPunti < 3
                ? `Hai messo ${nPunti} ${nPunti === 1 ? "punto" : "punti"}: continua a cliccare attorno all'area (ne servono almeno 3).`
                : "Per finire clicca sul pallino rosso (il primo punto) oppure premi Chiudi area."
          : `${nAree === 1 ? "1 area" : nAree + " aree"} di consegna. Trascina i pallini sui bordi per correggerla, clicca un'area per selezionarla ed eliminarla, oppure premi "+ Aggiungi un'altra area". Alla fine premi Salva zona.`}
      </p>

      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        <span style={{ color: "#dc2626", fontWeight: 700 }}>●</span> Pin rossi = le nostre sedi (quella che stai modificando ha il contorno nero).
        Le aree colorate sono le zone già assegnate alle altre sedi: tieni il tuo disegno fuori da quelle.
      </p>

      <div ref={mapRef} style={{ width: "100%", height: "70vh", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface-muted)" }} />
    </div>
  );
}
