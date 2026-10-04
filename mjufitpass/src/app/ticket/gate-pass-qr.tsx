"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { createGatePass, createManualCode, msUntilNextStep, STEP_MS, timeStep } from "@/lib/tickets/gate-pass";
import { th } from "@/messages/th";

type Rendered = { step: number; svg: string; manualCode: string };

const clockFormat = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * Rotating gate QR, generated on the phone from the ticket secret, so it keeps
 * working without a connection once the page is open. `offsetMs` is the dev
 * clock shift (0 in production).
 */
export function GatePassQr({ ticketId, secret, offsetMs }: { ticketId: string; secret: string; offsetMs: number }) {
  const [now, setNow] = useState<number | null>(null);
  const [rendered, setRendered] = useState<Rendered | null>(null);

  useEffect(() => {
    let cancelled = false;
    let lastStep = -1;

    async function tick() {
      const nowMs = Date.now() + offsetMs;
      setNow(nowMs);
      const step = timeStep(nowMs);
      if (step === lastStep) return;
      lastStep = step;
      const [payload, manualCode] = await Promise.all([
        createGatePass(secret, ticketId, nowMs),
        createManualCode(secret, ticketId, nowMs),
      ]);
      const svg = await QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
      if (!cancelled) setRendered({ step, svg, manualCode });
    }

    tick();
    const timer = setInterval(tick, 250);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ticketId, secret, offsetMs]);

  if (now === null || rendered === null) {
    return <div className="aspect-square w-full max-w-72 animate-pulse rounded-xl bg-muted" />;
  }

  const secondsLeft = Math.ceil(msUntilNextStep(now) / 1000);
  const progress = msUntilNextStep(now) / STEP_MS;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div
        className="w-full max-w-72 rounded-xl bg-white p-3"
        role="img"
        aria-label="Gate pass QR"
        dangerouslySetInnerHTML={{ __html: rendered.svg }}
      />
      <div className="h-1.5 w-full max-w-72 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {th.ticket.refreshesIn(secondsLeft)}
      </p>
      {/* A live clock makes a forwarded screenshot obvious at a glance. */}
      <p className="font-mono text-3xl font-semibold tabular-nums">{clockFormat.format(now)}</p>
      <div className="text-center">
        <p className="text-xs text-muted-foreground">{th.ticket.manualCode}</p>
        <p className="font-mono text-xl tracking-[0.3em] tabular-nums">
          {rendered.manualCode.slice(0, 3)} {rendered.manualCode.slice(3)}
        </p>
      </div>
    </div>
  );
}
