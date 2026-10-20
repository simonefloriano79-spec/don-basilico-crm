import { prisma } from "@/lib/prisma";
import { telefonoTessera } from "@/lib/fedelta";

// Cliente in anagrafica per numero di telefono. Prima il numero identico, poi il confronto sulle ultime 10 cifre
// (nel CRM si trovano sia «+39333…» sia «333…»): senza questo, la stessa persona avrebbe due anagrafiche e l'assistente
// non la riconoscerebbe.
export async function trovaClientePerTelefono(telefono: string) {
  const esatto = await prisma.cliente.findFirst({ where: { telefono } });
  if (esatto) return esatto;

  const tel = telefonoTessera(telefono);
  if (tel.length < 7) return null;
  const righe = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM clienti
    WHERE right(regexp_replace(telefono, '\\D', '', 'g'), 10) = ${tel}
    ORDER BY created_at LIMIT 1`;
  return righe.length ? prisma.cliente.findUnique({ where: { id: righe[0].id } }) : null;
}
