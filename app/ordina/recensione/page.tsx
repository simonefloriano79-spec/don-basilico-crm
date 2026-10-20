import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { linkRecensione } from "@/lib/recensioni";
import ElencoRecensioni from "./ElencoRecensioni";

// Pagina del QR «Ti è piaciuta? Dillo a Google»: un solo QR stampato sui cartoni per tutte le pizzerie;
// il cliente sceglie la sua e va alla recensione su Google (link per pizzeria in lib/recensioni.ts).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lascia una recensione — Don Basilico",
  description: "Scegli la pizzeria dove hai mangiato e lascia una recensione su Google.",
  robots: { index: false, follow: true },
};

export default async function PaginaRecensione() {
  const sedi = await prisma.sede
    .findMany({ where: { attiva: true }, orderBy: { nome: "asc" }, select: { id: true, slug: true, nome: true, indirizzo: true, citta: true } })
    .catch(() => []);
  return (
    <ElencoRecensioni
      sedi={sedi.map((s) => ({
        id: s.id,
        nome: s.nome.replace("Don Basilico ", ""),
        indirizzo: `${s.indirizzo}, ${s.citta}`,
        url: linkRecensione(s),
      }))}
    />
  );
}
