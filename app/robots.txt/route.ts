import { NextRequest } from "next/server";

const HOST_PUBBLICO = "ordina.donbasilico.it";

// robots.txt: sul dominio pubblico Google può leggere le pagine degli ordini; su qualsiasi altro indirizzo
// (il CRM, gli indirizzi tecnici di Vercel) non deve indicizzare nulla.
export function GET(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const corpo =
    host === HOST_PUBBLICO
      ? `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /login\n\nSitemap: https://${HOST_PUBBLICO}/sitemap.xml\n`
      : `User-agent: *\nDisallow: /\n`;
  return new Response(corpo, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
