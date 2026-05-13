import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const filiali = [
  {
    slug: "centro",
    aliases: ["centro"],
    nome: "Don Basilico Pescara Centro",
    indirizzo: "Viale Bovio 168",
    citta: "Pescara",
    telefono: "0852056985",
    email: "sede@donbasilico.it",
  },
  {
    slug: "portanuova",
    aliases: ["portanuova", "porta-nuova"],
    nome: "Don Basilico Portanuova",
    indirizzo: "Viale Marconi 148",
    citta: "Pescara",
    telefono: "0854554880",
    email: "portanuova@donbasilico.it",
  },
  {
    slug: "universita",
    aliases: ["universita", "università"],
    nome: "Don Basilico Università",
    indirizzo: "Viale Marconi 373",
    citta: "Pescara",
    telefono: "085691937",
    email: null,
  },
  {
    slug: "pescara-nord",
    aliases: ["pescara-nord"],
    nome: "Don Basilico Pescara Nord",
    indirizzo: "Via Nazionale Adriatica Nord 379",
    citta: "Pescara",
    telefono: "0857933078",
    email: null,
  },
  {
    slug: "chieti-scalo",
    aliases: ["chieti-scalo", "chieti"],
    nome: "Don Basilico Chieti Scalo",
    indirizzo: "Viale Abruzzo 51",
    citta: "Chieti Scalo",
    telefono: "0871559511",
    email: null,
  },
  {
    slug: "montesilvano",
    aliases: ["montesilvano"],
    nome: "Don Basilico Montesilvano",
    indirizzo: "Corso Umberto 156",
    citta: "Montesilvano",
    telefono: "0854492713",
    email: null,
  },
];

async function ensureSediTable() {
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
      orario_apertura text NOT NULL DEFAULT '19:00',
      orario_chiusura text NOT NULL DEFAULT '22:30',
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
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS orario_apertura text NOT NULL DEFAULT '19:00'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS orario_chiusura text NOT NULL DEFAULT '22:30'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS note text`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now()`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now()`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_apertura DROP DEFAULT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_chiusura DROP DEFAULT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_apertura TYPE text USING COALESCE(substring(orario_apertura::text from '([0-9]{2}:[0-9]{2})'), '19:00')`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_chiusura TYPE text USING COALESCE(substring(orario_chiusura::text from '([0-9]{2}:[0-9]{2})'), '22:30')`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_apertura SET DEFAULT '19:00'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN orario_chiusura SET DEFAULT '22:30'`);
  await prisma.$executeRawUnsafe(`UPDATE sedi SET slug = lower(regexp_replace(nome || '-' || citta, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL OR trim(slug) = ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE sedi ALTER COLUMN slug SET NOT NULL`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS sedi_slug_key ON sedi(slug)`);
}

async function setupFiliali() {
  await ensureSediTable();

  const results = [];

  for (const filiale of filiali) {
    const existing = await prisma.sede.findFirst({
      where: {
        OR: [
          { slug: { in: filiale.aliases } },
          { nome: { equals: filiale.nome, mode: "insensitive" } },
          { indirizzo: { equals: filiale.indirizzo, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    const data = {
      nome: filiale.nome,
      indirizzo: filiale.indirizzo,
      citta: filiale.citta,
      telefono: filiale.telefono,
      email: filiale.email,
      slug: filiale.slug,
      attiva: true,
      orarioApertura: "19:00",
      orarioChiusura: "22:30",
      note: null,
    };

    if (existing) {
      const updated = await prisma.sede.update({
        where: { id: existing.id },
        data,
      });
      results.push({ action: "updated", id: updated.id, slug: updated.slug, nome: updated.nome });
    } else {
      const created = await prisma.sede.create({
        data: {
          id: randomUUID(),
          ...data,
        },
      });
      results.push({ action: "created", id: created.id, slug: created.slug, nome: created.nome });
    }
  }

  const sedi = await prisma.sede.findMany({
    where: { attiva: true },
    orderBy: { nome: "asc" },
  });

  return { results, count: sedi.length, sedi };
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { ruolo?: string; email?: string } | undefined;

  if (!user || user.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  try {
    return NextResponse.json(await setupFiliali());
  } catch (error) {
    console.error("Errore setup filiali Don Basilico", error);
    return NextResponse.json(
      { error: "Errore durante il setup delle filiali", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
