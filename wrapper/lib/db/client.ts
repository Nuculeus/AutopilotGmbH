export function resolveControlPlaneDatabaseUrl(value: string | undefined | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
