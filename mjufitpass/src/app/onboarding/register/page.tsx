import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireArea } from "@/lib/auth/viewer";
import { splitFullName } from "@/lib/registration";
import { th } from "@/messages/th";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const viewer = await requireArea("register");
  if (viewer.kind !== "student") return null;

  // Prefill the name from Google; the student can correct it.
  const { firstName, lastName } = splitFullName(viewer.fullName);

  return (
    <PageShell>
      <Card>
        <CardHeader>
          <CardTitle>{th.register.title}</CardTitle>
          <CardDescription>{th.register.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm
            studentIdLocked={Boolean(viewer.studentId)}
            initialValues={{
              studentId: viewer.studentId ?? "",
              firstName,
              lastName,
              faculty: "",
              yearOfStudy: "",
            }}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
