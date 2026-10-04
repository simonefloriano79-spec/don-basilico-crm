import OrdinaFlow from "../OrdinaFlow";

export default function OrdinaSedePage({ params }: { params: { slug: string } }) {
  return <OrdinaFlow sedeSlugIniziale={params.slug} />;
}
