import { LogOut } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { useT } from "../../lib/i18n/LocalizationProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../../shared/ui/dropdown-menu";

export function UserMenu({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { logout } = useAuth();
  const { t } = useT();

  function handleLogout() {
    void logout();
    onNavigate("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="user-menu-trigger" aria-label="Open account menu">
        <span className="avatar avatar-sm" aria-hidden="true">H</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[280px]">
        <DropdownMenuLabel className="text-sm font-semibold">{t("app.name")}</DropdownMenuLabel>
        <DropdownMenuItem destructive onSelect={handleLogout}>
          <LogOut size={18} /> {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
