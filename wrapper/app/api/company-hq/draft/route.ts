import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateCompanyHqDraft } from "@/lib/company-hq-draft";

function readIdea(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "";
  }

  const value = (body as Record<string, unknown>).idea;
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const idea = readIdea(body);

  if (!idea) {
    return NextResponse.json(
      { error: "Bitte beschreibe kurz, was du aufbauen möchtest." },
      { status: 400 },
    );
  }

  const draft = await generateCompanyHqDraft(idea);
  return NextResponse.json(draft);
}
