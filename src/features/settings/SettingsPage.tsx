import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { Alert } from "../../shared/ui/Alert";
import { createAuditEvent } from "../audit/auditApi";
import type { AppearanceChoice, SettingsInput, WeekStartsOn } from "./settingsApi";
import { listMySettings, upsertMySettings } from "./settingsApi";

function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function SettingsPage() {
  const { claims } = useAuth();
  const queryClient = useQueryClient();

  const actorUserId = String((claims?.sub ?? claims?.userId ?? claims?.id ?? "") || "");

  const settingsQuery = useQuery({
    queryKey: ["settings", "me"],
    queryFn: listMySettings,
    staleTime: 30_000
  });

  const current = settingsQuery.data?.[0];
  const currentInput = useMemo<SettingsInput>(() => ({
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

  const [appearance, setAppearance] = useState<AppearanceChoice>("System");
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStartsOn>("Monday");
  const [timezone, setTimezone] = useState<string>(defaultTimezone());
  const [saveError, setSaveError] = useState<string | undefined>();

  useEffect(() => {
    if (!settingsQuery.data) return;
    setAppearance((currentInput.appearance ?? "System") as AppearanceChoice);
    setWeekStartsOn((currentInput.weekStartsOn ?? "Monday") as WeekStartsOn);
    setTimezone(currentInput.timezone ?? defaultTimezone());
  }, [settingsQuery.data, currentInput]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveError(undefined);

      const next: SettingsInput = {
        ...currentInput,
        appearance,
        weekStartsOn,
        timezone: timezone.trim() || defaultTimezone()
      };

      const changedFields: string[] = [];
      if (next.appearance !== currentInput.appearance) changedFields.push("appearance");
      if (next.weekStartsOn !== currentInput.weekStartsOn) changedFields.push("weekStartsOn");
      if (next.timezone !== currentInput.timezone) changedFields.push("timezone");

      await upsertMySettings(next);

      void createAuditEvent({
        entityType: "Settings",
        entityId: "me",
        action: current ? "update" : "create",
        changedFields,
        occurredAt: new Date().toISOString(),
        actorUserId
      }).catch(() => undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "me"] });
    },
    onError: () => {
      setSaveError("We couldn't save your settings. Your information is still here. Please try again.");
    }
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p className="muted">Appearance and basic preferences.</p>
        </div>
      </div>

      {saveError ? <Alert tone="error">{saveError}</Alert> : null}

      <div className="panel">
        <div className="panel-title"><Palette size={16} /> <span>Appearance</span></div>
        <label className="form-field">
          <span>Theme</span>
          <select value={appearance} onChange={(e) => setAppearance(e.target.value as AppearanceChoice)}>
            <option value="Light">Light</option>
            <option value="Dark">Dark</option>
            <option value="System">System default</option>
          </select>
        </label>
      </div>

      <div className="panel">
        <div className="panel-title"><span>Preferences</span></div>
        <div className="form-grid">
          <label className="form-field">
            <span>Week starts on</span>
            <select value={weekStartsOn} onChange={(e) => setWeekStartsOn(e.target.value as WeekStartsOn)}>
              <option value="Monday">Monday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </label>

          <label className="form-field">
            <span>Language</span>
            <select value="English" disabled>
              <option value="English">English</option>
            </select>
          </label>

          <label className="form-field form-span-2">
            <span>Timezone</span>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. Europe/Zurich" />
          </label>
        </div>
      </div>

      <div className="form-actions">
        <button className="primary-button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || settingsQuery.isLoading}>
          <Save size={16} /> {saveMutation.isPending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </section>
  );
}
