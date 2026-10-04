"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { th } from "@/messages/th";

export function GoogleSignInButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setPending(false);
      router.push("/login?error=oauth");
    }
  }

  return (
    <Button onClick={signIn} disabled={pending} size="lg" className="w-full">
      {pending ? th.login.redirecting : th.login.google}
    </Button>
  );
}
