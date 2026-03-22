"use client";

import { startTransition, useState } from "react";
import type { CompanyHqProfile } from "@/lib/company-hq";
import { revenueTrackOptions } from "@/lib/guided-launch";
import { getRequiredConnectionLabel, type RevenueTrack } from "@/lib/revenue-track";

type CompanyHqFormProps = {
  initialProfile: CompanyHqProfile;
};

export function CompanyHqForm({ initialProfile }: CompanyHqFormProps) {
  const defaultTrack = revenueTrackOptions[0];
  const [profile, setProfile] = useState<CompanyHqProfile>({
    ...initialProfile,
    revenueTrack: initialProfile.revenueTrack ?? defaultTrack.id,
    valueModel: initialProfile.valueModel || defaultTrack.valueModel,
    requiredConnections:
      initialProfile.requiredConnections.length > 0
        ? initialProfile.requiredConnections
        : defaultTrack.requiredConnections,
    nextMilestone: initialProfile.nextMilestone ?? "briefing_ready",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function updateField(
    key: "companyGoal" | "offer" | "audience" | "tone" | "priorities" | "valueModel",
    value: string,
  ) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyRevenueTrack(track: RevenueTrack) {
    const option = revenueTrackOptions.find((entry) => entry.id === track);
    if (!option) return;

    setProfile((current) => ({
      ...current,
      revenueTrack: track,
      valueModel: option.valueModel,
      requiredConnections: option.requiredConnections,
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
            revenueTrack: profile.revenueTrack,
            valueModel: profile.valueModel,
            requiredConnections: profile.requiredConnections,
            nextMilestone: profile.nextMilestone,
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
        <label className="guided-field guided-field-wide">
          <span>Primärer Revenue-Track</span>
          <select
            onChange={(event) => applyRevenueTrack(event.target.value as RevenueTrack)}
            value={profile.revenueTrack ?? "service_business"}
          >
            {revenueTrackOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="guided-field guided-field-wide">
          <span>Monetarisierungsmodell</span>
          <textarea
            onChange={(event) => updateField("valueModel", event.target.value)}
            rows={3}
            value={profile.valueModel}
          />
        </label>
        <div className="guided-field guided-field-wide">
          <span>Pflichtverbindungen</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.requiredConnections.map((connection) => (
              <span key={connection} className="workspace-launch-link">
                {getRequiredConnectionLabel(connection)}
              </span>
            ))}
          </div>
        </div>
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
