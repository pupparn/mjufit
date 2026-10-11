import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { requireArea } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { th } from "@/messages/th";
import { DashboardTabs } from "./dashboard-tabs";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const viewer = await requireArea("staff");
  if (viewer.kind !== "staff") return null;
  // ponytail: layouts don't re-render on client navigation, so the badge refreshes on staff
  // actions (revalidatePath) or reload; poll or use Realtime if live counts matter.
  const queue = await createAdminClient().from("orders").select("id", { count: "exact", head: true }).eq("status", "needs_review");
  if (queue.error) throw new Error(`dashboard layout: ${queue.error.message}`);

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 pt-8 pb-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{th.staff.title}</h1>
            <p className="text-sm text-muted-foreground">
              {viewer.email} · {th.staff.roles[viewer.role]}
            </p>
          </div>
          <div className="w-40">
            <SignOutButton />
          </div>
        </header>
        <Suspense>
          <DashboardTabs queueCount={queue.count ?? 0} superAdmin={viewer.role === "super_admin"} />
        </Suspense>
      </div>
      {children}
    </>
  );
}
