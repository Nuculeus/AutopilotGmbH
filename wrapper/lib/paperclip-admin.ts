type BootstrapCompanyInput = {
  clerkUserId: string;
  name: string;
  idea?: string | null;
};

export type BootstrapCompanyResult = {
  paperclipCompanyId: string;
  companyName: string;
  bridgePrincipalId: string;
  status: "bootstrapped";
};

function getPaperclipInternalUrl() {
  return (
    process.env.PAPERCLIP_INTERNAL_URL?.trim()
    || process.env.PAPERCLIP_API_URL?.trim()
    || "http://paperclip:3100"
  );
}

export async function bootstrapCompany(
  input: BootstrapCompanyInput,
): Promise<BootstrapCompanyResult> {
  const internalSecret = process.env.INTERNAL_BRIDGE_SECRET?.trim();

  if (!internalSecret) {
    throw new Error("Missing INTERNAL_BRIDGE_SECRET");
  }

  const response = await fetch(`${getPaperclipInternalUrl()}/api/internal/bootstrap-company`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": internalSecret,
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Paperclip bootstrap failed with status ${response.status}`,
    );
  }

  return payload as BootstrapCompanyResult;
}
