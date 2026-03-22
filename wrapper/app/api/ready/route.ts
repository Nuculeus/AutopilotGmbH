import { NextResponse } from "next/server";
import { getSystemReadiness } from "@/lib/readiness";

export async function GET() {
  return NextResponse.json(await getSystemReadiness());
}
