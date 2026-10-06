import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { Alert } from "../../shared/ui/Alert";

export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [openingHosted, setOpeningHosted] = useState(true);
  const [hostedUrl, setHostedUrl] = useState<string | undefined>();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | undefined>();

  const canUseEmbedded = useMemo(() => !openingHosted && !hostedUrl, [openingHosted, hostedUrl]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function resolveHostedUrl() {
      setError(undefined);
      setOpeningHosted(true);
      setHostedUrl(undefined);

      try {
        const config = await blocksClient.auth.idp.uiConfig();
        const record = config as Record<string, unknown>;

        // IAM tenants differ; accept a small set of common field shapes.
        const urlCandidate =
          (record.changePasswordUrl as string | undefined) ||
          (record.change_password_url as string | undefined) ||
          (record.changePasswordUri as string | undefined) ||
          (record.change_password_uri as string | undefined) ||
          (record.changePasswordLink as string | undefined) ||
          (record.change_password_link as string | undefined);

        const url = typeof urlCandidate === "string" ? urlCandidate.trim() : "";
        if (!cancelled && url) {
          setHostedUrl(url);
          // Hand off to IAM's hosted UI; it will return the user to the app.
          window.location.assign(url);
          return;
        }
      } catch {
        // Fall back to embedded flow below.
      } finally {
        if (!cancelled) setOpeningHosted(false);
      }
    }

    void resolveHostedUrl();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      setError(undefined);
      if (!oldPassword) throw new Error("Current password is required.");
      if (!newPassword) throw new Error("New password is required.");
      if (newPassword !== confirmPassword) throw new Error("Passwords don't match.");
      await blocksClient.auth.changePassword({ oldPassword, newPassword });
    },
    onSuccess: () => {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    },
    onError: (caught) => {
      setError((caught as Error)?.message || "We couldn't change your password. Please try again.");
    }
  });

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Change password">
      <div className="modal">
        <div className="modal-header">
          <h3>Change password</h3>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        {openingHosted ? (
          <>
            <p>Opening the password change screen…</p>
            <p className="muted">If nothing happens, you can use the in-app password change as a fallback.</p>
          </>
        ) : hostedUrl ? (
          <>
            <p>Redirecting…</p>
            <p className="muted">If you are not redirected automatically, try closing and opening again.</p>
          </>
        ) : (
          <>
            <p>Choose a new password for your account.</p>
            {error ? <Alert tone="error">{error}</Alert> : null}

            <div className="form-grid">
              <label className="form-field form-span-2">
                <span>Current password</span>
                <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password" />
              </label>

              <label className="form-field">
                <span>New password</span>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </label>

              <label className="form-field">
                <span>Confirm new password</span>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </label>
            </div>

            <div className="modal-actions">
              <button className="icon-button" type="button" onClick={onClose} disabled={mutation.isPending}>Cancel</button>
              <button className="primary-button" type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Update password"}
              </button>
            </div>
          </>
        )}

        {canUseEmbedded ? null : (
          <div className="modal-actions">
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                setOpeningHosted(false);
                setHostedUrl(undefined);
              }}
              disabled={openingHosted}
            >
              Use in-app change password
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
