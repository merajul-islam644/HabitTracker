import type { Completion } from "../completions/completionsApi";
import { habitId, type Habit } from "../habits/habitsApi";
import { isHabitScheduledOn } from "../habits/schedule";

export type DayIndicator = "complete" | "partial" | "none" | "no-habits" | "upcoming";

export function summarizeDay(input: {
  ymd: string;
  today: string;
  habits: Habit[];
  completions: Completion[];
  allHabitIds: Set<string>;
}): { scheduledCount: number; completedCount: number; indicator: DayIndicator } {
  const doneIds = new Set(
    input.completions
      .filter((c) => c.scheduledDate === input.ymd)
      .map((c) => String(c.habitId ?? ""))
      .filter((id) => input.allHabitIds.has(id))
  );

  // Keep historical completions visible even if the schedule later changes.
  const scheduledIds = new Set(
    input.habits
      .filter((habit) => isHabitScheduledOn(habit, input.ymd))
      .map((h) => habitId(h))
  );
  for (const doneId of doneIds) scheduledIds.add(doneId);

  const scheduledCount = scheduledIds.size;
  const completedCount = doneIds.size;
  if (scheduledCount === 0) return { scheduledCount: 0, completedCount: 0, indicator: "no-habits" };
  if (completedCount >= scheduledCount) return { scheduledCount, completedCount: scheduledCount, indicator: "complete" };
  if (completedCount > 0) return { scheduledCount, completedCount, indicator: "partial" };

  // PRD: future days are not shown as missed/incomplete.
  const indicator: DayIndicator = input.ymd > input.today ? "upcoming" : "none";
  return { scheduledCount, completedCount, indicator };
}
