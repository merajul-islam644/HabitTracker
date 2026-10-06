import { blocksClient } from "../../lib/blocks/client";

export type HabitFrequencyType = "Daily" | "SelectedWeekdays" | "WeeklyTarget";

export type Habit = {
  itemId?: string;
  ItemId?: string;

  habitName?: string;
  description?: string;
  category?: string;
  icon?: string;
  color?: string;

  frequencyType?: HabitFrequencyType;
  scheduledWeekdays?: string[];
  weeklyTarget?: number;

  targetEnabled?: boolean;
  targetValue?: number;
  targetUnit?: string;

  reminderEnabled?: boolean;
  reminderTime?: string;
  reminderDays?: string[];

  startDate?: string;
  archived?: boolean;
  archivedAt?: string;
};

export type HabitInput = Omit<Habit, "itemId" | "ItemId">;

const habits = blocksClient.data.collection<Habit>("Habit", {
  fields: [
    "habitName",
    "description",
    "category",
    "icon",
    "color",
    "frequencyType",
    "scheduledWeekdays",
    "weeklyTarget",
    "targetEnabled",
    "targetValue",
    "targetUnit",
    "reminderEnabled",
    "reminderTime",
    "reminderDays",
    "startDate",
    "archived",
    "archivedAt",
    "CreatedBy",
    "CreatedDate",
    "LastUpdatedDate"
  ]
});

export async function listHabits(): Promise<Habit[]> {
  const response = await habits.list({ pageNo: 1, pageSize: 200 });
  const data = response as {
    data?: { getHabits?: { items?: Habit[] } };
  };
  return data.data?.getHabits?.items ?? [];
}

export function createHabit(input: HabitInput) {
  return habits.create(input);
}

export function updateHabit(habitId: string, input: HabitInput) {
  return habits.update(habitId, input);
}

export function deleteHabit(habitId: string) {
  return habits.delete(habitId);
}

export function habitId(habit: Habit): string {
  const id = habit.itemId ?? habit.ItemId;
  if (!id) throw new Error("Habit id is missing.");
  return String(id);
}
