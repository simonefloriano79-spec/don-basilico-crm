import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/sedi/zone — le zone di consegna già disegnate di tutte le sedi
// (l'editor zone le mostra per non sovrapporle). Il campo `zona` è un
// Unsupported("geography") lato Prisma: lettura con SQL raw + ST_AsGeoJSON.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const righe = await prisma.$queryRaw<{ sede_id: string; nome: string; zona_geojson: string }[]>`
    SELECT sc.sede_id, s.nome, ST_AsGeoJSON(sc.zona::geometry) AS zona_geojson
    FROM sedi_copertura sc
    JOIN sedi s ON s.id = sc.sede_id
    WHERE sc.zona IS NOT NULL AND s.attiva = true
  `;

  const zone = righe.map((r) => {
    const anello: [number, number][] = JSON.parse(r.zona_geojson).coordinates?.[0] ?? [];
    return { sedeId: r.sede_id, nome: r.nome, punti: anello.map(([lng, lat]) => ({ lat, lng })) };
  });
  return NextResponse.json(zone);
}
