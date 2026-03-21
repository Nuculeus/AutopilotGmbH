"use client";

import { startTransition, useState } from "react";
import type { CompanyHqProfile } from "@/lib/company-hq";

type CompanyHqFormProps = {
  initialProfile: CompanyHqProfile;
};

export function CompanyHqForm({ initialProfile }: CompanyHqFormProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function updateField(key: keyof CompanyHqProfile, value: string) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsPending(true);

    startTransition(async () => {
      try {
        const response = await fetch("/api/company-hq", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyGoal: profile.companyGoal,
            offer: profile.offer,
            audience: profile.audience,
            tone: profile.tone,
            priorities: profile.priorities,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : "Company HQ konnte nicht gespeichert werden.",
          );
        }

        setProfile(data.profile as CompanyHqProfile);
        setMessage("Firmenkern gespeichert. Deine Firma kann jetzt konsistenter arbeiten.");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Company HQ konnte nicht gespeichert werden.",
        );
      } finally {
        setIsPending(false);
      }
    });
  }

  return (
    <section className="app-surface-card">
      <p className="app-surface-eyebrow">Firmenkern</p>
      <h3 className="app-surface-title">Die wichtigsten 5 Grundlagen</h3>
      <form className="guided-form" onSubmit={handleSubmit}>
        <label className="guided-field">
          <span>Unternehmensziel</span>
          <textarea
            onChange={(event) => updateField("companyGoal", event.target.value)}
            rows={3}
            value={profile.companyGoal}
          />
        </label>
        <label className="guided-field">
          <span>Angebot</span>
          <textarea
            onChange={(event) => updateField("offer", event.target.value)}
            rows={3}
            value={profile.offer}
          />
        </label>
        <label className="guided-field">
          <span>Zielgruppe</span>
          <textarea
            onChange={(event) => updateField("audience", event.target.value)}
            rows={3}
            value={profile.audience}
          />
        </label>
        <label className="guided-field">
          <span>Tonalität</span>
          <textarea
            onChange={(event) => updateField("tone", event.target.value)}
            rows={3}
            value={profile.tone}
          />
        </label>
        <label className="guided-field guided-field-wide">
          <span>Prioritäten der nächsten 30 Tage</span>
          <textarea
            onChange={(event) => updateField("priorities", event.target.value)}
            rows={4}
            value={profile.priorities}
          />
        </label>
        <div className="guided-form-actions">
          <button className="app-primary-cta" disabled={isPending} type="submit">
            {isPending ? "Wird gespeichert..." : "Firmenkern speichern"}
          </button>
          {message ? <p className="app-muted text-sm">{message}</p> : null}
        </div>
      </form>
    </section>
  );
}
