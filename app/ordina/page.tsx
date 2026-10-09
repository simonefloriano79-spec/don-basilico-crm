import OrdinaFlow from "./OrdinaFlow";

// ?modo=domicilio|asporto: arrivando dal menù da consultare si salta la scelta nella home e si entra direttamente
// nel percorso (indirizzo di consegna, oppure scelta della pizzeria per il ritiro).
export default function OrdinaPage({ searchParams }: { searchParams: { modo?: string } }) {
  const modo = searchParams.modo === "domicilio" || searchParams.modo === "asporto" ? searchParams.modo : undefined;
  return <OrdinaFlow modoIniziale={modo} />;
}
