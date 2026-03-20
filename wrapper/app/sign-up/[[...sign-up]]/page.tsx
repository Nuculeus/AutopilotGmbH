import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="auth-screen">
      <div className="auth-panel">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
          AutopilotGmbH
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
          Konto erstellen
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--soft)]">
          Starte deine Company im Wrapper und leite danach direkt in den
          Provisioning-Flow weiter.
        </p>

        <div className="mt-8">
          <SignUp />
        </div>
      </div>
    </main>
  );
}
