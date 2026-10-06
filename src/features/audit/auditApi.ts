import { blocksClient } from "../../lib/blocks/client";

export type AuditEntityType = "Habit" | "Completion" | "Settings" | "User";
export type AuditAction = "create" | "update" | "archive" | "delete";

export type AuditEvent = {
  itemId?: string;
  ItemId?: string;

  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  changedFields?: string[];
  occurredAt?: string;
  actorUserId?: string;
};

export type AuditEventInput = Omit<AuditEvent, "itemId" | "ItemId">;

const auditEvents = blocksClient.data.collection<AuditEvent>("AuditEvent", {
  fields: ["entityType", "entityId", "action", "changedFields", "occurredAt", "actorUserId", "CreatedBy", "CreatedDate"]
});

export function createAuditEvent(input: AuditEventInput) {
  return auditEvents.create(input);
}

export async function listAuditEvents(): Promise<AuditEvent[]> {
  const response = await auditEvents.list({ pageNo: 1, pageSize: 500 });
  const data = response as {
    data?: { getAuditEvents?: { items?: AuditEvent[] } };
  };
  return data.data?.getAuditEvents?.items ?? [];
}
