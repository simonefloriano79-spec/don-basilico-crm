// Chi può vedere quali clienti. Il super admin vede tutta la catena. Gli account delle sedi vedono solo:
//  - i clienti che hanno già ordinato nella propria sede (un cliente che ordina a Marconi oggi e a Montesilvano domani
//    risulta cliente di entrambe le sedi, ognuna vede solo i propri ordini);
//  - un cliente di un'altra sede solo se si scrive il suo numero di telefono COMPLETO (serve a prendere un ordine al
//    telefono da chi non ha mai ordinato lì). Da quel momento, con il primo ordine, diventa cliente anche di questa sede.

// Varianti con cui il numero può essere salvato (con o senza prefisso +39). Vuoto se `q` non è un numero completo.
export function telefoniEsatti(q: string | null | undefined): string[] {
  if (!q) return [];
  const pulito = q.replace(/[\s.\-()]/g, "");
  const cifre = pulito.replace(/^\+/, "").replace(/^0039/, "").replace(/^39(?=\d{9,10}$)/, "");
  if (!/^\d{9,11}$/.test(cifre)) return [];
  return Array.from(new Set([cifre, `+39${cifre}`, `39${cifre}`, pulito]));
}

// Condizione Prisma di visibilità sui clienti per un utente (nessun filtro per il super admin).
export function filtroClientiVisibili(user: { ruolo?: string; sedeId?: string | null }, q: string | null | undefined) {
  if (user.ruolo === "super_admin") return {};
  const varianti = telefoniEsatti(q);
  return {
    OR: [
      { ordini: { some: { sedeId: user.sedeId ?? "-" } } },
      ...(varianti.length ? [{ telefono: { in: varianti } }] : []),
    ],
  };
}
