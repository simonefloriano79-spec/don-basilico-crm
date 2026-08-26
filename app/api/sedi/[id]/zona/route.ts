import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Punto { lat: number; lng: number; }

// GET /api/sedi/[id]/zona — poligono di consegna corrente della sede, se esiste.
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
    return NextResponse.json({ punti: null });
  }

  const geojson = JSON.parse(righe[0].zona_geojson);
  const anello: [number, number][] = geojson.coordinates?.[0] ?? [];
  const punti: Punto[] = anello.map(([lng, lat]) => ({ lat, lng }));

  return NextResponse.json({ punti });
}

// PUT /api/sedi/[id]/zona — salva (crea o sostituisce) il poligono di consegna.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const punti: Punto[] = body.punti;

  if (!Array.isArray(punti) || punti.length < 3) {
    return NextResponse.json({ error: "Servono almeno 3 punti per disegnare una zona" }, { status: 400 });
  }

  const sede = await prisma.sede.findUnique({ where: { id: params.id } });
  if (!sede) return NextResponse.json({ error: "Sede non trovata" }, { status: 404 });

  const anello = [...punti, punti[0]]; // il poligono deve chiudersi sul primo punto
  const wkt = `POLYGON((${anello.map((p) => `${p.lng} ${p.lat}`).join(", ")}))`;
  const latCentro = punti.reduce((a, p) => a + p.lat, 0) / punti.length;
  const lngCentro = punti.reduce((a, p) => a + p.lng, 0) / punti.length;

  await prisma.$executeRaw`
    INSERT INTO sedi_copertura (id, sede_id, lat, lng, zona, attiva)
    VALUES (gen_random_uuid(), ${params.id}::uuid, ${latCentro}, ${lngCentro}, ST_GeogFromText(${`SRID=4326;${wkt}`}), true)
    ON CONFLICT (sede_id) DO UPDATE
    SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, zona = EXCLUDED.zona, updated_at = now()
  `;

  return NextResponse.json({ ok: true });
}
