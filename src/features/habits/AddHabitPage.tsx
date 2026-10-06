import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { Alert } from "../../shared/ui/Alert";
import { useNavigation } from "../../app/router/navigation";
import { useAuth } from "../../app/providers/AuthProvider";
import { createAuditEvent } from "../audit/auditApi";
import { createHabit } from "./habitsApi";
import { todayYmd } from "./schedule";
import type { HabitFrequencyType } from "./habitsApi";

const CATEGORIES = ["Health", "Fitness", "Learning", "Mindfulness", "Productivity", "Personal", "Other"] as const;
const ICONS = ["droplet", "dumbbell", "book", "lotus", "apple", "moon", "graduation-cap"] as const;
const COLORS = ["Water blue", "Exercise orange", "Reading purple", "Mindfulness pink"] as const;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type FieldErrors = Partial<Record<
  | "habitName"
  | "category"
  | "frequencyType"
  | "scheduledWeekdays"
  | "weeklyTarget"
  | "targetValue"
  | "reminderTime",
  string
>>;

export function AddHabitPage() {
  const { navigate } = useNavigation();
  const { claims } = useAuth();
  const queryClient = useQueryClient();

  const [habitName, setHabitName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Health");
  const [icon, setIcon] = useState<string>("");
  const [color, setColor] = useState<string>("");
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>("Daily");
  const [scheduledWeekdays, setScheduledWeekdays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [weeklyTarget, setWeeklyTarget] = useState<number>(3);
  const [targetEnabled, setTargetEnabled] = useState(false);
  const [targetValue, setTargetValue] = useState<number>(1);
  const [targetUnit, setTargetUnit] = useState<string>("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<string>("09:00");
  const [reminderDays, setReminderDays] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>(todayYmd());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState(false);

  const actorUserId = String((claims?.sub ?? claims?.userId ?? claims?.id ?? "") || "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const input = {
        habitName: habitName.trim(),
        description: description.trim() || undefined,
        category,
        icon: icon || undefined,
        color: color || undefined,
        frequencyType,
        scheduledWeekdays: frequencyType === "SelectedWeekdays" ? scheduledWeekdays : [],
        weeklyTarget: frequencyType === "WeeklyTarget" ? weeklyTarget : undefined,
        targetEnabled,
        targetValue: targetEnabled ? targetValue : undefined,
        targetUnit: targetEnabled ? (targetUnit.trim() || undefined) : undefined,
        reminderEnabled,
        reminderTime: reminderEnabled ? reminderTime : undefined,
        reminderDays: reminderEnabled ? (reminderDays.length ? reminderDays : scheduledWeekdays) : [],
        startDate,
        archived: false,
        archivedAt: undefined
      };

      const created = await createHabit(input);

      const createdId = String((created as { itemId?: string; ItemId?: string })?.itemId ?? (created as { ItemId?: string })?.ItemId ?? "");
      void createAuditEvent({
        entityType: "Habit",
        entityId: createdId,
        action: "create",
        changedFields: [],
        occurredAt: new Date().toISOString(),
        actorUserId
      }).catch(() => undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["habits"] });
      navigate("/app");
    }
  });

  function toggleWeekday(value: string) {
    setScheduledWeekdays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));
  }

  function toggleReminderDay(value: string) {
    setReminderDays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    const trimmedName = habitName.trim();

    if (!trimmedName) next.habitName = "Habit name can't be blank.";
    if (!category) next.category = "Category is required.";
    if (!frequencyType) next.frequencyType = "Frequency is required.";

    if (frequencyType === "SelectedWeekdays" && scheduledWeekdays.length === 0) {
      next.scheduledWeekdays = "Choose at least one day.";
    }
    if (frequencyType === "WeeklyTarget" && (!Number.isFinite(weeklyTarget) || weeklyTarget <= 0)) {
      next.weeklyTarget = "Weekly target must be greater than 0.";
    }
    if (targetEnabled && (!Number.isFinite(targetValue) || targetValue <= 0)) {
      next.targetValue = "Target must be greater than 0.";
    }
    if (reminderEnabled && !reminderTime) {
      next.reminderTime = "Reminder time is required.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(false);
    if (!validate()) return;
    try {
      await saveMutation.mutateAsync();
    } catch {
      setSaveError(true);
    }
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Add Habit</h2>
          <p className="muted">Set a name, schedule, and optional target or reminder.</p>
        </div>
      </div>

      {saveError ? (
        <Alert tone="error">We couldn't save this habit. Your information is still here. Please try again.</Alert>
      ) : null}

      <form className="panel" onSubmit={onSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>Habit name</span>
            <input value={habitName} onChange={(e) => setHabitName(e.target.value)} />
            {errors.habitName ? <span className="field-error">{errors.habitName}</span> : null}
          </label>

          <label className="form-field">
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category ? <span className="field-error">{errors.category}</span> : null}
          </label>

          <label className="form-field form-span-2">
            <span>Description (optional)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <label className="form-field">
            <span>Icon (optional)</span>
            <select value={icon} onChange={(e) => setIcon(e.target.value)}>
              <option value="">None</option>
              {ICONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Color (optional)</span>
            <select value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="">None</option>
              {COLORS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Frequency</span>
            <select value={frequencyType} onChange={(e) => setFrequencyType(e.target.value as HabitFrequencyType)}>
              <option value="Daily">Daily</option>
              <option value="SelectedWeekdays">Selected weekdays</option>
              <option value="WeeklyTarget">Weekly target</option>
            </select>
            {errors.frequencyType ? <span className="field-error">{errors.frequencyType}</span> : null}
          </label>

          <label className="form-field">
            <span>Start date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>

          {frequencyType === "SelectedWeekdays" ? (
            <div className="form-field form-span-2">
              <span>Scheduled weekdays</span>
              <div className="chips" aria-label="Scheduled weekdays">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={scheduledWeekdays.includes(d) ? "chip chip-active" : "chip"}
                    onClick={() => toggleWeekday(d)}
                    aria-pressed={scheduledWeekdays.includes(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
              {errors.scheduledWeekdays ? <span className="field-error">{errors.scheduledWeekdays}</span> : null}
            </div>
          ) : null}

          {frequencyType === "WeeklyTarget" ? (
            <label className="form-field">
              <span>Weekly target</span>
              <input type="number" min={1} value={weeklyTarget} onChange={(e) => setWeeklyTarget(Number(e.target.value))} />
              {errors.weeklyTarget ? <span className="field-error">{errors.weeklyTarget}</span> : null}
            </label>
          ) : null}

          <div className="form-field form-span-2">
            <span>Target (optional)</span>
            <label className="muted inline-toggle">
              <input type="checkbox" checked={targetEnabled} onChange={(e) => setTargetEnabled(e.target.checked)} />
              Enable target
            </label>
          </div>

          {targetEnabled ? (
            <>
              <label className="form-field">
                <span>Target value</span>
                <input type="number" min={1} value={targetValue} onChange={(e) => setTargetValue(Number(e.target.value))} />
                {errors.targetValue ? <span className="field-error">{errors.targetValue}</span> : null}
              </label>
              <label className="form-field">
                <span>Target unit (optional)</span>
                <input value={targetUnit} onChange={(e) => setTargetUnit(e.target.value)} placeholder="minutes, pages, glasses" />
              </label>
            </>
          ) : null}

          <div className="form-field form-span-2">
            <span>Reminder (optional)</span>
            <label className="muted inline-toggle">
              <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
              Enable reminder
            </label>
          </div>

          {reminderEnabled ? (
            <>
              <label className="form-field">
                <span>Reminder time</span>
                <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                {errors.reminderTime ? <span className="field-error">{errors.reminderTime}</span> : null}
              </label>
              <div className="form-field">
                <span>Reminder days (optional)</span>
                <div className="chips" aria-label="Reminder days">
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={reminderDays.includes(d) ? "chip chip-active" : "chip"}
                      onClick={() => toggleReminderDay(d)}
                      aria-pressed={reminderDays.includes(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <span className="muted">Defaults to scheduled days when left empty.</span>
              </div>
            </>
          ) : null}
        </div>

        <div className="form-actions">
          <button type="button" className="icon-button" onClick={() => navigate("/app")}>Cancel</button>
          <button className="primary-button" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Habit"}</button>
        </div>
      </form>
    </section>
  );
}
