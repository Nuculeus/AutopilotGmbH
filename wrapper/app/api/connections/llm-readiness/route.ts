import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import { assessLlmReadiness } from "@/lib/llm-readiness";
import { canTargetCompany, listCompanyAgents } from "@/lib/paperclip-admin";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const autopilotState = summarizeAutopilotState(user.publicMetadata, userId);

  if (!canTargetCompany(autopilotState)) {
    return NextResponse.json(
      {
        status: "blocked",
        summary:
          "Workspace ist noch nicht freigeschaltet. Bitte Provisioning abschließen, bevor du den LLM-Check startest.",
        probedAdapterType: null,
      },
      { status: 409 },
    );
  }

  const agents = await listCompanyAgents({
    companyId: autopilotState.companyId,
    bridgePrincipalId: autopilotState.bridgePrincipalId,
  });
  const readiness = await assessLlmReadiness({
    companyId: autopilotState.companyId,
    bridgePrincipalId: autopilotState.bridgePrincipalId,
    agents,
  });

  return NextResponse.json(readiness);
}
