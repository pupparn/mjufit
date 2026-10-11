"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { th } from "@/messages/th";

export function DashboardTabs({ queueCount, superAdmin }: { queueCount: number; superAdmin: boolean }) {
  const path = usePathname();
  const status = useSearchParams().get("status");
  const review = path === "/dashboard/buyers" && status === "needs_review";
  const nav = th.staff.nav;
  const tabs = [
    { href: "/dashboard", label: nav.overview, active: path === "/dashboard" },
    { href: "/dashboard/buyers?status=needs_review", label: nav.needsReview(queueCount), active: review, alert: queueCount > 0 },
    { href: "/dashboard/buyers", label: nav.buyers, active: path === "/dashboard/buyers" && !review },
    ...(superAdmin
      ? [
          { href: "/dashboard/staff", label: nav.staff, active: path === "/dashboard/staff" },
          { href: "/dashboard/settings", label: nav.settings, active: path === "/dashboard/settings" },
        ]
      : []),
    { href: "/kiosk", label: nav.kiosk, active: false },
  ];

  return (
    <nav className="-mx-6 flex gap-1 overflow-x-auto border-b px-6">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
            t.active
              ? "border-primary font-medium text-foreground"
              : `border-transparent hover:text-foreground ${t.alert ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
