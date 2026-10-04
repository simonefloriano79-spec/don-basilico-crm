import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areeDaGeoJson } from "@/lib/zone-geo";

interface Punto { lat: number; lng: number; }

const MAX_AREE = 10;
const MAX_PUNTI_PER_AREA = 500;

// GET /api/sedi/[id]/zona — aree di consegna correnti della sede, se esistono.
// Lettura via ST_AsGeoJSON: il campo `zona` è un Unsupported("geography")
// lato Prisma, va letto/scritto con SQL raw (stesso limite di copertura.ts).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const righe = await prisma.$queryRaw<{ zona_geojson: string | null; lat: string; lng: string }[]>`
    SELECT ST_AsGeoJSON(zona::geometry) as zona_geojson, lat, lng
    FROM sedi_copertura WHERE sede_id = ${params.id}::uuid
  `;

  if (!righe.length || !righe[0].zona_geojson) {
    return NextResponse.json({ aree: [], punti: null });
  }

  const aree = areeDaGeoJson(JSON.parse(righe[0].zona_geojson));
  // `punti` (prima area) resta per compatibilità con chi leggeva una sola zona.
  return NextResponse.json({ aree, punti: aree[0] ?? null });
}

// PUT /api/sedi/[id]/zona — salva (crea o sostituisce) le aree di consegna della sede.
// Body: { aree: Punto[][], centro?, forza? } (accetta anche il vecchio { punti }).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const aree: Punto[][] = Array.isArray(body.aree) ? body.aree : Array.isArray(body.punti) ? [body.punti] : [];

  const valide =
    aree.length >= 1 && aree.length <= MAX_AREE &&
    aree.every((a) =>
      Array.isArray(a) && a.length >= 3 && a.length <= MAX_PUNTI_PER_AREA &&
      a.every((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
    );
  if (!valide) {
    return NextResponse.json({ error: "Servono da 1 a 10 aree, ognuna con almeno 3 punti" }, { status: 400 });
  }

  const sede = await prisma.sede.findUnique({ where: { id: params.id } });
  if (!sede) return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });

  // Ogni area si chiude sul primo punto; tutte insieme in una GEOMETRYCOLLECTION che il
  // database fonde (ST_UnaryUnion): aree che si toccano o si sovrappongono diventano una sola.
  const poligoni = aree.map((a) => {
    const anello = [...a, a[0]];
    return `POLYGON((${anello.map((p) => `${p.lng} ${p.lat}`).join(", ")}))`;
  });
  const wkt = `GEOMETRYCOLLECTION(${poligoni.join(", ")})`;

  // lat/lng = posizione della sede (geocodificata dall'editor); se manca, ripiego sul baricentro dei punti.
  const tuttiPunti = aree.flat();
  const centro = body.centro;
  const centroValido =
    centro && Number.isFinite(centro.lat) && Number.isFinite(centro.lng) &&
    Math.abs(centro.lat) <= 90 && Math.abs(centro.lng) <= 180;
  const latCentro = centroValido ? Number(centro.lat) : tuttiPunti.reduce((a, p) => a + p.lat, 0) / tuttiPunti.length;
  const lngCentro = centroValido ? Number(centro.lng) : tuttiPunti.reduce((a, p) => a + p.lng, 0) / tuttiPunti.length;

  try {
    // Sovrapposizione con le zone delle altre sedi: avviso (non blocco) se supera ~1.000 m²,
    // salvo conferma esplicita dall'editor (`forza`).
    if (body.forza !== true) {
      const sovrapposte = await prisma.$queryRaw<{ nome: string; area: number }[]>`
        WITH nuova AS (
          SELECT ST_Multi(ST_CollectionExtract(ST_UnaryUnion(ST_MakeValid(ST_GeomFromText(${wkt}, 4326))), 3))::geography AS g
        )
        SELECT s.nome, ST_Area(ST_Intersection(sc.zona, nuova.g)) AS area
        FROM nuova, sedi_copertura sc
        JOIN sedi s ON s.id = sc.sede_id
        WHERE sc.sede_id <> ${params.id}::uuid AND sc.zona IS NOT NULL AND s.attiva = true
          AND ST_Intersects(sc.zona, nuova.g)
      `;
      const significative = sovrapposte.filter((r) => Number(r.area) > 1000);
      if (significative.length) {
        return NextResponse.json(
          {
            error: "La zona si sovrappone a quella di altre sedi",
            sovrapposizioni: significative.map((r) => ({ nome: r.nome, mq: Math.round(Number(r.area)) })),
          },
          { status: 409 }
        );
      }
    }

    await prisma.$executeRaw`
      INSERT INTO sedi_copertura (id, sede_id, lat, lng, zona, attiva)
      VALUES (
        gen_random_uuid(), ${params.id}::uuid, ${latCentro}, ${lngCentro},
        ST_Multi(ST_CollectionExtract(ST_UnaryUnion(ST_MakeValid(ST_GeomFromText(${wkt}, 4326))), 3))::geography,
        true
      )
      ON CONFLICT (sede_id) DO UPDATE
      SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, zona = EXCLUDED.zona, updated_at = now()
    `;
  } catch (e: any) {
    console.error("Errore salvataggio zona", e);
    const msg = String(e?.message ?? "");
    if (/does not match column type|Geometry type/i.test(msg)) {
      return NextResponse.json({ error: "Il database non è ancora pronto per più aree (manca la migrazione SQL delle zone)" }, { status: 500 });
    }
    return NextResponse.json({ error: "Disegno non valido: controlla che i bordi non si incrocino" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
