import { Link, useMatchRoute } from "@tanstack/react-router";
import { type ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import Logo from "@/assets/logo-light.svg?react";
import BasicInfo from "@/components/BasicInfo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
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
 * The board interface's navigation: shadcn's `sidebar-03` block -- sections
 * with their pages always listed beneath them -- over `lib/navigation`.
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

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/info" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Logo className="size-5 fill-current" />
              </div>
              <BasicInfo />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navigation.map((section) => (
              <SidebarMenuItem key={section.title}>
                <SidebarMenuButton
                  render={<span />}
                  className="pointer-events-none font-medium"
                >
                  {t(section.title)}
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {section.items.map((item) => (
                    <SidebarMenuSubItem key={item.to}>
                      <SidebarMenuSubButton
                        isActive={Boolean(matchRoute({ to: item.to }))}
                        className={cn(
                          pulses(item.to, isFlashing, flashType) &&
                            "animate-pulse"
                        )}
                        render={
                          <Link
                            to={item.to}
                            viewTransition
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                          />
                        }
                      >
                        {t(item.label)}
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
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
