import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@donbasilico.it";
  const password = process.env.ADMIN_PASSWORD;
  const nome = process.env.ADMIN_NAME ?? "Admin";
  const cognome = process.env.ADMIN_SURNAME ?? "Don Basilico";

  if (!password) {
    throw new Error("ADMIN_PASSWORD è obbligatoria per creare o aggiornare il super_admin.");
  }

  const passwordHash = hashPassword(password);

  const admin = await prisma.utente.upsert({
    where: { email },
    update: {
      nome,
      cognome,
      ruolo: "super_admin",
      passwordHash,
      sedeId: null,
      attivo: true,
    },
    create: {
      email,
      nome,
      cognome,
      ruolo: "super_admin",
      passwordHash,
      sedeId: null,
      attivo: true,
    },
  });

  console.log(`Super admin pronto: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
