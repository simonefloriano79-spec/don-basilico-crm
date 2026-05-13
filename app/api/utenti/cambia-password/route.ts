import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST /api/utenti/cambia-password
// Permette a chiunque di cambiare la propria password, o all'admin di cambiarla per altri
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const currentUser = session.user as any;
  const { targetEmail, nuovaPassword, vecchiaPassword } = await req.json();

  if (!nuovaPassword || nuovaPassword.length < 8) {
    return NextResponse.json({ error: "Password troppo corta (min 8 caratteri)" }, { status: 400 });
  }

  const emailTarget = targetEmail ?? currentUser.email;

  // Solo super_admin può cambiare la password di altri
  if (emailTarget !== currentUser.email && currentUser.ruolo !== "super_admin") {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const utente = await prisma.utente.findUnique({ where: { email: emailTarget } });
  if (!utente) return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });

  // Se l'utente cambia la propria password, verifica la vecchia (salvo admin)
  if (emailTarget === currentUser.email && currentUser.ruolo !== "super_admin") {
    if (!vecchiaPassword) {
      return NextResponse.json({ error: "Vecchia password richiesta" }, { status: 400 });
    }
    if (!utente.passwordHash) {
      return NextResponse.json({ error: "Nessuna password impostata" }, { status: 400 });
    }
    const ok = await bcrypt.compare(vecchiaPassword, utente.passwordHash);
    if (!ok) return NextResponse.json({ error: "Vecchia password errata" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(nuovaPassword, 12);
  await prisma.utente.update({ where: { email: emailTarget }, data: { passwordHash } });

  return NextResponse.json({ ok: true, message: "Password aggiornata con successo" });
}
