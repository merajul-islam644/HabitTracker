import { CheckCircle2, Circle, Pencil } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/AuthProvider";
import { useNavigation } from "../../app/router/navigation";
import { createAuditEvent } from "../audit/auditApi";
import { createCompletion, deleteCompletion, listCompletions } from "../completions/completionsApi";
import { habitId, listHabits } from "./habitsApi";
import { dateToYmd, isHabitScheduledOn, todayYmd, ymdToDate } from "./schedule";

export function HabitDetailsPage() {
  const { navigate, search } = useNavigation();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const today = todayYmd();

  const params = new URLSearchParams(search);
  const selectedHabitId = params.get("habitId") || "";

  const habitsQuery = useQuery({ queryKey: ["habits"], queryFn: listHabits, staleTime: 15_000 });
  const completionsQuery = useQuery({ queryKey: ["completions"], queryFn: listCompletions, staleTime: 15_000 });

  const habit = (habitsQuery.data ?? []).find((h) => habitId(h) === selectedHabitId);
  const completions = (completionsQuery.data ?? []).filter((c) => c.habitId === selectedHabitId);

  const completionByDate = new Map(completions.filter((c) => c.scheduledDate).map((c) => [String(c.scheduledDate), c]));
  const todayCompletion = completionByDate.get(today);
  const isDoneToday = Boolean(todayCompletion);

  const actorUserId = String((claims?.sub ?? claims?.userId ?? claims?.id ?? "") || "");

  const completeMutation = useMutation({
    mutationFn: async () => {
      const habitDateKey = `${selectedHabitId}:${today}`;
      try {
        await createCompletion({
          habitId: selectedHabitId,
          habitDateKey,
          scheduledDate: today,
          completedAt: new Date().toISOString()
        });
      } catch (error) {
        const message = (error as Error)?.message ?? String(error);
        if (!/unique|duplicate|already exists/i.test(message)) throw error;
      }

      void createAuditEvent({
        entityType: "Completion",
        entityId: habitDateKey,
        action: "create",
        changedFields: [],
        occurredAt: new Date().toISOString(),
        actorUserId
      }).catch(() => undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["completions"] });
    }
  });

  const undoMutation = useMutation({
    mutationFn: async (completionItemId: string) => {
      await deleteCompletion(completionItemId);
      void createAuditEvent({
        entityType: "Completion",
        entityId: completionItemId,
        action: "delete",
        changedFields: [],
        occurredAt: new Date().toISOString(),
        actorUserId
      }).catch(() => undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["completions"] });
    }
  });

  if (!habit) {
    return (
      <section>
        <div className="empty-page">
          <h2>Habit not found</h2>
          <p className="muted">This habit may have been deleted.</p>
          <button className="primary-button" onClick={() => navigate("/app")}>Back to Home</button>
        </div>
      </section>
    );
  }

  const scheduledDatesUpToToday = listScheduledDates(habit, today);
  const scheduledCount = scheduledDatesUpToToday.length;
  const completedCount = scheduledDatesUpToToday.filter((d) => completionByDate.has(d)).length;
  const completionRate = scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;

  const { currentStreak, bestStreak } = computeStreaks(scheduledDatesUpToToday, completionByDate);

  const last7 = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const ymd = dateToYmd(date);
    return {
      ymd,
      scheduled: isHabitScheduledOn(habit, ymd),
      completed: Boolean(completionByDate.get(ymd))
    };
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>{habit.habitName || "Habit"}</h2>
          <p className="muted">{habit.frequencyType || "Daily"}</p>
        </div>
        <div className="page-actions">
          <button className="icon-button" onClick={() => navigate(`/app/habits/edit?habitId=${encodeURIComponent(selectedHabitId)}`)}>
            <Pencil size={16} /> Edit
          </button>
        </div>
      </div>

      <div className="metrics">
        <div className="metric"><span>Current streak</span><strong>{currentStreak}</strong></div>
        <div className="metric"><span>Best streak</span><strong>{bestStreak}</strong></div>
        <div className="metric"><span>Total completions</span><strong>{completions.length}</strong></div>
        <div className="metric"><span>Completion rate</span><strong>{completionRate}%</strong></div>
      </div>

      <div className="panel">
        <div className="panel-title"><span>Today</span></div>
        <div className="habit-row-actions">
          {!isDoneToday ? (
            <button className="primary-button" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
              <Circle size={16} /> Mark as Done
            </button>
          ) : (
            <button
              className="icon-button"
              onClick={() => {
                const id = todayCompletion?.itemId ?? todayCompletion?.ItemId;
                if (id) undoMutation.mutate(String(id));
              }}
              disabled={undoMutation.isPending}
            >
              <CheckCircle2 size={16} /> Undo
            </button>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><span>Last 7 days</span></div>
        <ul className="habit-list" aria-label="Last 7 days">
          {last7.map((day) => (
            <li key={day.ymd} className={day.completed ? "habit-row habit-row-done" : "habit-row"}>
              <div className="habit-row-head">
                <span className="habit-row-title">
                  {day.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  <span>{day.ymd}</span>
                </span>
                <span className="habit-row-status">
                  {!day.scheduled ? "Not scheduled" : day.completed ? "Completed" : "Not done"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function listScheduledDates(habit: Parameters<typeof isHabitScheduledOn>[0], endYmd: string): string[] {
  const startYmd = habit.startDate || "1970-01-01";
  const start = ymdToDate(startYmd);
  const end = ymdToDate(endYmd);

  const dates: string[] = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const ymd = dateToYmd(cursor);
    if (isHabitScheduledOn(habit, ymd)) dates.push(ymd);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function computeStreaks(scheduledDates: string[], completionByDate: Map<string, unknown>): { bestStreak: number; currentStreak: number } {
  let best = 0;
  let current = 0;

  for (const date of scheduledDates) {
    if (completionByDate.has(date)) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }

  // Current streak is the trailing segment ending at the last scheduled date.
  let trailing = 0;
  for (let i = scheduledDates.length - 1; i >= 0; i -= 1) {
    const date = scheduledDates[i];
    if (completionByDate.has(date)) trailing += 1;
    else break;
  }

  return { bestStreak: best, currentStreak: trailing };
}
