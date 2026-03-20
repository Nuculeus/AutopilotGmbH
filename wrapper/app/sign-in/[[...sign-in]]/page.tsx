import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="auth-screen">
      <div className="auth-panel">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
          AutopilotGmbH
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
          Einloggen
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--soft)]">
          Zugang zum operativen Wrapper, Billing und Company-Dashboard.
        </p>

        <div className="mt-8">
          <SignIn />
        </div>
      </div>
    </main>
  );
}
