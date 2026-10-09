import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BASE = "https://ordina.donbasilico.it";

// sitemap.xml: home degli ordini, menù, informativa e una pagina per ogni pizzeria attiva (/ordina/<sede>).
export async function GET() {
  const sedi = await prisma.sede.findMany({ where: { attiva: true }, select: { slug: true }, orderBy: { nome: "asc" } }).catch(() => []);
  const url = (percorso: string, priorita: string) => `  <url><loc>${BASE}${percorso}</loc><priority>${priorita}</priority></url>`;
  const voci = [
    url("/", "1.0"),
    url("/ordina/menu", "0.9"),
    ...sedi.map((s) => url(`/ordina/${s.slug}`, "0.8")),
    url("/ordina/privacy", "0.2"),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${voci.join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
