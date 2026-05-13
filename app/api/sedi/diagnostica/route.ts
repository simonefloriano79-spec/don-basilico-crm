// Questa rotta sostituisce la versione diagnostica temporanea creata durante il setup.
// In produzione restituisce solo 404 — la diagnostica non è necessaria dopo il setup iniziale.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
