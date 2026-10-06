import { BarChart3, Calendar, Home, PlusCircle, User } from "lucide-react";

export const navItems = [
  { href: "/app", labelKey: "nav.home", icon: Home },
  { href: "/app/stats", labelKey: "nav.stats", icon: BarChart3 },
  { href: "/app/habits/new", labelKey: "nav.addHabit", icon: PlusCircle },
  { href: "/app/calendar", labelKey: "nav.calendar", icon: Calendar },
  { href: "/app/profile", labelKey: "nav.profile", icon: User }
] as const;
