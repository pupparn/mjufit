"use client";

import QrScanner from "qr-scanner";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { th } from "@/messages/th";
import { scanAction, type ScanInput, type ScanResult } from "./actions";

const RESULT_MS = 3000;

export function KioskScanner() {
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  // One scan at a time; the result stays up for a few seconds, then the camera listens again.
  const submit = useCallback(async (input: ScanInput) => {
    if (busy.current) return;
    busy.current = true;
    let next: ScanResult;
    try {
      next = await scanAction(input);
    } catch {
      next = { ok: false, reason: "error" };
    }
    setResult(next);
    setTimeout(() => {
      setResult(null);
      busy.current = false;
    }, RESULT_MS);
  }, []);

  useEffect(() => {
    if (!video.current) return;
    const scanner = new QrScanner(video.current, (r) => void submit({ method: "qr", payload: r.data }), {
      preferredCamera: "environment",
      maxScansPerSecond: 5,
      highlightScanRegion: true,
    });
    scanner.start().catch(() => setCameraError(true));
    return () => scanner.destroy();
  }, [submit]);

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 bg-black p-4 text-white">
      <h1 className="text-2xl font-semibold">{th.kiosk.title}</h1>
      <p className="text-lg text-white/80">{th.kiosk.scanPrompt}</p>
      <video ref={video} className="aspect-square w-full max-w-md rounded-2xl bg-neutral-900 object-cover" muted playsInline />
      {cameraError && <p className="max-w-md text-center text-sm text-amber-300">{th.kiosk.cameraError}</p>}

      <form
        className="flex w-full max-w-md flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit({ method: "manual", studentId, code }));
          setCode("");
        }}
      >
        <p className="text-sm text-white/70">{th.kiosk.manualTitle}</p>
        <Input
          className="text-black dark:text-white"
          inputMode="numeric"
          placeholder={th.kiosk.studentId}
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        />
        <Input
          className="text-black dark:text-white"
          inputMode="numeric"
          placeholder={th.kiosk.code}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button type="submit" size="lg" disabled={pending || !studentId || !code}>
          {th.kiosk.submit}
        </Button>
      </form>

      {result && (
        <div
          role="status"
          className={`absolute inset-0 flex flex-col items-center justify-center gap-4 text-center ${
            result.ok ? "animate-in bg-green-600 fade-in zoom-in-95" : "animate-in bg-red-600 fade-in"
          }`}
        >
          <div className="text-8xl">{result.ok ? "🔓" : "⛔"}</div>
          <p className="text-4xl font-bold">
            {result.ok ? th.kiosk.open : th.kiosk.reasons[result.reason] ?? th.kiosk.reasons.error}
          </p>
          {result.ok && <p className="text-2xl">{th.kiosk.welcome(result.firstName)}</p>}
        </div>
      )}
    </main>
  );
}
