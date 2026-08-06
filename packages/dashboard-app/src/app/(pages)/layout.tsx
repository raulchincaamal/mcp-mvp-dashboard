"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  DashboardLayout,
  ThemeToggle,
  DropdownMenu,
  Avatar,
  Button,
} from "@macropaytd/lib-front-ui-components";
import { useT } from "@/shared/i18n";

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();

  const sidebarGroups = [
    {
      items: [
        { key: "home", label: t("nav.home") },
        { key: "dashboard", label: t("nav.dashboard") },
      ],
    },
  ];

  const activeKey = pathname === "/" ? "home" : pathname.replace("/", "");

  const sessionMenuItems = [
    { key: "profile", label: t("nav.profile"), onClick: () => {} },
    { key: "settings", label: t("nav.settings"), onClick: () => {} },
    { key: "logout", label: t("nav.logout"), danger: true, onClick: () => {} },
  ];

  const handleSelect = (key: string) => {
    const routes: Record<string, string> = {
      home: "/",
      dashboard: "/dashboard",
    };
    const route = routes[key];
    if (route) router.push(route);
  };

  return (
    <DashboardLayout
      sidebarGroups={sidebarGroups}
      sidebarHeader={<span className="text-lg font-bold">{t("nav.app_name")}</span>}
      sidebarFooter={
        <DropdownMenu
          trigger={
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar fallback="U" size="sm" />
            </Button>
          }
          items={sessionMenuItems}
          align="end"
        />
      }
      activeKey={activeKey}
      onSelect={handleSelect}
      headerTitle={t("nav.app_name")}
      headerActions={<ThemeToggle />}
      contentTransitionKey={pathname}
      contentTransition="fade"
    >
      {children}
    </DashboardLayout>
  );
}
