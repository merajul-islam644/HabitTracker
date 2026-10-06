import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LogOut, Pencil, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { useAuth } from "../../app/providers/AuthProvider";
import { useNavigation } from "../../app/router/navigation";
import { Alert } from "../../shared/ui/Alert";
import { createAuditEvent } from "../audit/auditApi";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

type MeResponse = Awaited<ReturnType<typeof blocksClient.iam.me>>;

function displayNameFromMe(me: MeResponse | undefined): string {
  const data = (me as { data?: Record<string, unknown> } | undefined)?.data ?? {};
  const name = (data.name ?? data.displayName ?? data.fullName) as string | undefined;
  if (name && name.trim()) return name.trim();
  const firstName = String((data.firstName ?? "") || "").trim();
  const lastName = String((data.lastName ?? "") || "").trim();
  return [firstName, lastName].filter(Boolean).join(" ") || "Member";
}

function emailFromMe(me: MeResponse | undefined, fallbackClaims: Record<string, unknown> | undefined): string {
  const data = (me as { data?: Record<string, unknown> } | undefined)?.data ?? {};
  const email = (data.email ?? data.userName ?? data.username) as string | undefined;
  if (email && email.trim()) return email.trim();
  const claimEmail = (fallbackClaims?.email as string | undefined) ?? (fallbackClaims?.upn as string | undefined);
  return claimEmail?.trim() || "";
}

function rolesFromMe(me: MeResponse | undefined): string[] {
  const data = (me as { data?: Record<string, unknown> } | undefined)?.data ?? {};
  const roles = data.roles as unknown;
  if (!Array.isArray(roles)) return [];
  return roles
    .map((r) => {
      if (typeof r === "string") return r;
      if (r && typeof r === "object") {
        const name = (r as { name?: unknown; roleName?: unknown }).name ?? (r as { roleName?: unknown }).roleName;
        if (typeof name === "string") return name;
      }
      return "";
    })
    .map((r) => r.trim())
    .filter(Boolean);
}

export function ProfilePage() {
  const { t } = useT();
  const { claims, logout, logoutAll } = useAuth();
  const { navigate } = useNavigation();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["iam", "me"],
    queryFn: () => blocksClient.iam.me(),
    staleTime: 30_000
  });

  const displayName = useMemo(() => displayNameFromMe(meQuery.data), [meQuery.data]);
  const email = useMemo(() => emailFromMe(meQuery.data, claims), [meQuery.data, claims]);
  const roles = useMemo(() => rolesFromMe(meQuery.data), [meQuery.data]);

  const [editing, setEditing] = useState(false);
  const [nextDisplayName, setNextDisplayName] = useState(displayName);
  const [saveError, setSaveError] = useState<string | undefined>();
  const [changingPassword, setChangingPassword] = useState(false);
  const actorUserId = String((claims?.sub ?? claims?.userId ?? claims?.id ?? "") || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const trimmed = nextDisplayName.trim();
      if (!trimmed) throw new Error("Display name can't be blank.");

      // Tenant contracts vary; `name` is the conventional field for a display name.
      await blocksClient.iam.updateMe({ name: trimmed });

      void createAuditEvent({
        entityType: "User",
        entityId: actorUserId,
        action: "update",
        changedFields: ["displayName"],
        occurredAt: new Date().toISOString(),
        actorUserId
      }).catch(() => undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["iam", "me"] });
      setEditing(false);
      setSaveError(undefined);
    },
    onError: (error) => {
      setSaveError((error as Error)?.message || "We couldn't save your changes. Your information is still here. Please try again.");
    }
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await logout();
      navigate("/");
    }
  });

  const signOutAllMutation = useMutation({
    mutationFn: async () => {
      await logoutAll();
      navigate("/");
    }
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>{t("nav.profile")}</h2>
          <p className="muted">Your account details and security.</p>
        </div>
      </div>

      {meQuery.isLoading ? (
        <div className="panel">
          <div className="profile-card" aria-busy="true" aria-label="Loading profile">
            <span className="skeleton skeleton-avatar-lg" aria-hidden="true" />
            <div className="profile-heading">
              <span className="skeleton skeleton-line-lg" aria-hidden="true" />
              <span className="skeleton skeleton-line" aria-hidden="true" />
            </div>
          </div>
        </div>
      ) : meQuery.isError ? (
        <div className="error-state" role="alert">
          <span className="muted">We couldn't load your profile.</span>
          <button className="link-button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["iam", "me"] })}>Retry</button>
        </div>
      ) : (
        <>
          <div className="profile-card">
            <div className="avatar avatar-lg" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</div>
            <div className="profile-heading">
              <h3>{displayName}</h3>
              {email ? <span className="muted">{email}</span> : <span className="muted">Signed-in account</span>}
              {roles.length ? (
                <div className="chips" aria-label="Roles">
                  {roles.map((r) => (
                    <span key={r} className="chip">{r}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="topbar-spacer" />
            <button
              className="icon-button"
              onClick={() => {
                setNextDisplayName(displayName);
                setSaveError(undefined);
                setEditing(true);
              }}
            >
              <Pencil size={16} /> Edit name
            </button>
          </div>

          <div className="panel">
            <div className="panel-title"><Shield size={16} /> <span>Account</span></div>
            <p className="muted">Manage password and sessions for this account.</p>

            <div className="page-actions">
              <button className="icon-button" onClick={() => setChangingPassword(true)}>
                <KeyRound size={16} /> Change password
              </button>

              <button className="icon-button" onClick={() => signOutMutation.mutate()} disabled={signOutMutation.isPending}>
                <LogOut size={16} /> {signOutMutation.isPending ? "Signing out..." : "Sign out"}
              </button>

              <button className="icon-button" onClick={() => signOutAllMutation.mutate()} disabled={signOutAllMutation.isPending}>
                <LogOut size={16} /> {signOutAllMutation.isPending ? "Signing out..." : "Sign out on all devices"}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title"><span>Preferences</span></div>
            <div className="page-actions">
              <button className="icon-button" onClick={() => navigate("/app/settings")}>Settings</button>
              <button className="icon-button" onClick={() => navigate("/app/notifications")}>Notifications</button>
            </div>
          </div>
        </>
      )}

      {editing ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit display name">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit display name</h3>
              <button className="icon-button" type="button" onClick={() => setEditing(false)} aria-label="Close">
                Close
              </button>
            </div>
            <p>Choose the name you want to see across the app.</p>
            {saveError ? <Alert tone="error">{saveError}</Alert> : null}
            <label className="form-field">
              <span>Display name</span>
              <input value={nextDisplayName} onChange={(e) => setNextDisplayName(e.target.value)} />
            </label>
            <div className="modal-actions">
              <button className="icon-button" type="button" onClick={() => setEditing(false)} disabled={updateMutation.isPending}>Cancel</button>
              <button className="primary-button" type="button" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ChangePasswordDialog open={changingPassword} onClose={() => setChangingPassword(false)} />
    </section>
  );
}
