"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import type { PaperclipCompanySecret, PaperclipSecretProvider } from "@/lib/paperclip-bridge";
import { priorityConnectionTemplates } from "@/lib/guided-launch";

type ConnectionsManagerProps = {
  providers: PaperclipSecretProvider[];
  initialSecrets: PaperclipCompanySecret[];
  initialPresetId?: string | null;
};

type LlmReadinessPayload = {
  status: "ready" | "warning" | "blocked";
  summary: string;
  probedAdapterType: string | null;
  checkedAt?: string;
};

export function ConnectionsManager({
  providers,
  initialSecrets,
  initialPresetId = null,
}: ConnectionsManagerProps) {
  const [secrets, setSecrets] = useState(initialSecrets);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState(providers[0]?.id ?? "local_encrypted");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isCheckingReadiness, setIsCheckingReadiness] = useState(false);
  const [readiness, setReadiness] = useState<LlmReadinessPayload | null>(null);

  const providerOptions = useMemo(
    () => providers.map((entry) => ({ value: entry.id, label: entry.label })),
    [providers],
  );

  useEffect(() => {
    if (!initialPresetId) return;
    const preset = priorityConnectionTemplates.find((item) => item.id === initialPresetId);
    if (!preset) return;

    setName(preset.presetName);
    setDescription(preset.description);
    const providerMatch = providers.find((entry) => entry.id === preset.providerHint);
    if (providerMatch) {
      setProvider(providerMatch.id);
    }
  }, [initialPresetId, providers]);

  async function runReadinessCheck(options?: { silent?: boolean }) {
    setIsCheckingReadiness(true);

    try {
      const response = await fetch("/api/connections/llm-readiness", {
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as
        | LlmReadinessPayload
        | { error?: string; summary?: string }
        | null;

      if (!response.ok) {
        const summaryFromPayload =
          typeof data === "object" &&
          data !== null &&
          "summary" in data &&
          typeof data.summary === "string"
            ? data.summary
            : null;
        const errorFromPayload =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : null;
        const fallbackSummary =
          summaryFromPayload ||
          errorFromPayload ||
          "LLM-Check konnte nicht abgeschlossen werden.";

        setReadiness({
          status: "blocked",
          summary: fallbackSummary,
          probedAdapterType: null,
        });

        if (!options?.silent) {
          setMessage(fallbackSummary);
        }

        return;
      }

      const payload = data as LlmReadinessPayload;
      setReadiness(payload);
      if (!options?.silent) {
        setMessage(payload.summary);
      }
    } catch {
      const fallback = "LLM-Check konnte nicht abgeschlossen werden.";
      setReadiness({
        status: "blocked",
        summary: fallback,
        probedAdapterType: null,
      });
      if (!options?.silent) {
        setMessage(fallback);
      }
    } finally {
      setIsCheckingReadiness(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsPending(true);

    startTransition(async () => {
      try {
        const response = await fetch("/api/paperclip/secrets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            value,
            description: description || null,
            provider,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : "Secret konnte nicht gespeichert werden.",
          );
        }

        setSecrets((current) => [data as PaperclipCompanySecret, ...current]);
        setName("");
        setValue("");
        setDescription("");
        setMessage("Verbindung gespeichert. Der Key liegt jetzt company-scoped in Paperclip.");
        await runReadinessCheck({ silent: true });
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Verbindung konnte nicht gespeichert werden.",
        );
      } finally {
        setIsPending(false);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <article className="app-surface-card">
          <p className="app-surface-eyebrow">Empfehlung</p>
          <h3 className="app-surface-title">Zuerst Modellzugang verbinden</h3>
          <p className="app-surface-copy">
            Ohne OpenAI, Anthropic oder Gemini kann dein CEO nicht arbeiten.
            Verbinde deshalb zuerst den LLM-Zugang und erst danach weitere
            Werkzeuge wie Stripe, YouTube oder Analytics.
          </p>
        </article>
        <article className="app-surface-card">
          <p className="app-surface-eyebrow">Live</p>
          <h3 className="app-surface-title">{secrets.length} Secrets verbunden</h3>
          <p className="app-surface-copy">
            Die gespeicherten Verbindungen sind company-scoped und werden über
            den kontrollierten Wrapper-Bridge-Pfad angelegt.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              className="workspace-launch-link"
              disabled={isCheckingReadiness}
              onClick={() => {
                void runReadinessCheck();
              }}
              type="button"
            >
              {isCheckingReadiness ? "LLM-Check läuft..." : "LLM-Readiness prüfen"}
            </button>
            {readiness ? (
              <span className="app-muted text-xs">
                {readiness.status === "ready"
                  ? "bereit"
                  : readiness.status === "warning"
                    ? "mit Hinweis"
                    : "blockiert"}
              </span>
            ) : null}
          </div>
          {readiness ? (
            <p className="app-soft mt-3 text-sm">
              {readiness.summary}
            </p>
          ) : null}
        </article>
      </div>

      <section className="app-surface-card" id="connect-form">
        <p className="app-surface-eyebrow">Neue Verbindung</p>
        <h3 className="app-surface-title">API-Key oder Secret hinterlegen</h3>
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm text-white">
            Secret-Name
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => setName(event.target.value)}
              placeholder="z. B. anthropic_api_key"
              required
              value={name}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-white">
            Provider
            <select
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => setProvider(event.target.value)}
              value={provider}
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-white md:col-span-2">
            Beschreibung
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Wofür soll dieser Zugang genutzt werden?"
              value={description}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-white md:col-span-2">
            Secret-Wert
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => setValue(event.target.value)}
              placeholder="sk-..., ghp_..., youtube-key ..."
              required
              type="password"
              value={value}
            />
          </label>
          <div className="md:col-span-2 flex items-center gap-3">
            <button className="app-primary-cta" disabled={isPending} type="submit">
              {isPending ? "Wird gespeichert..." : "Verbindung speichern"}
            </button>
            {message ? <p className="app-muted text-sm">{message}</p> : null}
          </div>
        </form>
      </section>

      <section className="app-surface-card">
        <p className="app-surface-eyebrow">Bestehende Verbindungen</p>
        <h3 className="app-surface-title">Company-Scoped Secret Store</h3>
        {secrets.length === 0 ? (
          <p className="app-surface-copy mt-4">
            Noch keine Keys verbunden. Für den Launch ist das genau der Ort, an
            dem Kunden ihre eigenen Tool-Zugänge hinterlegen.
          </p>
        ) : (
          <div className="mt-6 grid gap-3">
            {secrets.map((secret) => (
              <div
                key={secret.id}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm text-white">{secret.name}</strong>
                  <span className="app-muted text-xs uppercase tracking-[0.2em]">
                    {secret.provider}
                  </span>
                </div>
                <p className="app-soft mt-2 text-sm">
                  {secret.description ?? "Keine Beschreibung hinterlegt."}
                </p>
                <p className="app-muted mt-2 text-xs">
                  Version {secret.latestVersion}
                  {secret.externalRef ? ` · ${secret.externalRef}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
