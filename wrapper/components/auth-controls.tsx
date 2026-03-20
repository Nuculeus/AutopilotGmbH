import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export async function AuthControls() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="flex items-center gap-3">
        <Link className="nav-link" href="/sign-in">
          Einloggen
        </Link>
        <Link className="primary-cta" href="/sign-up">
          Konto erstellen
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link className="nav-link" href="/dashboard">
        Mein Dashboard
      </Link>
      <div className="user-chip">
        <UserButton />
      </div>
    </div>
  );
}
