import type { Habit, HabitFrequencyType } from "./habitsApi";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function todayYmd(now = new Date()): string {
  return dateToYmd(now);
}

export function dateToYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((part) => Number(part));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function weekdayKey(ymd: string): string {
  const date = ymdToDate(ymd);
  return WEEKDAYS[date.getDay()] ?? "Mon";
}

export function isHabitScheduledOn(habit: Habit, ymd: string): boolean {
  const start = habit.startDate || "1970-01-01";
  if (ymd < start) return false;

  const archived = Boolean(habit.archived);
  const archivedAtYmd = habit.archivedAt ? habit.archivedAt.slice(0, 10) : undefined;
  if (archived && archivedAtYmd && ymd > archivedAtYmd) return false;
  if (archived && !archivedAtYmd && ymd >= start) return false;

  const type = (habit.frequencyType || "Daily") as HabitFrequencyType;
  if (type === "Daily") return true;

  if (type === "SelectedWeekdays") {
    const days = habit.scheduledWeekdays ?? [];
    return days.includes(weekdayKey(ymd));
  }

  // WeeklyTarget: shows weekly progress; treat it as "scheduled" on any day in-range.
  return true;
}
