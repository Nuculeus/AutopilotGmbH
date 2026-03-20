import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthControls } from "@/components/auth-controls";
import { LaunchStatusPanel } from "@/components/launch-status-panel";
import type { AppShellModel } from "@/lib/app-shell";

type AppShellProps = {
  model: AppShellModel;
  currentPath: string;
  title: string;
  eyebrow: string;
  description: string;
  children: React.ReactNode;
};

export function AppShell({
  model,
  currentPath,
  title,
  eyebrow,
  description,
  children,
}: AppShellProps) {
  return (
    <main className="app-shell">
      <AppSidebar currentPath={currentPath} navigation={model.navigation} />

      <section className="app-main">
        <header className="app-topbar">
          <Link className="app-toplink" href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Zur Übersicht
          </Link>
          <AuthControls />
        </header>

        <div className="app-main-header">
          <div>
            <p className="app-eyebrow">{eyebrow}</p>
            <h1 className="app-title">{title}</h1>
            <p className="app-description">{description}</p>
          </div>

          {model.access === "blocked" ? (
            <Link className="app-primary-cta" href="/start">
              Provisioning öffnen
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <div className="app-ready-pill">Workspace bereit</div>
          )}
        </div>

        <div className="app-content">
          {model.access === "blocked" ? (
            <section className="app-blocked-state">
              <h2 className="app-blocked-title">Workspace gesperrt</h2>
              <p className="app-blocked-copy">{model.blockedMessage}</p>
            </section>
          ) : (
            children
          )}
        </div>
      </section>

      <LaunchStatusPanel
        checklist={model.checklist}
        companyLabel={model.status.companyLabel}
        creditsLabel={model.status.creditsLabel}
        planLabel={model.status.planLabel}
        provisioningLabel={model.status.provisioningLabel}
      />
    </main>
  );
}
