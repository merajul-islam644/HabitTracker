import { dateToYmd } from "../habits/schedule";

export type WeekStart = "Mon" | "Sun";

export type CalendarDay = {
  date: Date;
  ymd: string;
  inMonth: boolean;
};

export function monthTitle(viewMonth: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(viewMonth);
}

export function monthDayTitle(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(date);
}

export function normalizeToMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, deltaMonths: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + deltaMonths, 1);
}

export function weekdayLabels(weekStart: WeekStart = "Mon"): string[] {
  // PRD default: Monday (member can switch later in Settings).
  if (weekStart === "Mon") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}

export function monthGridDays(viewMonth: Date, weekStart: WeekStart = "Mon"): CalendarDay[] {
  const firstOfMonth = normalizeToMonthStart(viewMonth);
  const lastOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);

  const start = startOfWeek(firstOfMonth, weekStart);
  const end = endOfWeek(lastOfMonth, weekStart);

  const days: CalendarDay[] = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    days.push({
      date: new Date(cursor.getTime()),
      ymd: dateToYmd(cursor),
      inMonth: cursor.getMonth() === viewMonth.getMonth()
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function startOfWeek(date: Date, weekStart: WeekStart): Date {
  const startIndex = weekStart === "Mon" ? 1 : 0;
  const dayIndex = date.getDay();
  const delta = (dayIndex - startIndex + 7) % 7;
  const start = new Date(date.getTime());
  start.setDate(start.getDate() - delta);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfWeek(date: Date, weekStart: WeekStart): Date {
  const start = startOfWeek(date, weekStart);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 6);
  end.setHours(0, 0, 0, 0);
  return end;
}
