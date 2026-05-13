import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getSupabaseProjectRef(value?: string) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const directHostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (directHostMatch) return directHostMatch[1];

    const usernameMatch = decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]+)$/);
    if (usernameMatch) return usernameMatch[1];
  } catch {
    return null;
  }

  return null;
}

function getRuntimeDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) return undefined;

  try {
    const url = new URL(databaseUrl);
    const projectRef =
      getSupabaseProjectRef(databaseUrl) || getSupabaseProjectRef(process.env.DIRECT_URL);
    const isSupabaseDirectHost = /^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname);
    const isSupabasePoolerHost = url.hostname.endsWith(".pooler.supabase.com");

    if (projectRef && (isSupabaseDirectHost || isSupabasePoolerHost)) {
      url.hostname = "aws-1-eu-central-1.pooler.supabase.com";
      url.port = "6543";
      url.username = `postgres.${projectRef}`;
      url.searchParams.set("pgbouncer", "true");
      url.searchParams.set("connection_limit", "1");
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
