"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { DEV_CLOCK_COOKIE, devClockEnabled } from "@/lib/clock";
import { bangkokDate } from "@/lib/time";

/** "2026-10-05T19:35" read as Bangkok wall-clock time. */
function parseBangkok(local: string): Date | null {
  const date = new Date(`${local.length === 16 ? `${local}:00` : local}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function setDevClock(formData: FormData) {
  if (!devClockEnabled()) throw new Error("Dev clock is only available in development");

  const store = await cookies();
  const preset = String(formData.get("preset") ?? "");

  if (preset === "reset") {
    store.delete(DEV_CLOCK_COOKIE);
  } else {
    // Presets ("19:35") apply to today's real Bangkok date; otherwise use the picker.
    const target = preset
      ? parseBangkok(`${bangkokDate(new Date())}T${preset}`)
      : parseBangkok(String(formData.get("at") ?? ""));
    if (!target) return;
    store.set(DEV_CLOCK_COOKIE, String(target.getTime() - Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  revalidatePath("/", "layout");
}
