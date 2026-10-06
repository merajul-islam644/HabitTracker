import { ArrowRight, Leaf, LogIn } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { useT } from "../../lib/i18n/LocalizationProvider";

export function WelcomePage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { status } = useAuth();
  const { t } = useT();

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("returnTo") || "/app";
    return value.startsWith("/") ? value : "/app";
  }, []);

  useEffect(() => {
    if (status === "authenticated") onNavigate("/app");
  }, [onNavigate, status]);

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-brand">
          <span className="brand-mark" aria-hidden="true"><Leaf size={18} /></span>
          <span className="welcome-name">{t("app.name")}</span>
        </div>

        <div className="welcome-illustration" aria-hidden="true">
          <svg viewBox="0 0 240 110" role="presentation">
            <defs>
              <linearGradient id="habitify-leaf" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="hsl(var(--primary) / 0.75)" />
                <stop offset="1" stopColor="hsl(var(--primary) / 0.25)" />
              </linearGradient>
            </defs>
            <path d="M188 24c-25 2-45 11-61 27-12 12-21 28-25 47-25-5-45-17-60-36 22-6 38-18 48-37 6-12 8-24 8-35 24 5 44 14 60 28 11-10 23-17 38-21-2 9-6 17-12 24 13-1 25-1 36 3-6 0-12 0-18 0z" fill="url(#habitify-leaf)" />
            <path d="M106 84c17-17 41-28 72-31" fill="none" stroke="hsl(var(--primary) / 0.6)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="76" cy="32" r="6" fill="hsl(var(--accent-foreground) / 0.18)" />
            <circle cx="210" cy="70" r="8" fill="hsl(var(--accent-foreground) / 0.12)" />
          </svg>
        </div>

        <h1 className="welcome-title">{t("welcome.headline")}</h1>
        <p className="welcome-subtitle">{t("welcome.subtitle")}</p>

        <div className="welcome-actions">
          <button className="primary-button welcome-primary" onClick={() => onNavigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)}>
            <ArrowRight size={18} /> {t("welcome.getStarted")}
          </button>
          <button className="icon-button welcome-secondary" onClick={() => onNavigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)}>
            <LogIn size={18} /> {t("welcome.signIn")}
          </button>

          <p className="welcome-already">
            {t("welcome.already")} <a href="/login" onClick={(e) => { e.preventDefault(); onNavigate(`/login?returnTo=${encodeURIComponent(returnTo)}`); }}>{t("welcome.signIn")}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
