import { createContext, useContext } from "react";
import type { ReactNode } from "react";

type AppNavigation = {
  navigate: (path: string) => void;
  path: string;
  search: string;
};

const NavigationContext = createContext<AppNavigation | undefined>(undefined);

export function NavigationProvider({ value, children }: { value: AppNavigation; children: ReactNode }) {
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): AppNavigation {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("useNavigation must be used within NavigationProvider");
  return context;
}
