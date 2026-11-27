// Quanto si paga per le aggiunte di una pizza (puro: lo usano cassa, app clienti e calcolo del server).
// Il risultato è per una pizza normale: per la maxi lo moltiplica chi chiama.
//
// - Togliere un ingrediente non sconta mai da solo: «copre» fino al suo valore le aggiunte. Quelli esclusi dalla
//   compensazione (spunta nella pagina Ingredienti: mozzarella e pomodoro) non coprono niente.
// - Cambio di mozzarella: tolta la bufala della pizza e messa un'altra mozzarella, è una sostituzione. Non si paga e
//   NON resta credito per altre aggiunte (si pagherebbe solo la differenza se la nuova costasse più della bufala).

// Riconosciute dal nome: se si rinomina uno di questi ingredienti, aggiornare anche qui.
const BUFALA = "mozzarella di bufala";
const AL_POSTO_DELLA_BUFALA = ["mozzarella", "mozzarella a fette", "no lattosio"];

type Prezzo = number | string | { toString(): string };
export interface VoceIngrediente { nome: string; prezzoAggiunta?: Prezzo | null; escludiCompensazione?: boolean }

const chiave = (v: VoceIngrediente) => v.nome.trim().toLowerCase();
const valore = (v: VoceIngrediente) => Number(v.prezzoAggiunta?.toString() ?? 0) || 0;

export function prezzoAggiunte(aggiunti: VoceIngrediente[], tolti: VoceIngrediente[]) {
  const restanti = [...aggiunti];
  const rimossi = [...tolti];
  let differenza = 0;
  let sostituzione = false;

  const iBufala = rimossi.findIndex((v) => chiave(v) === BUFALA);
  if (iBufala >= 0) {
    // Se ne sono state aggiunte due, fa da sostituta la più cara (a favore del cliente).
    const sostituta = restanti
      .filter((v) => AL_POSTO_DELLA_BUFALA.includes(chiave(v)))
      .sort((a, b) => valore(b) - valore(a))[0];
    if (sostituta) {
      differenza = Math.max(0, valore(sostituta) - valore(rimossi[iBufala]));
      restanti.splice(restanti.indexOf(sostituta), 1);
      rimossi.splice(iBufala, 1);
      sostituzione = true;
    }
  }

  const lordo = restanti.reduce((a, v) => a + valore(v), 0);
  const credito = rimossi.filter((v) => !v.escludiCompensazione).reduce((a, v) => a + valore(v), 0);
  return { supplemento: differenza + Math.max(0, lordo - credito), credito, sostituzione };
}
