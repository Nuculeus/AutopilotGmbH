type ClerkLikeUser = {
  id: string;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: Array<{ emailAddress?: string | null }>;
  privateMetadata?: Record<string, unknown> | null;
};

function parseCsvSet(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function readUserEmail(user: ClerkLikeUser) {
  const primary = user.primaryEmailAddress?.emailAddress;
  if (typeof primary === "string" && primary.trim().length > 0) {
    return primary.trim().toLowerCase();
  }

  const first = user.emailAddresses?.find(
    (entry) => typeof entry.emailAddress === "string" && entry.emailAddress.trim().length > 0,
  )?.emailAddress;

  return typeof first === "string" ? first.trim().toLowerCase() : null;
}

function isEnabled() {
  return process.env.AUTOPILOT_ENABLE_ADMIN_BILLING_BYPASS === "true";
}

function hasMetadataBypass(user: ClerkLikeUser) {
  const raw = user.privateMetadata?.autopilotBillingBypass;
  if (raw === true) return true;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return (raw as Record<string, unknown>).enabled === true;
}

export function hasAdminBillingBypass(user: ClerkLikeUser) {
  if (!isEnabled()) {
    return false;
  }

  if (hasMetadataBypass(user)) {
    return true;
  }

  const allowedUserIds = parseCsvSet(process.env.AUTOPILOT_ADMIN_USER_IDS);
  if (allowedUserIds.has(user.id.toLowerCase())) {
    return true;
  }

  const allowedEmails = parseCsvSet(process.env.AUTOPILOT_ADMIN_EMAILS);
  const email = readUserEmail(user);
  return Boolean(email && allowedEmails.has(email));
}
