import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificaSegretoWebhook } from "@/lib/ordini-vocali/auth";

// GET /api/ordini-vocali/cerca-menu?q=diavola
// Tool per l'assistente vocale: risolve un nome detto dal cliente (prodotto o
// ingrediente extra) in id reali + prezzo, con matching approssimativo
// (pg_trgm) per tollerare imprecisioni della trascrizione vocale.
export async function GET(req: NextRequest) {
  if (!verificaSegretoWebhook(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Parametro q richiesto" }, { status: 400 });

  const [prodotti, ingredienti] = await Promise.all([
    prisma.$queryRaw<{ id: string; nome: string; categoria: string; prezzo_base: string }[]>`
      SELECT id, nome, categoria, prezzo_base::text
      FROM menu_items
      WHERE is_attivo = true AND similarity(nome, ${q}) > 0.2
      ORDER BY similarity(nome, ${q}) DESC
      LIMIT 5
    `,
    prisma.$queryRaw<{ id: string; nome: string; prezzo_aggiunta: string }[]>`
      SELECT id, nome, prezzo_aggiunta::text
      FROM ingredienti
      WHERE similarity(nome, ${q}) > 0.2
      ORDER BY similarity(nome, ${q}) DESC
      LIMIT 5
    `,
  ]);

  return NextResponse.json({
    prodotti: prodotti.map((p) => ({
      menuItemId: p.id,
      nome: p.nome,
      categoria: p.categoria,
      prezzoBase: parseFloat(p.prezzo_base),
    })),
    ingredienti: ingredienti.map((i) => ({
      ingredienteId: i.id,
      nome: i.nome,
      prezzoAggiunta: parseFloat(i.prezzo_aggiunta),
    })),
  });
}
