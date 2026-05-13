import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function GET() {
  const sedi = await prisma.sede.findMany({
    where: { attiva: true },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json(sedi);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato: solo il Super Admin può creare nuove filiali" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const nome = String(body.nome ?? "").trim();
    const indirizzo = String(body.indirizzo ?? "").trim();
    const citta = String(body.citta ?? "").trim();
    const telefono = String(body.telefono ?? "").trim() || null;
    const email = String(body.email ?? "").trim() || null;
    const note = String(body.note ?? "").trim() || null;
    const orarioApertura = String(body.orarioApertura ?? "11:30").trim() || "11:30";
    const orarioChiusura = String(body.orarioChiusura ?? "23:00").trim() || "23:00";
    const slug = slugify(String(body.slug ?? "").trim() || `${nome} ${citta}`);

    if (!nome || !indirizzo || !citta) {
      return NextResponse.json({ error: "Compila nome, indirizzo e città della filiale" }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: "Impossibile generare lo slug della filiale" }, { status: 400 });
    }

    const existing = await prisma.sede.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: `Esiste già una filiale con slug “${slug}”. Modifica il nome o lo slug.` }, { status: 409 });
    }

    const sede = await prisma.sede.create({
      data: {
        nome,
        indirizzo,
        citta,
        telefono,
        email,
        slug,
        note,
        orarioApertura,
        orarioChiusura,
      },
    });

    return NextResponse.json(sede, { status: 201 });
  } catch (error) {
    console.error("Errore creazione sede", error);
    return NextResponse.json({ error: "Errore interno durante la creazione della filiale" }, { status: 500 });
  }
}
