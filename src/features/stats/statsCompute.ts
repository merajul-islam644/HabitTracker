import type { Completion } from "../completions/completionsApi";
import type { Habit } from "../habits/habitsApi";
import type { WeekStartsOn } from "../settings/settingsApi";
import { dateToYmd, isHabitScheduledOn, ymdToDate } from "../habits/schedule";
import type { StatsPeriod } from "./statsPeriod";

type HabitFrequencyType = Habit["frequencyType"];

export type StatsKpis = {
  completionRatePercent: number;
  completedCount: number;
  currentStreakDays: number;
};

export type BreakdownRow = {
  habitId: string;
  habitName: string;
  done: number;
  scheduled: number;
  ratePercent: number;
};

export function computeStats(input: {
  period: StatsPeriod;
  weekStartsOn: WeekStartsOn;
  today: Date;
  habits: Habit[];
  completions: Completion[];
  periodStart: Date;
  periodEnd: Date;
}): {
  kpis: StatsKpis;
  completionsInPeriod: Completion[];
  activeHabitsCount: number;
  breakdown: BreakdownRow[];
} {
  const periodStartYmd = dateToYmd(input.periodStart);
  const periodEndYmd = dateToYmd(input.periodEnd);
  const todayYmd = dateToYmd(input.today);

  const allHabitIds = new Set(input.habits.map((h) => habitId(h)).filter(Boolean));
  const completionsInPeriod = input.completions
    .filter((c) => Boolean(c.scheduledDate) && c.scheduledDate! >= periodStartYmd && c.scheduledDate! <= periodEndYmd)
    .filter((c) => Boolean(c.habitId) && allHabitIds.has(String(c.habitId)));

  const completionSetByHabitDate = new Set(completionsInPeriod.map((c) => `${String(c.habitId)}:${String(c.scheduledDate)}`));
  const completionCountByDate = new Map<string, number>();
  for (const c of completionsInPeriod) {
    const ymd = String(c.scheduledDate);
    completionCountByDate.set(ymd, (completionCountByDate.get(ymd) ?? 0) + 1);
  }

  const activeHabitsCount = input.habits.filter((h) => !h.archived).length;

  let totalScheduled = 0;
  let totalDoneForRate = 0;

  const breakdown: BreakdownRow[] = [];
  for (const habit of input.habits) {
    const id = habitId(habit);
    if (!id) continue;

    const { scheduled, doneForRate } = countScheduledAndDoneForHabit({
      habit,
      habitId: id,
      periodStartYmd,
      periodEndYmd,
      weekStartsOn: input.weekStartsOn,
      completionSetByHabitDate
    });

    totalScheduled += scheduled;
    totalDoneForRate += doneForRate;

    const ratePercent = scheduled > 0 ? Math.round((doneForRate / scheduled) * 100) : 0;
    breakdown.push({
      habitId: id,
      habitName: habit.habitName || "Untitled habit",
      done: doneForRate,
      scheduled,
      ratePercent
    });
  }

  // ST-06 AC2: sort by lowest completion rate first.
  breakdown.sort((a, b) => a.ratePercent - b.ratePercent || a.habitName.localeCompare(b.habitName));

  const completionRatePercent = totalScheduled > 0 ? Math.round((totalDoneForRate / totalScheduled) * 100) : 0;
  const completedCount = completionsInPeriod.length;
  const currentStreakDays = computeMemberStreak({
    todayYmd,
    habits: input.habits,
    completionsByDate: completionCountByDate
  });

  return {
    kpis: { completionRatePercent, completedCount, currentStreakDays },
    completionsInPeriod,
    activeHabitsCount,
    breakdown
  };
}

