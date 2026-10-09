import ConsultaMenu from "./ConsultaMenu";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Il nostro menù — Don Basilico",
  description: "Il menù di Don Basilico: pizze speciali, rosse e bianche, calzoni, focacce, fritti artigianali e bevande. Con allergeni e impasti.",
  alternates: { canonical: "/ordina/menu" },
};

export default function MenuPage() {
  return <ConsultaMenu />;
}
