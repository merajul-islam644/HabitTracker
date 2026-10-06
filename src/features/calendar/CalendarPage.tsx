import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { listCompletions } from "../completions/completionsApi";
import { habitId, listHabits } from "../habits/habitsApi";
import { todayYmd, ymdToDate } from "../habits/schedule";
import { listMySettings } from "../settings/settingsApi";
import { addMonths, monthGridDays, monthTitle, normalizeToMonthStart, weekdayLabels } from "./calendarUtils";
import { summarizeDay } from "./calendarSummary";
import { SelectedDatePanel } from "./SelectedDatePanel";

export function CalendarPage() {
  const { t } = useT();

  const [viewMonth, setViewMonth] = useState(() => normalizeToMonthStart(new Date()));
  const [selectedYmd, setSelectedYmd] = useState(() => todayYmd());

  useEffect(() => {
    // Keep selection in the currently viewed month for predictable navigation.
    const selected = ymdToDate(selectedYmd);
    if (selected.getFullYear() !== viewMonth.getFullYear() || selected.getMonth() !== viewMonth.getMonth()) {
      setSelectedYmd(`${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}-01`);
    }
  }, [viewMonth, selectedYmd]);

  const today = todayYmd();

  const habitsQuery = useQuery({ queryKey: ["habits"], queryFn: listHabits, staleTime: 15_000 });
  const completionsQuery = useQuery({ queryKey: ["completions"], queryFn: listCompletions, staleTime: 15_000 });
  const settingsQuery = useQuery({ queryKey: ["settings", "me"], queryFn: listMySettings, staleTime: 30_000 });

  const weekStart = settingsQuery.data?.[0]?.weekStartsOn === "Sunday" ? "Sun" : "Mon";
  const days = monthGridDays(viewMonth, weekStart);
  const labels = weekdayLabels(weekStart);

  const habits = habitsQuery.data ?? [];
  const completions = completionsQuery.data ?? [];
  const allHabitIds = new Set(habits.map((h) => habitId(h)));


  return (
    <section>
      <div className="page-header">
        <div>
          <h2>{t("nav.calendar")}</h2>
          <p className="muted">Review your history by date.</p>
        </div>
      </div>

      <div className="panel">
        <div className="calendar-header">
          <button
            className="icon-button"
            type="button"
            onClick={() => setViewMonth((prev) => addMonths(prev, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="calendar-title" aria-live="polite">{monthTitle(viewMonth)}</div>

          <button
            className="icon-button"
            type="button"
            onClick={() => setViewMonth((prev) => addMonths(prev, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {labels.map((label) => (
            <div key={label} className="calendar-weekday">{label}</div>
          ))}
        </div>

        <div className="calendar-grid" role="grid" aria-label="Calendar month view">
          {days.map((day) => {
            const isSelected = day.ymd === selectedYmd;

            const { scheduledCount, completedCount, indicator } = summarizeDay({
              ymd: day.ymd,
              today,
              habits,
              completions,
              allHabitIds
            });

            const ariaDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(day.date);
            const ariaStatus =
              indicator === "no-habits"
                ? "No habits scheduled"
                : indicator === "complete"
                  ? "Complete"
                  : indicator === "partial"
                    ? "Partial"
                    : indicator === "none"
                      ? "None completed"
                      : "Upcoming";

            return (
              <button
                key={day.ymd}
                type="button"
                role="gridcell"
                className={
                  isSelected
                    ? "calendar-cell calendar-cell-selected"
                    : day.inMonth
                      ? "calendar-cell"
                      : "calendar-cell calendar-cell-out"
                }
                onClick={() => setSelectedYmd(day.ymd)}
                aria-label={`${ariaDate}. ${ariaStatus}. ${completedCount} of ${scheduledCount} habits completed.`}
              >
                <div className="calendar-day">
                  <span className="calendar-day-number">{day.date.getDate()}</span>
                </div>

                <div className="calendar-indicators" aria-hidden="true">
                  {indicator === "complete" ? (
                    <>
                      <span className="calendar-dot calendar-dot-complete" />
                      <span className="calendar-dot calendar-dot-complete" />
                      <span className="calendar-dot calendar-dot-complete" />
                    </>
                  ) : null}
                  {indicator === "partial" ? (
                    <>
                      <span className="calendar-dot calendar-dot-complete" />
                      <span className="calendar-dot calendar-dot-none" />
                    </>
                  ) : null}
                  {indicator === "none" ? <span className="calendar-dot calendar-dot-none" /> : null}
                  {indicator === "no-habits" ? <span className="calendar-dot calendar-dot-nohabits" /> : null}
                  {indicator === "upcoming" ? <span className="calendar-dot calendar-dot-upcoming" /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <SelectedDatePanel selectedYmd={selectedYmd} today={today} habits={habits} completions={completions} />
    </section>
  );
}
