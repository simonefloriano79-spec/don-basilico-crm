import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areeDaGeoJson, PuntoZona } from "@/lib/zone-geo";

const TOLLERANZA_M = 100; // fessure più strette di ~2×100 m tra due zone vengono chiuse
const MAX_AREE = 10;
const MAX_PUNTI_PER_AREA = 500;

// POST /api/sedi/[id]/zona/adatta — NON salva nulla: prende le aree disegnate nell'editor e restituisce
// la versione "adattata" ai confini delle altre sedi:
//  1) toglie ogni sovrapposizione con le zone delle altre sedi;
//  2) chiude le fessure strette (imprecisioni di disegno) tra la zona e le zone vicine, in modo che
//     i confini combacino. I vuoti ampi (zone non servite) restano come sono.
// L'utente vede il risultato sulla mappa e decide se salvarlo.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if ((session.user as any).ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const aree: PuntoZona[][] = Array.isArray(body.aree) ? body.aree : [];
  const valide =
    aree.length >= 1 && aree.length <= MAX_AREE &&
    aree.every((a) =>
      Array.isArray(a) && a.length >= 3 && a.length <= MAX_PUNTI_PER_AREA &&
      a.every((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
    );
  if (!valide) return NextResponse.json({ error: "Disegno non valido" }, { status: 400 });

  const wkt = `GEOMETRYCOLLECTION(${aree
    .map((a) => `POLYGON((${[...a, a[0]].map((p) => `${p.lng} ${p.lat}`).join(", ")}))`)
    .join(", ")})`;

  try {
    const righe = await prisma.$queryRaw<
      { geojson: string | null; aggiunto_mq: number; tolto_mq: number; confinanti: number }[]
    >`
      WITH mine AS (
        SELECT ST_CollectionExtract(ST_UnaryUnion(ST_MakeValid(ST_GeomFromText(${wkt}, 4326))), 3) AS g
      ),
      altre AS (
        SELECT sc.zona::geometry AS g
        FROM sedi_copertura sc JOIN sedi s ON s.id = sc.sede_id
        WHERE sc.sede_id <> ${params.id}::uuid AND sc.zona IS NOT NULL AND s.attiva = true
      ),
      altre_u AS (
        SELECT COALESCE(ST_Union(g), ST_GeomFromText('GEOMETRYCOLLECTION EMPTY', 4326)) AS g, count(*) AS n FROM altre
      ),
      fess AS (
        SELECT COALESCE(
          ST_Transform(ST_Union(
            ST_Difference(
              ST_Intersection(ST_Buffer(ST_Transform(m.g, 32633), ${TOLLERANZA_M}), ST_Buffer(ST_Transform(a.g, 32633), ${TOLLERANZA_M})),
              ST_Union(ST_Transform(m.g, 32633), ST_Transform(a.g, 32633))
            )
          ), 4326),
          ST_GeomFromText('GEOMETRYCOLLECTION EMPTY', 4326)
        ) AS g
        FROM mine m, altre a
      ),
      ris AS (
        SELECT ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Difference(ST_Union(m.g, f.g), u.g)), 3)) AS g, m.g AS orig, u.n
        FROM mine m, fess f, altre_u u
      )
      SELECT ST_AsGeoJSON(g) AS geojson,
             ST_Area(ST_Transform(ST_Difference(g, orig), 32633)) AS aggiunto_mq,
             ST_Area(ST_Transform(ST_Difference(orig, g), 32633)) AS tolto_mq,
             n::int AS confinanti
      FROM ris
    `;
    const r = righe[0];
    if (!r?.geojson) return NextResponse.json({ error: "Il risultato è vuoto: la zona è tutta dentro altre zone" }, { status: 422 });
    const risultato = areeDaGeoJson(JSON.parse(r.geojson));
    if (!risultato.length) return NextResponse.json({ error: "Il risultato è vuoto: la zona è tutta dentro altre zone" }, { status: 422 });

    return NextResponse.json({
      aree: risultato,
      toltoMq: Math.round(Number(r.tolto_mq)),
      aggiuntoMq: Math.round(Number(r.aggiunto_mq)),
      confinanti: Number(r.confinanti),
    });
  } catch (e) {
    console.error("Errore adatta zona", e);
    return NextResponse.json({ error: "Non riesco ad adattare questo disegno: controlla che i bordi non si incrocino" }, { status: 400 });
  }
}
