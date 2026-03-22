type ReadinessStatus = "ready" | "degraded" | "missing";

type ReadinessCheck = {
  status: ReadinessStatus;
  detail: string;
};

function resolveVersion() {
  return process.env.npm_package_version?.trim() || "0.1.0";
}

function hasNonEmptyEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function getHealthPayload() {
  return {
    ok: true,
    version: resolveVersion(),
    timestamp: new Date().toISOString(),
  };
}

function readinessFromPresence(input: {
  present: boolean;
  readyDetail: string;
  missingDetail: string;
}): ReadinessCheck {
  return input.present
    ? { status: "ready", detail: input.readyDetail }
    : { status: "missing", detail: input.missingDetail };
}

export async function getSystemReadiness() {
  const db = readinessFromPresence({
    present: hasNonEmptyEnv("DATABASE_URL"),
    readyDetail: "database configured",
    missingDetail: "missing DATABASE_URL",
  });
  const secretStore = readinessFromPresence({
    present: hasNonEmptyEnv("INTERNAL_BRIDGE_SECRET"),
    readyDetail: "bridge secret configured",
    missingDetail: "missing INTERNAL_BRIDGE_SECRET",
  });
  const stripe = readinessFromPresence({
    present: hasNonEmptyEnv("STRIPE_SECRET_KEY"),
    readyDetail: "stripe key configured",
    missingDetail: "missing STRIPE_SECRET_KEY",
  });

  const paperclipConfigured =
    hasNonEmptyEnv("PAPERCLIP_INTERNAL_URL") || hasNonEmptyEnv("PAPERCLIP_API_URL");
  const paperclip = paperclipConfigured
    ? secretStore.status === "ready"
      ? { status: "ready" as const, detail: "paperclip bridge configured" }
      : { status: "degraded" as const, detail: "paperclip url configured but bridge secret missing" }
    : { status: "missing" as const, detail: "missing PAPERCLIP_INTERNAL_URL" };

  return {
    ok:
      db.status === "ready" &&
      paperclip.status === "ready" &&
      stripe.status === "ready" &&
      secretStore.status === "ready",
    version: resolveVersion(),
    timestamp: new Date().toISOString(),
    db,
    paperclip,
    stripe,
    secretStore,
  };
}
