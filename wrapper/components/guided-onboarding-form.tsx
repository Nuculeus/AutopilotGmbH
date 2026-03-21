"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  hasStoredCompanyHqBriefing,
  type CompanyHqProfile,
} from "@/lib/company-hq";
import { companyHqSetupSections } from "@/lib/guided-launch";

type GuidedOnboardingFormProps = {
  initialProfile: CompanyHqProfile;
};

export function GuidedOnboardingForm({
  initialProfile,
}: GuidedOnboardingFormProps) {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function updateField(key: keyof CompanyHqProfile, value: string) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleDraft() {
    if (!idea.trim()) {
      setMessage("Beschreibe zuerst kurz, was du aufbauen möchtest.");
      return;
    }

    setMessage(null);
    setIsDrafting(true);

    try {
      const response = await fetch("/api/company-hq/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idea }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Der Vorschlag konnte nicht erstellt werden.",
        );
      }

      setProfile((current) => ({
        ...current,
        ...data.profile,
      }));
      setMessage(
        data.mode === "openai"
          ? "Vorschlag erstellt. Passe alles an, bis es sich nach deiner Richtung anfühlt."
          : "Grundstruktur vorbereitet. Du kannst sie jetzt direkt schärfen und übernehmen.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Der Vorschlag konnte nicht erstellt werden.",
      );
    } finally {
      setIsDrafting(false);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasStoredCompanyHqBriefing(profile)) {
      setMessage(
        "Bitte fülle mindestens Ziel, Angebot, Zielgruppe und Prioritäten aus, bevor du weitergehst.",
      );
      return;
    }

    setMessage(null);
    setIsSaving(true);

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
            : "Das Aufbauprofil konnte nicht gespeichert werden.",
        );
      }

      setProfile(data.profile as CompanyHqProfile);
      router.push("/start");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Das Aufbauprofil konnte nicht gespeichert werden.",
      );
      setIsSaving(false);
    }
  }

  return (
    <form className="guided-onboarding-stack" onSubmit={handleSave}>
      <section className="app-focus-card">
        <p className="app-surface-eyebrow">Geführter Start</p>
        <h1 className="app-surface-title app-onboarding-title">
          Was möchtest du aufbauen?
        </h1>
        <p className="app-surface-copy app-onboarding-copy">
          Beschreibe in 1-3 Sätzen, was entstehen soll, für wen es gedacht ist
          und was es leisten soll.
        </p>

        <div className="guided-onboarding-idea-box">
          <textarea
            className="guided-onboarding-idea"
            onChange={(event) => setIdea(event.target.value)}
            placeholder="Zum Beispiel: Ich möchte einen deutschsprachigen YouTube-Kanal für KI-Automation aufbauen, der regionale Unternehmen gewinnt und daraus ein Servicegeschäft entwickelt."
            rows={5}
            value={idea}
          />
        </div>

        <div className="guided-action-row">
          <button
            className="app-primary-cta"
            disabled={isDrafting}
            onClick={handleDraft}
            type="button"
          >
            {isDrafting ? "Vorschlag wird erstellt..." : "Struktur ableiten"}
          </button>
          <span className="app-soft text-sm">
            Du kannst alles danach direkt anpassen.
          </span>
        </div>
      </section>

      <section className="guided-grid">
        {companyHqSetupSections.map((section) => (
          <label key={section.field} className="guided-field guided-card">
            <p className="app-surface-eyebrow">Briefing</p>
            <span className="guided-title">{section.title}</span>
            <span className="guided-prompt">{section.prompt}</span>
            <span className="guided-helper">{section.helper}</span>
            <textarea
              onChange={(event) => updateField(section.field, event.target.value)}
              rows={section.field === "priorities" ? 4 : 3}
              value={profile[section.field]}
            />
          </label>
        ))}
      </section>

      <div className="guided-form-actions">
        <button className="app-primary-cta" disabled={isSaving} type="submit">
          {isSaving ? "Wird gespeichert..." : "Profil übernehmen und weiter"}
        </button>
        {message ? <p className="app-soft text-sm">{message}</p> : null}
      </div>
    </form>
  );
}
