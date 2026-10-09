import { NextRequest, NextResponse } from "next/server";

// Dominio pubblico per i clienti. Su questo dominio si vede SOLO l'ordinazione (e ciò che le serve): il CRM, il login e
// le API del personale non esistono (404). Sugli altri indirizzi (il CRM) tutto resta com'è, ma non va su Google.
const HOST_PUBBLICO = "ordina.donbasilico.it";

const CONSENTITI: RegExp[] = [
  /^\/ordina(\/|$)/,                            // pagine dell'app ordini
  /^\/api\/ordina(\/|$)/,                       // API dell'app ordini (OTP, ordini, tessera…)
  /^\/api\/(sedi|menu|ingredienti|impasti)\/?$/, // elenchi pubblici letti dall'app (le modifiche richiedono comunque il login)
  /^\/(brand|foto-menu|ordina-icons)\//,        // immagini
  /^\/manifest-ordina\.webmanifest$/,
  /^\/sw-ordina\.js$/,
  /^\/(robots\.txt|sitemap\.xml|favicon\.ico)$/,
  /^\/google[0-9a-f]{16}\.html$/,                 // file di verifica di Google Search Console
];

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const percorso = req.nextUrl.pathname;

  if (host !== HOST_PUBBLICO) {
    // Il CRM e gli indirizzi tecnici non devono comparire nei motori di ricerca.
    const risposta = NextResponse.next();
    risposta.headers.set("X-Robots-Tag", "noindex, nofollow");
    return risposta;
  }

  // La home del dominio pubblico è la pagina degli ordini (l'indirizzo resta pulito: ordina.donbasilico.it).
  if (percorso === "/") return NextResponse.rewrite(new URL("/ordina", req.url));

  if (CONSENTITI.some((r) => r.test(percorso))) return NextResponse.next();

  return new NextResponse("Pagina non trovata", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export const config = {
  // Tutto tranne i file interni di Next (che servono alle pagine e non contengono dati).
  matcher: ["/((?!_next/static|_next/image).*)"],
};
