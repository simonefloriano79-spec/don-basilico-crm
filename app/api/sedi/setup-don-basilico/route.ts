// Questa rotta sostituisce lo script di setup temporaneo creato durante il setup iniziale.
// Le sedi sono già state create — questa rotta è ora disabilitata.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
