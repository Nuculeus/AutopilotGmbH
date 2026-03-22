import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getRunForUser } from "@/lib/run-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const run = await getRunForUser({
    clerkUserId: userId,
    runId: id,
  });

  if (!run) {
    return NextResponse.json({ error: "Run nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(run);
}
