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
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { languages } from "@/locale";

/**
 * `signOutHref` and `name` exist because the fleet's session is not the
 * board's. On a board you are `root` with a token in local storage and
 * signing out means dropping it. In the fleet you are whoever dex says you
 * are, the bundle holds no token at all, and signing out means the proxy's
 * own sign-out endpoint -- calling the board's `logout()` there would clear
 * nothing and send you to a login page that does not exist.
 */
export function UserNav({
  signOutHref,
  name,
}: {
  signOutHref?: string;
  name?: string;
} = {}) {
  const { theme, setTheme } = useTheme();
  const {
    t,
    i18n: { language, changeLanguage },
  } = useTranslation();
  const { logout } = useAuth();

  const stored = useMemo(() => localStorage.getItem("username") ?? "root", []);
  const username = name ?? stored;

  const handleLanguageChange = (value: string) => {
    void changeLanguage(value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="relative size-8 rounded-full focus:outline-hidden">
          <Avatar className="size-12">
            <AvatarFallback className="text-sm">
              {username.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm leading-none font-medium">{username}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("userNav.language")}
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={language}
                  onValueChange={handleLanguageChange}
                >
                  {Object.entries(languages).map(([key, value]) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      {value}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("userNav.theme")}
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
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
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {signOutHref ? (
          <DropdownMenuItem asChild>
            <a href={signOutHref}>{t("userNav.logout")}</a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={logout}>
            {t("userNav.logout")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
