import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serializeError(error: unknown) {
  const e = error as any;
  return {
    name: e?.name ?? "Error",
    message: e?.message ?? String(error),
    code: e?.code,
    meta: e?.meta,
  };
}

async function runStep(name: string, fn: () => Promise<unknown>) {
  try {
    const value = await fn();
    return { name, ok: true, value };
  } catch (error) {
    return { name, ok: false, error: serializeError(error) };
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!session || user?.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const steps = [];
  steps.push(await runStep("select_version", () => prisma.$queryRawUnsafe("SELECT version()")));
  steps.push(await runStep("select_current_schema", () => prisma.$queryRawUnsafe("SELECT current_schema()")));
  steps.push(await runStep("table_exists", () => prisma.$queryRawUnsafe("SELECT to_regclass('public.sedi') AS table_name")));
  steps.push(await runStep("create_table", () => prisma.$executeRawUnsafe(`
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
  `)));
  steps.push(await runStep("create_unique_index", () => prisma.$executeRawUnsafe("CREATE UNIQUE INDEX IF NOT EXISTS sedi_slug_key ON sedi(slug)")));
  steps.push(await runStep("prisma_find_many", () => prisma.sede.findMany({ take: 5, orderBy: { nome: "asc" } })));

  return NextResponse.json({ user: { email: user?.email, ruolo: user?.ruolo }, steps });
}
