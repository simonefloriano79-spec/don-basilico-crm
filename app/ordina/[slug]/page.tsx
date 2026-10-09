import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import OrdinaFlow from "../OrdinaFlow";

const BASE = "https://ordina.donbasilico.it";

async function caricaSede(slug: string) {
  return prisma.sede
    .findFirst({ where: { slug, attiva: true }, select: { nome: true, slug: true, indirizzo: true, citta: true, telefono: true, orarioApertura: true, orarioChiusura: true } })
    .catch(() => null);
}

// Una pagina per ogni pizzeria (/ordina/pescara-centro…): titolo e descrizione con il nome e l'indirizzo, utile per Google
// e per il link «Ordina» della scheda Google Business di quella sede.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const sede = await caricaSede(params.slug);
  if (!sede) return { robots: { index: false, follow: false } };
  return {
    title: `Ordina online da ${sede.nome}`,
    description: `Ordina la pizza da ${sede.nome} (${sede.indirizzo}, ${sede.citta}): ritiro in sede o consegna a domicilio.`,
    alternates: { canonical: `/ordina/${sede.slug}` },
    openGraph: { title: `Ordina online da ${sede.nome}`, description: `${sede.indirizzo}, ${sede.citta}. Ritiro in sede o consegna a domicilio.` },
  };
}

export default async function OrdinaSedePage({ params }: { params: { slug: string } }) {
  const sede = await caricaSede(params.slug);
  // Dati strutturati per Google: la pizzeria, dove si trova, gli orari e il link per ordinare.
  const datiStrutturati = sede
    ? {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        name: sede.nome,
        servesCuisine: "Pizza",
        url: `${BASE}/ordina/${sede.slug}`,
        hasMenu: `${BASE}/ordina/menu`,
        address: { "@type": "PostalAddress", streetAddress: sede.indirizzo, addressLocality: sede.citta, addressCountry: "IT" },
        ...(sede.telefono ? { telephone: sede.telefono } : {}),
        openingHours: `Mo-Su ${sede.orarioApertura}-${sede.orarioChiusura}`,
        potentialAction: {
          "@type": "OrderAction",
          target: { "@type": "EntryPoint", urlTemplate: `${BASE}/ordina/${sede.slug}`, actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"] },
          deliveryMethod: ["http://purl.org/goodrelations/v1#DeliveryModeOwnPickup", "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"],
        },
      }
    : null;
  return (
    <>
      {datiStrutturati && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datiStrutturati) }} />}
      <OrdinaFlow sedeSlugIniziale={params.slug} />
    </>
  );
}
