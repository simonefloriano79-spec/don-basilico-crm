// Chi può disegnare/modificare la zona di consegna di una sede.
// Il super admin può su tutte. Un «sede manager» può solo sulla propria sede e solo se questa è nell'elenco qui sotto:
// per ora Chieti Scalo, che consegna in un territorio suo, senza sovrapposizioni con altre sedi.
export const SEDI_ZONA_AUTONOMA: string[] = [
  "5147675b-17c9-4924-b938-44388e2e2c52", // Don Basilico Chieti Scalo
];

export function puoModificareZona(user: any, sedeId: string): boolean {
  if (!user) return false;
  if (user.ruolo === "super_admin") return true;
  return user.ruolo === "sede_manager" && !!user.sedeId && user.sedeId === sedeId && SEDI_ZONA_AUTONOMA.includes(sedeId);
}
