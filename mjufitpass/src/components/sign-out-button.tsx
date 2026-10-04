import { Button } from "@/components/ui/button";
import { th } from "@/messages/th";

export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="outline" className="w-full">
        {th.common.signOut}
      </Button>
    </form>
  );
}
