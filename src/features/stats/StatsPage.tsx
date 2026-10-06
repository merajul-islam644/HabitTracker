import { useT } from "../../lib/i18n/LocalizationProvider";

export function StatsPage() {
  const { t } = useT();

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>{t("nav.stats")}</h2>
          <p className="muted">Trends and completion rates over time.</p>
        </div>
      </div>

      <div className="panel">
        <p className="muted">Your progress will appear here once you start completing habits.</p>
      </div>
    </section>
  );
}
