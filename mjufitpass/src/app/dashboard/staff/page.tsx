import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { th } from "@/messages/th";
import { removeStaffAction } from "./actions";
import { AddStaffForm } from "./staff-form";

export default async function StaffPage() {
  const viewer = await requireSuperAdmin();
  const { data, error } = await createAdminClient().from("staff_members").select("email, role").order("created_at");
  if (error) throw new Error(`load staff: ${error.message}`);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        {th.staff.nav.back}
      </Link>
      <h1 className="text-2xl font-semibold">{th.staff.admin.staffTitle}</h1>
      <AddStaffForm />
      <Card>
        <CardHeader>
          <CardTitle>Staff ({data.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.map((m) => (
            <div key={m.email} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span>
                {m.email} · {th.staff.roles[m.role]}
                {m.email === viewer.email && ` ${th.staff.admin.staffSelf}`}
              </span>
              {m.role === "staff" && (
                <form action={removeStaffAction}>
                  <input type="hidden" name="email" value={m.email} />
                  <Button type="submit" variant="destructive" size="sm">
                    {th.staff.admin.staffRemove}
                  </Button>
                </form>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
