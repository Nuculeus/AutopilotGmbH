import Link from "next/link";
import type { AppNavigationItem } from "@/lib/app-shell";

type AppSidebarProps = {
  navigation: AppNavigationItem[];
  currentPath: string;
};

export function AppSidebar({ navigation, currentPath }: AppSidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <p className="app-muted font-mono text-xs uppercase tracking-[0.3em]">
          AutopilotGmbH
        </p>
        <p className="app-soft mt-3 text-sm">
          Wrapper-first. DSGVO-first. DACH-ready.
        </p>
      </div>

      <nav className="app-nav">
        {navigation.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.href}
              className={`app-nav-link${isActive ? " is-active" : ""}`}
              href={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
