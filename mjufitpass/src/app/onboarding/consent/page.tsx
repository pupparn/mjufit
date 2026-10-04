import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requireArea } from "@/lib/auth/viewer";
import { th } from "@/messages/th";
import { acceptConsent } from "./actions";

export default async function ConsentPage() {
  await requireArea("consent");

  return (
    <PageShell>
      <Card>
        <CardHeader>
          <CardTitle>{th.consent.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>{th.consent.intro}</p>
          <ul className="list-disc space-y-1 pl-5">
            {th.consent.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-muted-foreground">{th.consent.usage}</p>
        </CardContent>
        <CardFooter>
          <form action={acceptConsent} className="w-full">
            <Button type="submit" size="lg" className="w-full">
              {th.consent.accept}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </PageShell>
  );
}
