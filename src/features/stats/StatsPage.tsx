import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "../../app/router/navigation";
import { ErrorState } from "../../shared/ui/ErrorState";
import { listCompletions } from "../completions/completionsApi";
import { listHabits } from "../habits/habitsApi";
import { listMySettings } from "../settings/settingsApi";
import { computeStats } from "./statsCompute";
import { buildChartSeries } from "./statsCompute";
import { StatsChart } from "./StatsChart";
import { StatsBreakdown } from "./StatsBreakdown";
import { endOfPeriod, formatRangeLabel, startOfPeriod, type StatsPeriod } from "./statsPeriod";
import { useT } from "../../lib/i18n/LocalizationProvider";

export function StatsPage() {
  const { t } = useT();
  const { navigate } = useNavigation();

  const [period, setPeriod] = useState<StatsPeriod>("Week");
  const today = useMemo(() => new Date(), []);

  const habitsQuery = useQuery({ queryKey: ["habits"], queryFn: listHabits, staleTime: 15_000 });
  const completionsQuery = useQuery({ queryKey: ["completions"], queryFn: listCompletions, staleTime: 15_000 });
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: listMySettings, staleTime: 15_000 });

  const weekStartsOn = (settingsQuery.data?.[0]?.weekStartsOn ?? "Monday") as "Monday" | "Sunday";
  const periodStart = useMemo(() => startOfPeriod(today, period, weekStartsOn), [today, period, weekStartsOn]);
  const periodEnd = useMemo(() => endOfPeriod(today, period, weekStartsOn), [today, period, weekStartsOn]);
  const rangeLabel = useMemo(() => formatRangeLabel(period, periodStart, periodEnd), [period, periodStart, periodEnd]);

  const stats = useMemo(() => {
    if (!habitsQuery.data || !completionsQuery.data) return null;
    return computeStats({
      period,
      weekStartsOn,
      today,
      habits: habitsQuery.data,
      completions: completionsQuery.data,
      periodStart,
      periodEnd
    });
  }, [period, weekStartsOn, today, periodStart, periodEnd, habitsQuery.data, completionsQuery.data]);

  const chartPoints = useMemo(() => {
    if (!stats) return null;
    return buildChartSeries({
      period,
      periodStart,
      periodEnd,
      completionsInPeriod: stats.completionsInPeriod
    });
  }, [stats, period, periodStart, periodEnd]);

  const hasError = Boolean(habitsQuery.error || completionsQuery.error || settingsQuery.error);
  const isLoading = habitsQuery.isLoading || completionsQuery.isLoading || settingsQuery.isLoading;

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>{t("nav.stats")}</h2>
          <p className="muted">{rangeLabel}</p>
        </div>

        <div className="page-actions" role="tablist" aria-label="Stats period">
          <button type="button" className={period === "Week" ? "chip chip-active" : "chip"} onClick={() => setPeriod("Week")} aria-selected={period === "Week"}>
            Week
          </button>
          <button type="button" className={period === "Month" ? "chip chip-active" : "chip"} onClick={() => setPeriod("Month")} aria-selected={period === "Month"}>
            Month
          </button>
          <button type="button" className={period === "Year" ? "chip chip-active" : "chip"} onClick={() => setPeriod("Year")} aria-selected={period === "Year"}>
            Year
          </button>
        </div>
      </div>

      {hasError ? (
        <ErrorState
          message="The page couldn't finish loading. Please try again."
          onRetry={() => {
            void habitsQuery.refetch();
            void completionsQuery.refetch();
            void settingsQuery.refetch();
          }}
        />
      ) : isLoading || !stats ? (
        <div className="panel"><p className="muted">Loading…</p></div>
      ) : (
        <>
          <div className="metrics">
            <div className="metric">
              <span>Completion rate</span>
              <strong>{stats.kpis.completionRatePercent}%</strong>
            </div>
            <div className="metric">
              <span>Completed</span>
              <strong>{stats.kpis.completedCount}</strong>
            </div>
            <div className="metric">
              <span>Current streak</span>
              <strong>{stats.kpis.currentStreakDays} days</strong>
            </div>
          </div>

          {stats.activeHabitsCount > 0 && stats.completionsInPeriod.length > 0 && chartPoints ? (
            <StatsChart title="Daily completions" points={chartPoints} />
          ) : null}

          {stats.activeHabitsCount > 0 && stats.completionsInPeriod.length > 0 ? (
            <StatsBreakdown
              rows={stats.breakdown}
              onSelectHabit={(habitId) => navigate(`/app/habits/detail?habitId=${encodeURIComponent(habitId)}`)}
            />
          ) : null}

          {stats.activeHabitsCount === 0 ? (
            <div className="empty-state">
              <h3>No habits yet.</h3>
              <p>Choose something you want to do consistently.</p>
              <button className="primary-button" type="button" onClick={() => navigate("/app/habits/new")}>Create habit</button>
            </div>
          ) : stats.completionsInPeriod.length === 0 ? (
            <div className="empty-state">
              <h3>No completions in this period yet.</h3>
              <p>Mark habits as done to see your stats.</p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
