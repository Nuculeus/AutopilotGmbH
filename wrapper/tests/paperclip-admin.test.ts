import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listCompanyAgents } from "@/lib/paperclip-admin";

describe("paperclip admin bridge headers", () => {
  const previousSecret = process.env.INTERNAL_BRIDGE_SECRET;
  const previousInternalUrl = process.env.PAPERCLIP_INTERNAL_URL;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.INTERNAL_BRIDGE_SECRET = "test-internal-secret";
    process.env.PAPERCLIP_INTERNAL_URL = "http://paperclip:3100";
  });

  afterEach(() => {
    process.env.INTERNAL_BRIDGE_SECRET = previousSecret;
    process.env.PAPERCLIP_INTERNAL_URL = previousInternalUrl;
    vi.unstubAllGlobals();
  });

  it("includes trusted origin and internal secret headers for company admin calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listCompanyAgents({
      companyId: "cmp_123",
      bridgePrincipalId: "clerk:user_123",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://paperclip:3100/api/companies/cmp_123/agents");

    const headers = new Headers(init.headers);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("origin")).toBe("http://paperclip:3100");
    expect(headers.get("x-internal-secret")).toBe("test-internal-secret");
    expect(headers.get("x-bridge-principal")).toBe("clerk:user_123");
  });
});
