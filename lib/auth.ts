import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const utente = await prisma.utente.findUnique({
          where: { email: credentials.email },
          include: { sede: true },
        });

        if (!utente || !utente.attivo) return null;

        const passwordValida = verifyPassword(credentials.password, utente.passwordHash);
        if (!passwordValida) return null;

        return {
          id: utente.id,
          email: utente.email,
          name: `${utente.nome} ${utente.cognome}`,
          ruolo: utente.ruolo,
          sedeId: utente.sedeId,
          sedeNome: utente.sede?.nome ?? null,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).ruolo = token.ruolo;
        (session.user as any).sedeId = token.sedeId;
        (session.user as any).sedeNome = token.sedeNome;
      }
      return session;
    },
  },
};