export function buildChartSeries(input: {
  period: StatsPeriod;
  periodStart: Date;
  periodEnd: Date;
  completionsInPeriod: Completion[];
}): { label: string; value: number; key: string }[] {
  if (input.period === "Year") {
    const year = input.periodStart.getFullYear();
    const byMonth = new Array(12).fill(0) as number[];
    for (const c of input.completionsInPeriod) {
      const ymd = String(c.scheduledDate ?? "");
      if (!ymd.startsWith(String(year))) continue;
      const m = Number(ymd.slice(5, 7));
      if (!m) continue;
      byMonth[m - 1] += 1;
    }
    return byMonth.map((value, idx) => {
      const d = new Date(year, idx, 1);
      return { key: `${year}-${String(idx + 1).padStart(2, "0")}`, label: d.toLocaleDateString(undefined, { month: "short" }), value };
    });
  }

  const startYmd = dateToYmd(input.periodStart);
  const endYmd = dateToYmd(input.periodEnd);
  const byDate = new Map<string, number>();
  for (const c of input.completionsInPeriod) {
    const ymd = String(c.scheduledDate ?? "");
    if (ymd < startYmd || ymd > endYmd) continue;
    byDate.set(ymd, (byDate.get(ymd) ?? 0) + 1);
  }

  const points: { label: string; value: number; key: string }[] = [];
  const cursor = new Date(input.periodStart.getFullYear(), input.periodStart.getMonth(), input.periodStart.getDate());
  const end = new Date(input.periodEnd.getFullYear(), input.periodEnd.getMonth(), input.periodEnd.getDate());
  while (cursor <= end) {
    const ymd = dateToYmd(cursor);
    points.push({ key: ymd, label: cursor.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: byDate.get(ymd) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

function countScheduledAndDoneForHabit(input: {
  habit: Habit;
  habitId: string;
  periodStartYmd: string;
  periodEndYmd: string;
  weekStartsOn: WeekStartsOn;
  completionSetByHabitDate: Set<string>;
}): { scheduled: number; doneForRate: number } {
  const frequencyType = (input.habit.frequencyType ?? "Daily") as HabitFrequencyType;

  if (frequencyType === "WeeklyTarget") {
    const target = Math.max(0, Number(input.habit.weeklyTarget ?? 0));
    if (target === 0) return { scheduled: 0, doneForRate: 0 };

    const weeks = new Map<string, { startYmd: string; endYmd: string }>();
    const cursor = ymdToDate(input.periodStartYmd);
    const end = ymdToDate(input.periodEndYmd);
    while (cursor <= end) {
      const ymd = dateToYmd(cursor);
      if (isHabitScheduledOn(input.habit, ymd)) {
        const week = weekBoundsForYmd(ymd, input.weekStartsOn);
        weeks.set(week.startYmd, week);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    let scheduled = 0;
    let doneForRate = 0;
    for (const week of weeks.values()) {
      scheduled += target;
      const doneInWeek = countCompletionsForHabitInRange({
        habitId: input.habitId,
        startYmd: maxYmd(week.startYmd, input.periodStartYmd),
        endYmd: minYmd(week.endYmd, input.periodEndYmd),
        completionSetByHabitDate: input.completionSetByHabitDate
      });
      doneForRate += Math.min(doneInWeek, target);
    }

    return { scheduled, doneForRate };
  }

  let scheduled = 0;
  let doneForRate = 0;
  const cursor = ymdToDate(input.periodStartYmd);
  const end = ymdToDate(input.periodEndYmd);
  while (cursor <= end) {
    const ymd = dateToYmd(cursor);
    if (isHabitScheduledOn(input.habit, ymd)) {
      scheduled += 1;
      if (input.completionSetByHabitDate.has(`${input.habitId}:${ymd}`)) doneForRate += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { scheduled, doneForRate };
}

function computeMemberStreak(input: {
  todayYmd: string;
  habits: Habit[];
  completionsByDate: Map<string, number>;
}): number {
  const allHabitIds = new Set(input.habits.map((h) => habitId(h)).filter(Boolean));
  if (allHabitIds.size === 0) return 0;

  let streak = 0;
  const cursor = ymdToDate(input.todayYmd);
  const limit = 730; // sanity cap
  for (let i = 0; i < limit; i += 1) {
    const ymd = dateToYmd(cursor);
    const scheduledIds = input.habits.filter((h) => isHabitScheduledOn(h, ymd)).map((h) => habitId(h)).filter(Boolean);
    const scheduledCount = scheduledIds.length;
    if (scheduledCount === 0) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    const completedCount = input.completionsByDate.get(ymd) ?? 0;
    if (completedCount <= 0) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function countCompletionsForHabitInRange(input: {
  habitId: string;
  startYmd: string;
  endYmd: string;
  completionSetByHabitDate: Set<string>;
}): number {
  let count = 0;
  const cursor = ymdToDate(input.startYmd);
  const end = ymdToDate(input.endYmd);
  while (cursor <= end) {
    const ymd = dateToYmd(cursor);
    if (input.completionSetByHabitDate.has(`${input.habitId}:${ymd}`)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function weekBoundsForYmd(ymd: string, weekStartsOn: WeekStartsOn): { startYmd: string; endYmd: string } {
  const date = ymdToDate(ymd);
  const day = date.getDay();
  const weekStartDay = weekStartsOn === "Sunday" ? 0 : 1;
  const delta = (day - weekStartDay + 7) % 7;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - delta);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 6);
  return { startYmd: dateToYmd(start), endYmd: dateToYmd(end) };
}

function habitId(habit: Habit): string {
  const id = habit.itemId ?? habit.ItemId;
  return id ? String(id) : "";
}

function maxYmd(a: string, b: string): string {
  return a >= b ? a : b;
}

function minYmd(a: string, b: string): string {
  return a <= b ? a : b;
}
