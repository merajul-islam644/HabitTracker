import type { WeekStartsOn } from "../settings/settingsApi";

export type StatsPeriod = "Week" | "Month" | "Year";

export function startOfPeriod(today: Date, period: StatsPeriod, weekStartsOn: WeekStartsOn): Date {
  if (period === "Month") return new Date(today.getFullYear(), today.getMonth(), 1);
  if (period === "Year") return new Date(today.getFullYear(), 0, 1);
  return startOfWeek(today, weekStartsOn);
}

export function endOfPeriod(today: Date, period: StatsPeriod, weekStartsOn: WeekStartsOn): Date {
  if (period === "Month") return new Date(today.getFullYear(), today.getMonth() + 1, 0);
  if (period === "Year") return new Date(today.getFullYear(), 11, 31);
  const start = startOfWeek(today, weekStartsOn);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 6);
  return end;
}

export function listDaysInclusive(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= endDay) {
    days.push(new Date(cursor.getTime()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function formatRangeLabel(period: StatsPeriod, start: Date, end: Date): string {
  if (period === "Year") return String(start.getFullYear());

  if (period === "Month") {
    return start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  const a = formatShortMonthDay(start);
  const b = formatShortMonthDay(end);
  return a === b ? a : `${a}–${b}`;
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short" });
}

function startOfWeek(date: Date, weekStartsOn: WeekStartsOn): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const weekStartDay = weekStartsOn === "Sunday" ? 0 : 1;
  const delta = (day - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - delta);
  return d;
}

function formatShortMonthDay(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
