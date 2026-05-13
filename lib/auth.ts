import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";

const PREVIEW_ADMIN_EMAIL = "admin@donbasilico.it";
const PREVIEW_ADMIN_PASSWORD_HASH = "$2a$12$1M9bJtEjfqk.Ds0OqfvXCuyuJXN9V/7rrraCJscxuh3DvaEX0otHW";

function isPreviewAdminAccessEnabled() {
  return process.env.VERCEL_ENV === "preview";
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const password = credentials.password;

        const utente = await prisma.utente.findUnique({
          where: { email },
          include: { sede: true },
        });

        const passwordOk = utente?.attivo && verifyPassword(password, utente.passwordHash);

        if (utente && passwordOk) {
          return {
            id: utente.id,
            email: utente.email,
            name: `${utente.nome} ${utente.cognome}`,
            ruolo: utente.ruolo,
            sedeId: utente.sedeId,
            sedeNome: utente.sede?.nome ?? null,
          };
        }

        const previewAdminOk =
          isPreviewAdminAccessEnabled() &&
          email === PREVIEW_ADMIN_EMAIL &&
          verifyPassword(password, PREVIEW_ADMIN_PASSWORD_HASH);

        if (!previewAdminOk) return null;

        const [previewAdmin] = await prisma.$queryRaw<
          Array<{
            id: string;
            email: string;
            nome: string;
            cognome: string;
            ruolo: string;
            sede_id: string | null;
          }>
        >`
          INSERT INTO utenti (email, nome, cognome, ruolo, attivo, password_hash, sede_id, created_at, updated_at)
          VALUES (${PREVIEW_ADMIN_EMAIL}, 'Admin', 'Don Basilico', 'super_admin', true, ${PREVIEW_ADMIN_PASSWORD_HASH}, NULL, NOW(), NOW())
          ON CONFLICT (email) DO UPDATE SET
            nome = EXCLUDED.nome,
            cognome = EXCLUDED.cognome,
            ruolo = EXCLUDED.ruolo,
            attivo = EXCLUDED.attivo,
            password_hash = EXCLUDED.password_hash,
            sede_id = EXCLUDED.sede_id,
            updated_at = NOW()
          RETURNING id, email, nome, cognome, ruolo, sede_id
        `;

        return {
          id: previewAdmin.id,
          email: previewAdmin.email,
          name: `${previewAdmin.nome} ${previewAdmin.cognome}`,
          ruolo: previewAdmin.ruolo,
          sedeId: previewAdmin.sede_id,
          sedeNome: null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.ruolo = (user as any).ruolo;
        token.sedeId = (user as any).sedeId;
        token.sedeNome = (user as any).sedeNome;
        token.userId = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId ?? token.sub;
        (session.user as any).ruolo = token.ruolo;
        (session.user as any).sedeId = token.sedeId;
        (session.user as any).sedeNome = token.sedeNome;
      }
      return session;
    },
  },
};
