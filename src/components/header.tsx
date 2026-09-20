import { MenuIcon } from "lucide-react";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import Logo from "@/assets/logo-light.svg?react";
import BasicInfo from "@/components/BasicInfo";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { UserNav } from "@/components/user-nav";
import { useMediaQuery } from "@/hooks/use-media-query";

import NavigationLinks from "./navigation-links";

/**
 * The name of the board, the tabs, and who you are signed in as.
 *
 * Three widths, and the middle one is the compromise.
 *
 * **At `xl` and above** it is one bar: logo, name, the tabs inline, avatar.
 * The old arrangement cost 128 px of logo block and another 54 px of tab
 * strip before any page began -- measured on bmc-2 at 1280x800, 182 px of a
 * 800 px window, every tab, every time. The fleet paid it twice, once for its
 * own header and once for the board's.
 *
 * **Between `md` and `xl`** the strip stays. Seven tabs plus the board's name
 * do not fit beside each other at 768 px, and tabs that wrap are worse than
 * tabs on their own row. The header itself is still slimmer than it was.
 *
 * **Below `md`**, unchanged: logo, name, hamburger, tabs in the drawer.
 */
export default function Header() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const isWide = useMediaQuery("(min-width: 1280px)");
  const [isOpen, setIsOpen] = useState(false);

  if (isWide)
    return (
      <header className="flex w-full items-center gap-6 px-5 py-3 xl:w-300 xl:px-0">
        <div className="flex shrink-0 items-center gap-3">
          <Logo className="size-8 dark:fill-neutral-100" />
          <BasicInfo compact />
        </div>
        <NavigationLinks isDesktop inHeader />
        <div className="shrink-0">
          <UserNav />
        </div>
      </header>
    );

  if (isDesktop)
    return (
      <header className="flex w-full items-center justify-between px-5 py-4 xl:w-300 xl:px-0">
        <div className="flex items-center">
          <Logo className="mr-4 size-12 dark:fill-neutral-100" />
          <BasicInfo />
        </div>
        <UserNav />
      </header>
    );

  return (
    <header className="flex w-full items-center justify-between p-4 xl:w-300 xl:px-0">
      <div className="flex items-center">
        <Logo className="mr-4 size-12 dark:fill-neutral-100" />
        <p className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Turing Pi
        </p>
      </div>
      <Button
        variant="bwSquare"
        size="icon"
        className="md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MenuIcon />
      </Button>
      <Drawer
        direction="right"
        open={!isDesktop && isOpen}
        onOpenChange={(open) => setIsOpen(open)}
      >
        <DrawerContent className="h-full" direction="right">
          <DrawerHeader className="text-left">
            <DrawerTitle className="mt-1 mb-4 flex items-center justify-between">
              <span className="text-xl text-neutral-900 dark:text-neutral-200">
                {t("ui.navigation")}
              </span>
              <DrawerClose asChild>
                <Button type="button" variant="bwSquare" size="icon">
                  <XIcon />
                </Button>
              </DrawerClose>
            </DrawerTitle>
            <NavigationLinks
              isDesktop={isDesktop}
              onClick={() => setIsOpen(false)}
            />
          </DrawerHeader>
          <DrawerFooter className="items-end">
            <UserNav />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </header>
  );
}
