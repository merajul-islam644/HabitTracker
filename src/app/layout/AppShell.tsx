import { Leaf } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { navItems } from "./navItems";
import { UserMenu } from "./UserMenu";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { listMySettings } from "../../features/settings/settingsApi";
const MOBILE_QUERY = "(max-width: 880px)";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function AppShell({ activePath, children, onNavigate }: { activePath: string; children: ReactNode; onNavigate: (path: string) => void }) {
  const isMobile = useIsMobile();
  const { t } = useT();
  const activeItem = navItems.find((item) => item.href === activePath);

  const settingsQuery = useQuery({
    queryKey: ["settings", "me"],
    queryFn: listMySettings,
    staleTime: 30_000
  });

  const appearance = (settingsQuery.data?.[0]?.appearance as string | undefined) ?? "System";

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = appearance === "Dark" ? true : appearance === "Light" ? false : mql.matches;
      document.documentElement.classList.toggle("dark", dark);
    };

    apply();
    if (appearance === "System") {
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    }
    return;
  }, [appearance]);

  return (
    <div className="shell">
      {!isMobile ? (
        <aside>
          <div className="sidebar-header">
            <a className="brand" href="/" onClick={(event) => { event.preventDefault(); onNavigate("/app"); }}>
              <span className="brand-mark" aria-hidden="true"><Leaf size={16} /></span>
              <span>{t("app.name")}</span>
            </a>
          </div>
          <nav>
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={activePath === item.href ? "active" : ""}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.href);
                }}
              >
                <item.icon size={18} />
                <span>{t(item.labelKey)}</span>
              </a>
            ))}
          </nav>
        </aside>
      ) : null}

      <div className="content">
        <header className="topbar">
          {isMobile ? (
            <div className="breadcrumb">
              <span className="brand-mark" aria-hidden="true"><Leaf size={16} /></span>
              <span>{t("app.name")}</span>
            </div>
          ) : activeItem ? (
            <div className="breadcrumb">
              <activeItem.icon size={16} />
              <span>{t(activeItem.labelKey)}</span>
            </div>
          ) : null}

          <div className="topbar-spacer" />
          <UserMenu onNavigate={onNavigate} />
        </header>

        <main className={isMobile ? "main-with-bottom-nav" : undefined}>{children}</main>

        {isMobile ? (
          <nav className="bottom-nav" aria-label="Primary">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={activePath === item.href ? "active" : ""}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.href);
                }}
              >
                <item.icon size={20} />
                <span>{t(item.labelKey)}</span>
              </a>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
