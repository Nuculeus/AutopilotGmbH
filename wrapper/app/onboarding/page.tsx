import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuthControls } from "@/components/auth-controls";
import { GuidedOnboardingForm } from "@/components/guided-onboarding-form";
import { getCurrentUserState } from "@/lib/current-user";

const onboardingBenefits = [
  "Du startest mit einer offenen Idee statt mit einer engen Firmen-Schablone.",
  "Wir übersetzen deinen Gedanken direkt in ein arbeitsfähiges Briefing.",
  "Provisioning und Workspace starten erst, wenn die Richtung klar genug ist.",
];

export default async function OnboardingPage() {
  const state = await getCurrentUserState();

  if (!state.userId) {
    redirect("/sign-in?redirect_url=%2Fonboarding");
  }

  if (
    state.hasCompanyHqBriefing ||
    state.autopilotState.companyId ||
    state.autopilotState.provisioningStatus !== "not_started"
  ) {
    redirect("/launch");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link className="nav-link" href="/">
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
          <AuthControls />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
          Guided Onboarding
        </p>
      </div>

      <section className="grid gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <GuidedOnboardingForm initialProfile={state.companyHqProfile} />
        </div>

        <aside className="panel-shell">
          <div className="panel-header">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Warum zuerst das?
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                Erst Klarheit, dann Provisioning
              </h2>
            </div>
          </div>

          <p className="text-sm leading-7 text-[var(--soft)]">
            Diese Schicht sorgt dafür, dass Credits, Provisioning und Workspace
            auf einem klaren Kern aufbauen statt auf einer halben Idee.
          </p>

          <div className="mt-6 space-y-4">
            {onboardingBenefits.map((benefit, index) => (
              <div key={benefit} className="milestone-row">
                <span className="milestone-index">0{index + 1}</span>
                <p className="text-sm leading-7 text-[var(--soft)]">{benefit}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
