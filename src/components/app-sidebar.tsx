import { Link, useMatchRoute } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { type ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import Logo from "@/assets/logo-light.svg?react";
import BasicInfo from "@/components/BasicInfo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserNav } from "@/components/user-nav";
import { useFlash } from "@/hooks/use-flash";
import { navigation, pulses } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * The board interface's navigation: shadcn's `sidebar-01` block -- the pages
 * grouped under their section's name -- over `lib/navigation`, with an icon
 * on each page and the pages that belong to one listed beneath it.
 *
 * The block's version switcher is the board itself: which board this is and
 * what it is running are how somebody knows they are typing into the right
 * window. Its search form is left out; eight pages do not need one. The
 * block has no footer, and the account menu needs a home, so it has one.
 *
 * On a phone the sidebar is a sheet, and it closes when a page is picked:
 * otherwise the page you asked for opens underneath the list you picked it
 * from.
 */
export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const { isFlashing, flashType } = useFlash();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnPhone = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/info" onClick={closeOnPhone} />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Logo className="size-5 fill-current" />
              </div>
              <BasicInfo />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navigation.map((section) => (
          <SidebarGroup key={section.title ?? "top"}>
            {section.title && (
              <SidebarGroupLabel>{t(section.title)}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) =>
                  item.external ? (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        render={
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer noopener"
                          />
                        }
                      >
                        <item.icon />
                        {t(item.title)}
                        <ExternalLinkIcon className="ml-auto text-muted-foreground" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={
                          item.url
                            ? Boolean(matchRoute({ to: item.url }))
                            : false
                        }
                        className={cn(
                          item.url &&
                            pulses(item.url, isFlashing, flashType) &&
                            "animate-pulse"
                        )}
                        render={
                          item.url ? (
                            <Link
                              to={item.url}
                              viewTransition
                              onClick={closeOnPhone}
                            />
                          ) : undefined
                        }
                      >
                        <item.icon />
                        {t(item.title)}
                      </SidebarMenuButton>
                      {item.items && (
                        <SidebarMenuSub>
                          {item.items.map((sub) => (
                            <SidebarMenuSubItem key={sub.url}>
                              <SidebarMenuSubButton
                                isActive={Boolean(matchRoute({ to: sub.url }))}
                                className={cn(
                                  pulses(sub.url, isFlashing, flashType) &&
                                    "animate-pulse"
                                )}
                                render={
                                  <Link
                                    to={sub.url}
                                    viewTransition
                                    onClick={closeOnPhone}
                                  />
                                }
                              >
                                {t(sub.title)}
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserNav inSidebar />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
