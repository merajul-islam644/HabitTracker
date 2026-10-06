import { CheckCircle2, Circle, MinusCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/AuthProvider";
import { useNavigation } from "../../app/router/navigation";
import { createAuditEvent } from "../audit/auditApi";
import { createCompletion, deleteCompletion, type Completion } from "../completions/completionsApi";
import { habitId, type Habit } from "../habits/habitsApi";
import { isHabitScheduledOn, ymdToDate } from "../habits/schedule";
import { monthDayTitle } from "./calendarUtils";

export function SelectedDatePanel(props: {
  selectedYmd: string;
  today: string;
  habits: Habit[];
  completions: Completion[];
}) {
  const { navigate } = useNavigation();
  const { claims } = useAuth();
  const queryClient = useQueryClient();

  const selectedDate = ymdToDate(props.selectedYmd);
  const isFuture = props.selectedYmd > props.today;

  const selectedCompletionByHabitId = new Map(
    props.completions
      .filter((c) => c.scheduledDate === props.selectedYmd)
      .filter((c) => Boolean(c.habitId))
      .map((c) => [String(c.habitId), c])
  );

  const selectedScheduledHabits = props.habits.filter((habit) => {
    const id = habitId(habit);
    return isHabitScheduledOn(habit, props.selectedYmd) || selectedCompletionByHabitId.has(id);
  });

  const total = selectedScheduledHabits.length;
  const done = selectedScheduledHabits.filter((habit) => selectedCompletionByHabitId.has(habitId(habit))).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const actorUserId = String((claims?.sub ?? claims?.userId ?? claims?.id ?? "") || "");

  const completeMutation = useMutation({
    mutationFn: async (habitItemId: string) => {
      const habitDateKey = `${habitItemId}:${props.selectedYmd}`;

      try {
        await createCompletion({
          habitId: habitItemId,
          habitDateKey,
          scheduledDate: props.selectedYmd,
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

  return (
    <div className="panel">
      <div className="panel-title"><span>{monthDayTitle(selectedDate)}</span></div>
      <div className="calendar-summary">{done} of {total} habits completed · {percent}%</div>

      <ul className="habit-list" aria-label="Habits for selected date">
        {props.habits.map((habit) => {
          const id = habitId(habit);
          const completion = selectedCompletionByHabitId.get(id);
          const scheduled = isHabitScheduledOn(habit, props.selectedYmd) || Boolean(completion);
          const isDone = Boolean(completion);

          const status = !scheduled ? "Not scheduled" : isDone ? "Completed" : "Incomplete";

          return (
            <li key={id} className={isDone ? "habit-row habit-row-done" : "habit-row"}>
              <div className="habit-row-head">
                <span className="habit-row-title">
                  {!scheduled ? <MinusCircle size={16} /> : isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => navigate(`/app/habits/detail?habitId=${encodeURIComponent(id)}`)}
                  >
                    {habit.habitName || "Untitled habit"}
                  </button>
                </span>
                <span className="habit-row-status">{status}</span>
              </div>

              <div className="habit-row-actions">
                {!scheduled || isFuture ? null : !isDone ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => completeMutation.mutate(id)}
                    disabled={completeMutation.isPending}
                    aria-label={`Mark ${habit.habitName || "habit"} done for ${props.selectedYmd}`}
                  >
                    Mark done
                  </button>
                ) : (
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => {
                      const completionItemId = completion?.itemId ?? completion?.ItemId;
                      if (completionItemId) undoMutation.mutate(String(completionItemId));
                    }}
                    disabled={undoMutation.isPending}
                    aria-label={`Undo ${habit.habitName || "habit"} for ${props.selectedYmd}`}
                  >
                    Undo
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
