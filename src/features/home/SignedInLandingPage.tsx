import { CheckCircle2, Circle, Leaf, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/AuthProvider";
import { useNavigation } from "../../app/router/navigation";
import { createAuditEvent } from "../audit/auditApi";
import { createCompletion, deleteCompletion, listCompletions } from "../completions/completionsApi";
import { habitId, listHabits } from "../habits/habitsApi";
import { isHabitScheduledOn, todayYmd } from "../habits/schedule";
import { useT } from "../../lib/i18n/LocalizationProvider";

export function SignedInLandingPage() {
  const { t } = useT();
  const { claims } = useAuth();
  const { navigate } = useNavigation();
  const queryClient = useQueryClient();
  const today = todayYmd();

  const habitsQuery = useQuery({
    queryKey: ["habits"],
    queryFn: listHabits,
    staleTime: 15_000
  });

  const completionsQuery = useQuery({
    queryKey: ["completions"],
    queryFn: listCompletions,
    staleTime: 15_000
  });

  const habits = habitsQuery.data ?? [];
  const completions = completionsQuery.data ?? [];

  const todayHabits = habits.filter((habit) => isHabitScheduledOn(habit, today));
  const completionByHabitId = new Map(
    completions
      .filter((c) => c.scheduledDate === today)
      .filter((c) => Boolean(c.habitId))
      .map((c) => [String(c.habitId), c])
  );

  const total = todayHabits.length;
  const done = todayHabits.filter((h) => completionByHabitId.has(habitId(h))).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const actorUserId = String((claims?.sub ?? claims?.userId ?? claims?.id ?? "") || "");

  const completeMutation = useMutation({
    mutationFn: async (habitItemId: string) => {
      const scheduledDate = today;
      const habitDateKey = `${habitItemId}:${scheduledDate}`;

      try {
        await createCompletion({
          habitId: habitItemId,
          habitDateKey,
          scheduledDate,
          completedAt: new Date().toISOString()
        });
      } catch (error) {
        // Idempotency: if a retry races or uniqueness rejects a duplicate, the
        // end state is still "completed".
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

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>{t("home.title")}</h2>
          <p>{t("home.subtitle")}</p>
        </div>
        <div className="page-actions">
          <button className="primary-button" onClick={() => navigate("/app/habits/new")}> <Plus size={16} /> Add Habit</button>
        </div>
      </div>

      {total === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true"><Leaf size={22} /></div>
          <h3>Start with one small habit</h3>
          <p>Choose something you want to do consistently.</p>
          <button className="primary-button" onClick={() => navigate("/app/habits/new")}>Create your first habit</button>
        </div>
      ) : (
        <div className="metrics">
          <div className="metric">
            <span>{greeting()}</span>
            <strong>{done} / {total} habits done</strong>
            <small>({percent}%)</small>
          </div>
        </div>
      )}

      {total > 0 ? (
        <div className="panel">
          <div className="panel-title"><span>Today</span></div>
          <ul className="habit-list" aria-label="Today's habits">
            {todayHabits.map((habit) => {
              const id = habitId(habit);
              const completion = completionByHabitId.get(id);
              const isDone = Boolean(completion);
              return (
                <li key={id} className={isDone ? "habit-row habit-row-done" : "habit-row"}>
                  <div className="habit-row-head">
                    <span className="habit-row-title">
                      {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      <button
                        className="link-button"
                        onClick={() => navigate(`/app/habits/detail?habitId=${encodeURIComponent(id)}`)}
                      >
                        {habit.habitName || "Untitled habit"}
                      </button>
                    </span>
                    <span className="habit-row-status">{isDone ? "Completed" : "Not done"}</span>
                  </div>

                  <div className="habit-row-actions">
                    {!isDone ? (
                      <button
                        className="primary-button"
                        onClick={() => completeMutation.mutate(id)}
                        disabled={completeMutation.isPending}
                        aria-label={`Mark ${habit.habitName || "habit"} done`}
                      >
                        Mark done
                      </button>
                    ) : (
                      <button
                        className="icon-button"
                        onClick={() => {
                          const completionId = completion?.itemId ?? completion?.ItemId;
                          if (completionId) undoMutation.mutate(String(completionId));
                        }}
                        disabled={undoMutation.isPending}
                        aria-label={`Undo ${habit.habitName || "habit"}`}
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
      ) : null}
    </section>
  );
}
