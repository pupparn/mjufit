"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { th } from "@/messages/th";

/** Re-renders the page when this order's row changes (e.g. staff review). */
export function OrderStatusWatcher({ orderId }: { orderId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, router]);

  return null;
}

function remaining(expiresAt: number, offsetMs: number) {
  return Math.max(0, Math.floor((expiresAt - (Date.now() + offsetMs)) / 1000));
}

/**
 * mm:ss until the order expires; refreshes the page when it hits zero.
 * `offsetMs` is the dev clock shift (0 in production).
 */
export function ExpiryCountdown({ expiresAt, offsetMs }: { expiresAt: string; offsetMs: number }) {
  const router = useRouter();
  const deadline = new Date(expiresAt).getTime();
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const left = remaining(deadline, offsetMs);
      setSeconds(left);
      if (left === 0) router.refresh();
      return left;
    };
    if (tick() === 0) return;
    const timer = setInterval(() => {
      if (tick() === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, offsetMs, router]);

  if (seconds === null) return null;
  if (seconds === 0) return <span className="font-medium text-destructive">{th.order.expiredNow}</span>;

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <span className="font-mono font-semibold tabular-nums">
      {mm}:{ss}
    </span>
  );
}
