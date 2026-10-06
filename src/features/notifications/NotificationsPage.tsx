import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { Alert } from "../../shared/ui/Alert";
import { createAuditEvent } from "../audit/auditApi";
import { habitId, listHabits, updateHabit } from "../habits/habitsApi";
import type { SettingsInput } from "../settings/settingsApi";
import { listMySettings, upsertMySettings } from "../settings/settingsApi";

function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

type HabitReminderDraft = {
  reminderEnabled: boolean;
  reminderTime: string;
};

export function NotificationsPage() {
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const actorUserId = String((claims?.sub ?? claims?.userId ?? claims?.id ?? "") || "");

  const settingsQuery = useQuery({
    queryKey: ["settings", "me"],
    queryFn: listMySettings,
    staleTime: 30_000
  });

  const habitsQuery = useQuery({
    queryKey: ["habits"],
    queryFn: listHabits,
    staleTime: 15_000
  });

  const current = settingsQuery.data?.[0];
  const baseInput = useMemo<SettingsInput>(() => ({
    appearance: current?.appearance ?? "System",
    language: current?.language ?? "English",
    timezone: current?.timezone ?? defaultTimezone(),
    weekStartsOn: current?.weekStartsOn ?? "Monday",
    dailyReminderEnabled: current?.dailyReminderEnabled ?? false,
    dailyReminderTime: current?.dailyReminderTime ?? "09:00",
    weeklySummaryEnabled: current?.weeklySummaryEnabled ?? false,
    quietHoursStart: current?.quietHoursStart ?? "",
    quietHoursEnd: current?.quietHoursEnd ?? ""
  }), [current]);

  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [dailyTime, setDailyTime] = useState("09:00");
  const [weeklySummaryEnabled, setWeeklySummaryEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [habitDrafts, setHabitDrafts] = useState<Record<string, HabitReminderDraft>>({});
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!settingsQuery.data) return;
    setDailyEnabled(Boolean(baseInput.dailyReminderEnabled));
    setDailyTime(baseInput.dailyReminderTime || "09:00");
    setWeeklySummaryEnabled(Boolean(baseInput.weeklySummaryEnabled));
    setQuietStart(baseInput.quietHoursStart || "");
    setQuietEnd(baseInput.quietHoursEnd || "");
  }, [settingsQuery.data, baseInput]);

  useEffect(() => {
    if (!habitsQuery.data) return;
    const next: Record<string, HabitReminderDraft> = {};
    for (const h of habitsQuery.data) {
      const id = habitId(h);
      next[id] = {
        reminderEnabled: Boolean(h.reminderEnabled),
        reminderTime: (h.reminderTime as string | undefined) || "09:00"
      };
    }
    setHabitDrafts(next);
  }, [habitsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setError(undefined);

      if (dailyEnabled && !dailyTime) throw new Error("Daily reminder time is required.");

      const nextSettings: SettingsInput = {
        ...baseInput,
        dailyReminderEnabled: dailyEnabled,
        dailyReminderTime: dailyEnabled ? dailyTime : "",
        weeklySummaryEnabled,
        quietHoursStart: quietStart,
        quietHoursEnd: quietEnd
      };

      const settingsChanged: string[] = [];
      if (nextSettings.dailyReminderEnabled !== baseInput.dailyReminderEnabled) settingsChanged.push("dailyReminderEnabled");
      if (nextSettings.dailyReminderTime !== baseInput.dailyReminderTime) settingsChanged.push("dailyReminderTime");
      if (nextSettings.weeklySummaryEnabled !== baseInput.weeklySummaryEnabled) settingsChanged.push("weeklySummaryEnabled");
      if (nextSettings.quietHoursStart !== baseInput.quietHoursStart) settingsChanged.push("quietHoursStart");
      if (nextSettings.quietHoursEnd !== baseInput.quietHoursEnd) settingsChanged.push("quietHoursEnd");

      await upsertMySettings(nextSettings);
      void createAuditEvent({
        entityType: "Settings",
        entityId: "me",
        action: current ? "update" : "create",
        changedFields: settingsChanged,
        occurredAt: new Date().toISOString(),
        actorUserId
      }).catch(() => undefined);

      const habits = habitsQuery.data ?? [];
      for (const h of habits) {
        const id = habitId(h);
        const draft = habitDrafts[id];
        if (!draft) continue;
        const prevEnabled = Boolean(h.reminderEnabled);
        const prevTime = (h.reminderTime as string | undefined) || "";
        const nextEnabled = draft.reminderEnabled;
        const nextTime = nextEnabled ? draft.reminderTime : "";

        if (nextEnabled && !nextTime) throw new Error(`Reminder time is required for "${h.habitName || "habit"}".`);

        if (prevEnabled === nextEnabled && prevTime === nextTime) continue;

        await updateHabit(id, {
          reminderEnabled: nextEnabled,
          reminderTime: nextEnabled ? nextTime : undefined
        });

        const changedFields: string[] = [];
        if (prevEnabled !== nextEnabled) changedFields.push("reminderEnabled");
        if (prevTime !== nextTime) changedFields.push("reminderTime");

        void createAuditEvent({
          entityType: "Habit",
          entityId: id,
          action: "update",
          changedFields,
          occurredAt: new Date().toISOString(),
          actorUserId
        }).catch(() => undefined);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "me"] });
      await queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
    onError: (caught) => {
      setError((caught as Error)?.message || "We couldn't save your notification settings. Your information is still here. Please try again.");
    }
  });

  const habits = habitsQuery.data ?? [];

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Notifications</h2>
          <p className="muted">Reminders and summaries.</p>
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="panel">
        <div className="panel-title"><Bell size={16} /> <span>Reminders</span></div>

        <div className="form-grid">
          <label className="form-field">
            <span>Daily reminder</span>
            <label className="muted inline-toggle">
              <input type="checkbox" checked={dailyEnabled} onChange={(e) => setDailyEnabled(e.target.checked)} />
              Enabled
            </label>
          </label>

          <label className="form-field">
            <span>Daily reminder time</span>
            <input type="time" value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} disabled={!dailyEnabled} />
          </label>

          <label className="form-field">
            <span>Quiet hours start</span>
            <input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />
          </label>

          <label className="form-field">
            <span>Quiet hours end</span>
            <input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />
          </label>
        </div>

        <label className="form-field">
          <span>Weekly summary</span>
          <label className="muted inline-toggle">
            <input type="checkbox" checked={weeklySummaryEnabled} onChange={(e) => setWeeklySummaryEnabled(e.target.checked)} />
            Enabled
          </label>
        </label>
      </div>

      <div className="panel">
        <div className="panel-title"><span>Habit reminders</span></div>
        {habits.length === 0 ? (
          <p className="muted">Create a habit to set a habit-specific reminder.</p>
        ) : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Habit</th>
                  <th>Reminder</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {habits.map((h) => {
                  const id = habitId(h);
                  const draft = habitDrafts[id];
                  const enabled = draft?.reminderEnabled ?? Boolean(h.reminderEnabled);
                  const time = draft?.reminderTime ?? ((h.reminderTime as string | undefined) || "09:00");
                  return (
                    <tr key={id}>
                      <td>{h.habitName || "Untitled habit"}</td>
                      <td>
                        <label className="muted inline-toggle">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => {
                              setHabitDrafts((prev) => ({
                                ...prev,
                                [id]: {
                                  reminderEnabled: e.target.checked,
                                  reminderTime: prev[id]?.reminderTime || time
                                }
                              }));
                            }}
                          />
                          Enabled
                        </label>
                      </td>
                      <td>
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => {
                            const value = e.target.value;
                            setHabitDrafts((prev) => ({
                              ...prev,
                              [id]: {
                                reminderEnabled: enabled,
                                reminderTime: value
                              }
                            }));
                          }}
                          disabled={!enabled}
                          aria-label={`Reminder time for ${h.habitName || "habit"}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="form-actions">
        <button
          className="primary-button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || settingsQuery.isLoading || habitsQuery.isLoading}
        >
          <Save size={16} /> {saveMutation.isPending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </section>
  );
}
