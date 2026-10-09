import type { Metadata } from "next";
import OrdinaFlow from "./OrdinaFlow";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const BASE = "https://ordina.donbasilico.it";

// ?modo=domicilio|asporto: arrivando dal menù da consultare si salta la scelta nella home e si entra direttamente
// nel percorso (indirizzo di consegna, oppure scelta della pizzeria per il ritiro).
export default function OrdinaPage({ searchParams }: { searchParams: { modo?: string } }) {
  const modo = searchParams.modo === "domicilio" || searchParams.modo === "asporto" ? searchParams.modo : undefined;
  const datiStrutturati = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Don Basilico",
    legalName: "PITTA S.r.l.",
    url: BASE,
    logo: `${BASE}/ordina-icons/icon-512.png`,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datiStrutturati) }} />
      <OrdinaFlow modoIniziale={modo} />
    </>
  );
}
