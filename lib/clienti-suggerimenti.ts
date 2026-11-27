// Elenco che si restringe mentre si scrive in cassa (domicilio): prima i clienti che INIZIANO con quello che si è scritto,
// poi quelli che lo contengono. La visibilità per sede è la stessa della pagina Clienti.
import { prisma } from "@/lib/prisma";
import { filtroClientiVisibili, telefoniEsatti } from "@/lib/clienti-visibilita";

const MASSIMO = 8;
const CAMPI = { id: true, nome: true, cognome: true, telefono: true, indirizzoDefault: true, note: true };

export async function suggerimentiClienti(user: { ruolo?: string; sedeId?: string | null }, q: string | null, campo: string) {
  const scritto = (q ?? "").trim();
  const testo = campo === "telefono" ? scritto.replace(/\D/g, "") : scritto;
  if (testo.length < (campo === "telefono" ? 3 : 2)) return [];

  const inizia = { startsWith: testo, mode: "insensitive" as const };
  const contiene = { contains: testo, mode: "insensitive" as const };
  const giri =
    campo === "telefono"
      ? [{ OR: [{ telefono: { startsWith: testo } }, { telefono: { in: telefoniEsatti(testo) } }] }, { telefono: { contains: testo } }]
      : campo === "indirizzo"
        ? [{ indirizzoDefault: inizia }, { indirizzoDefault: contiene }]
        : [{ OR: [{ nome: inizia }, { cognome: inizia }] }, { OR: [{ nome: contiene }, { cognome: contiene }] }];

  const visibili = filtroClientiVisibili(user, testo);
  const trovati: { id: string }[] = [];
  for (const condizione of giri) {
    if (trovati.length >= MASSIMO) break;
    trovati.push(...(await prisma.cliente.findMany({
      where: { AND: [visibili, condizione, { id: { notIn: trovati.map((c) => c.id) } }] },
      select: CAMPI,
      orderBy: { nome: "asc" },
      take: MASSIMO - trovati.length,
    })));
  }
  return trovati;
}
