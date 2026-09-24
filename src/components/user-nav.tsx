import { ChevronsUpDownIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { languages } from "@/locale";

/**
 * `signOutHref` and `name` exist because the fleet's session is not the
 * board's. On a board you are `root` with a token in local storage and
 * signing out means dropping it. In the fleet you are whoever dex says you
 * are, the bundle holds no token at all, and signing out means the proxy's
 * own sign-out endpoint -- calling the board's `logout()` there would clear
 * nothing and send you to a login page that does not exist.
 *
 * `inSidebar`: on a board it sits at the foot of the sidebar as a full-width
 * row -- avatar, name, chevron -- the way shadcn's sidebar blocks do it. The
 * fleet has no sidebar and keeps it as an avatar in its header.
 */
export function UserNav({
  signOutHref,
  name,
  inSidebar = false,
}: {
  signOutHref?: string;
  name?: string;
  inSidebar?: boolean;
} = {}) {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();

  const stored = useMemo(() => localStorage.getItem("username") ?? "root", []);
  const username = name ?? stored;

  const avatar = (
    <Avatar>
      <AvatarFallback>{username.charAt(0)}</AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu>
      {inSidebar ? (
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              size="lg"
              className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
            />
          }
        >
          {avatar}
          <span className="flex-1 truncate font-medium">{username}</span>
          <ChevronsUpDownIcon className="ml-auto" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label={username}
            />
          }
        >
          {avatar}
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        className="w-56"
        side={inSidebar ? "top" : "bottom"}
        align={inSidebar ? "start" : "end"}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{username}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("userNav.language")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={i18n.language}
                onValueChange={(value: string) =>
                  void i18n.changeLanguage(value)
                }
              >
                {Object.entries(languages).map(([key, value]) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {value}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("userNav.theme")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value: string) => setTheme(value)}
              >
                <DropdownMenuRadioItem value="system">
                  {t("userNav.themeSystem")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light">
                  {t("userNav.themeLight")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  {t("userNav.themeDark")}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {signOutHref ? (
            <DropdownMenuItem render={<a href={signOutHref} />}>
              {t("userNav.logout")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={logout}>
              {t("userNav.logout")}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
