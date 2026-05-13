import { randomUUID } from "crypto";
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

async function ensureSediTable() {
  // In produzione alcuni database creati prima dello step multi-sede possono non avere ancora
  // la tabella `sedi`. La creiamo/normalizziamo in modo idempotente prima delle operazioni.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sedi (
      id uuid PRIMARY KEY,
      nome text NOT NULL,
      indirizzo text NOT NULL,
      citta text NOT NULL,
      telefono text,
      email text,
      slug text NOT NULL,
      attiva boolean NOT NULL DEFAULT true,
      orario_apertura text NOT NULL DEFAULT '11:30',
      orario_chiusura text NOT NULL DEFAULT '23:00',
      note text,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS nome text NOT NULL DEFAULT 'Filiale Don Basilico'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS indirizzo text NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS citta text NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS telefono text`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS email text`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS slug text`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS attiva boolean NOT NULL DEFAULT true`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS orario_apertura text NOT NULL DEFAULT '11:30'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS orario_chiusura text NOT NULL DEFAULT '23:00'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS note text`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now()`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now()`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_apertura DROP DEFAULT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_chiusura DROP DEFAULT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_apertura TYPE text USING COALESCE(substring(orario_apertura::text from '([0-9]{2}:[0-9]{2})'), '11:30')`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_chiusura TYPE text USING COALESCE(substring(orario_chiusura::text from '([0-9]{2}:[0-9]{2})'), '23:00')`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_apertura SET DEFAULT '11:30'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_chiusura SET DEFAULT '23:00'`);
  await prisma.$executeRawUnsafe(`UPDATE sedi SET slug = lower(regexp_replace(nome || '-' || citta, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL OR trim(slug) = ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN slug SET NOT NULL`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS sedi_slug_key ON sedi(slug)`);
}

async function listSedi() {
  return prisma.sede.findMany({
    where: { attiva: true },
    orderBy: { nome: "asc" },
  });
}

export async function GET() {
  try {
    return NextResponse.json(await listSedi());
  } catch (error) {
    console.error("Errore lettura sedi, provo inizializzazione tabella", error);
    try {
      await ensureSediTable();
      return NextResponse.json(await listSedi());
    } catch (fallbackError) {
      console.error("Errore inizializzazione/lettura sedi", fallbackError);
      return NextResponse.json({ error: "Errore interno durante il caricamento delle filiali" }, { status: 500 });
    }
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const user = session.user as any;
  if (user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato: solo il Super Admin può creare nuove filiali" }, { status: 403 });
  }

  try {
    await ensureSediTable();

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

    if (!nome) {
      return NextResponse.json({ error: "Inserisci il nome della filiale, ad esempio Don Basilico Centro" }, { status: 400 });
    }
    if (!indirizzo) {
      return NextResponse.json({ error: "Inserisci l’indirizzo della filiale" }, { status: 400 });
    }
    if (!citta) {
      return NextResponse.json({ error: "Inserisci la città della filiale" }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: "Impossibile generare lo slug della filiale" }, { status: 400 });
    }

    const existing = await prisma.sede.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: `Esiste già una filiale con slug “${slug}”. Modifica il nome o lo slug.`, sede: existing }, { status: 409 });
    }

    const sede = await prisma.sede.create({
      data: {
        id: randomUUID(),
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
