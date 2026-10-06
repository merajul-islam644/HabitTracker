import { useEffect, useState } from "react";
import { AppShell } from "../layout/AppShell";
import { RedirectIfAuthenticated, RequireAuth } from "./guards";
import { NavigationProvider } from "./navigation";
import { CallbackPage } from "../../features/auth/CallbackPage";
import { ErrorPage } from "../../features/auth/ErrorPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { NotFoundPage } from "../../features/auth/NotFoundPage";
import { CalendarPage } from "../../features/calendar/CalendarPage";
import { NotificationsPage } from "../../features/notifications/NotificationsPage";
import { AddHabitPage } from "../../features/habits/AddHabitPage";
import { HabitDetailsPage } from "../../features/habits/HabitDetailsPage";
import { SignedInLandingPage } from "../../features/home/SignedInLandingPage";
import { ProfilePage } from "../../features/profile/ProfilePage";
import { SettingsPage } from "../../features/settings/SettingsPage";
import { StatsPage } from "../../features/stats/StatsPage";
import { WelcomePage } from "../../features/welcome/WelcomePage";

const protectedRoutes = {
  "/app": SignedInLandingPage,
  "/app/stats": StatsPage,
  "/app/habits/new": AddHabitPage,
  "/app/habits/detail": HabitDetailsPage,
  "/app/calendar": CalendarPage,
  "/app/profile": ProfilePage,
  "/app/settings": SettingsPage,
  "/app/notifications": NotificationsPage
};

export function AppRouter() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextPath: string) {
    const [nextPathname = "/", queryString = ""] = nextPath.split("?");
    window.history.pushState({}, "", nextPath);
    setPath(nextPathname);
    setSearch(queryString ? `?${queryString}` : "");
  }

  if (path === "/login/callback") {
    return <CallbackPage onNavigate={navigate} />;
  }

  if (path === "/login") {
    const returnTo = new URLSearchParams(search).get("returnTo") || undefined;
    return (
      <RedirectIfAuthenticated onNavigate={navigate} to="/app">
        <LoginPage returnTo={returnTo} />
      </RedirectIfAuthenticated>
    );
  }

  if (path === "/") {
    return (
      <RedirectIfAuthenticated onNavigate={navigate} to="/app">
        <WelcomePage onNavigate={navigate} />
      </RedirectIfAuthenticated>
    );
  }

  if (path === "/error") {
    return <ErrorPage onNavigate={navigate} />;
  }

  const Page = protectedRoutes[path as keyof typeof protectedRoutes];
  if (!Page) {
    return <NotFoundPage onNavigate={navigate} />;
  }

  return (
    <RequireAuth currentPath={path} onNavigate={navigate}>
      <NavigationProvider value={{ navigate, path, search }}>
        <AppShell activePath={path} onNavigate={navigate}>
          <Page />
        </AppShell>
      </NavigationProvider>
    </RequireAuth>
  );
}
