import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireArea } from "@/lib/auth/viewer";
import { th } from "@/messages/th";
import { GoogleSignInButton } from "./google-sign-in-button";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await requireArea("login");
  const { error } = await searchParams;

  return (
    <PageShell>
      <Card>
        <CardHeader>
          <CardTitle>{th.login.title}</CardTitle>
          <CardDescription>{th.login.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {th.login.error}
            </p>
          )}
          <GoogleSignInButton />
        </CardContent>
      </Card>
    </PageShell>
  );
}
