import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fetchSessionClaims, logout as endSession, logoutAll as endAllSessions, onSessionExpired, startLogin } from "../../lib/blocks/auth";

type AuthStatus = "authenticated" | "loading" | "unauthenticated";

type AuthContextValue = {
  claims: Record<string, unknown> | undefined;
  login: (returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refresh: () => Promise<void>;
  status: AuthStatus;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
// A long backup interval, not the primary signal -- polling auth/me every
// few seconds would hit IAM constantly even while the tab sits idle in the
// background. Regaining focus (below) is what actually needs to be prompt,
// e.g. after signing out in another tab or the session expiring meanwhile.
const STATUS_POLL_MS = 5 * 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [claims, setClaims] = useState<Record<string, unknown> | undefined>();

  // The session's source of truth is IAM's GET /iam/v4/auth/me, not a token
  // this app can inspect. In the default hosted login flow the session is a
  // Secure, httpOnly cookie, so a successful call here is what "signed in"
  // means.
  const refresh = useCallback(async () => {
    const sessionClaims = await fetchSessionClaims();
    setClaims(sessionClaims);
    setStatus(sessionClaims ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(refresh, STATUS_POLL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Fires when a reactive 401 forced a refresh and IAM rejected the refresh
  // token outright (invalid_grant). The session is already ended server-side;
  // this just gets the UI to notice and redirect.
  useEffect(() => onSessionExpired(() => void refresh()), [refresh]);

  const login = useCallback(async (returnTo?: string) => {
    await startLogin(returnTo);
  }, []);

  const logout = useCallback(async () => {
    await endSession();
    await refresh();
  }, [refresh]);

  const logoutAll = useCallback(async () => {
    await endAllSessions();
    await refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(() => ({
    claims,
    login,
    logout,
    logoutAll,
    refresh,
    status
  }), [claims, login, logout, logoutAll, refresh, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
