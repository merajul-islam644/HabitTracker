import { blocksClient } from "../../lib/blocks/client";

export type Completion = {
  itemId?: string;
  ItemId?: string;

  habitId?: string;
  habitDateKey?: string;
  scheduledDate?: string;
  completedAt?: string;
  note?: string;
};

export type CompletionInput = Omit<Completion, "itemId" | "ItemId">;

const completions = blocksClient.data.collection<Completion>("Completion", {
  fields: ["habitId", "habitDateKey", "scheduledDate", "completedAt", "note", "CreatedBy", "CreatedDate"]
});

export async function listCompletions(): Promise<Completion[]> {
  const response = await completions.list({ pageNo: 1, pageSize: 500 });
  const data = response as {
    data?: { getCompletions?: { items?: Completion[] } };
  };
  return data.data?.getCompletions?.items ?? [];
}

export function createCompletion(input: CompletionInput) {
  return completions.create(input);
}

export function deleteCompletion(completionId: string) {
  return completions.delete(completionId);
}

export function completionId(completion: Completion): string {
  const id = completion.itemId ?? completion.ItemId;
  if (!id) throw new Error("Completion id is missing.");
  return String(id);
}
