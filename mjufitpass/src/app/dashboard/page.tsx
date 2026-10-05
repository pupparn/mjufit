import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/auth/viewer";
import { th } from "@/messages/th";

export default async function DashboardPage() {
  const viewer = await requireArea("staff");
  if (viewer.kind !== "staff") return null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
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
      <nav className="flex flex-wrap gap-2">
        <Link href="/dashboard/queue" className={buttonVariants()}>
          {th.staff.nav.queue}
        </Link>
        <Link href="/kiosk" className={buttonVariants({ variant: "outline" })}>
          {th.staff.nav.kiosk}
        </Link>
        {viewer.role === "super_admin" && (
          <>
            <Link href="/dashboard/staff" className={buttonVariants({ variant: "outline" })}>
              {th.staff.nav.staff}
            </Link>
            <Link href="/dashboard/settings" className={buttonVariants({ variant: "outline" })}>
              {th.staff.nav.settings}
            </Link>
          </>
        )}
      </nav>
      <p className="text-muted-foreground">{th.staff.comingSoon}</p>
    </main>
  );
}
