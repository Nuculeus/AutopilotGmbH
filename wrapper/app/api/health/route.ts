import { NextResponse } from "next/server";
import { getHealthPayload } from "@/lib/readiness";

export function GET() {
  return NextResponse.json(getHealthPayload());
}
