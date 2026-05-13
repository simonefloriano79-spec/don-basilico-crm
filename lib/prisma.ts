import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getRuntimeDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) return undefined;

  try {
    const url = new URL(databaseUrl);
    const match = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);

    if (match) {
      const projectRef = match[1];
      url.hostname = "aws-1-eu-central-1.pooler.supabase.com";
      url.port = "6543";
      url.username = `postgres.${projectRef}`;
      url.searchParams.delete("pgbouncer");
      url.searchParams.set("sslmode", "require");
      return url.toString();
    }
  } catch {
    return databaseUrl;
  }

  return databaseUrl;
}

const runtimeDatabaseUrl = getRuntimeDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    ...(runtimeDatabaseUrl
      ? {
          datasources: {
            db: {
              url: runtimeDatabaseUrl,
            },
          },
        }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
