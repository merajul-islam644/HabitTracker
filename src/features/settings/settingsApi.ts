import { blocksClient } from "../../lib/blocks/client";

export type AppearanceChoice = "Light" | "Dark" | "System";
export type WeekStartsOn = "Monday" | "Sunday";

export type Settings = {
  itemId?: string;
  ItemId?: string;

  appearance?: AppearanceChoice;
  language?: string;
  timezone?: string;
  weekStartsOn?: WeekStartsOn;

  dailyReminderEnabled?: boolean;
  dailyReminderTime?: string;
  weeklySummaryEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
};

export type SettingsInput = Omit<Settings, "itemId" | "ItemId">;

const settings = blocksClient.data.collection<Settings>("Settings", {
  fields: [
    "appearance",
    "language",
    "timezone",
    "weekStartsOn",
    "dailyReminderEnabled",
    "dailyReminderTime",
    "weeklySummaryEnabled",
    "quietHoursStart",
    "quietHoursEnd",
    "CreatedBy",
    "CreatedDate",
    "LastUpdatedDate"
  ]
});

export async function listMySettings(): Promise<Settings[]> {
  const response = await settings.list({ pageNo: 1, pageSize: 10 });
  const data = response as {
    data?: { getSettingss?: { items?: Settings[] } };
  };
  // Data gateway pluralizes by adding an extra 's' for 'Settings'.
  return data.data?.getSettingss?.items ?? [];
}

export async function upsertMySettings(input: SettingsInput): Promise<void> {
  const existing = await listMySettings();
  const first = existing[0];
  const id = (first as { itemId?: string; ItemId?: string } | undefined)?.itemId ?? (first as { ItemId?: string } | undefined)?.ItemId;
  if (id) {
    await settings.update(String(id), input);
  } else {
    await settings.create(input);
  }
}
