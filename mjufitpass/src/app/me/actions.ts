"use server";

import { redirect } from "next/navigation";
import { AREA_PATHS } from "@/lib/auth/access";
import { requireArea } from "@/lib/auth/viewer";
import { appNow } from "@/lib/clock";
import { createOrder } from "@/lib/orders";

export async function startOrder() {
  const viewer = await requireArea("student");
  if (viewer.kind !== "student") return;

  const result = await createOrder(viewer.id, await appNow());
  // When sales are closed, /me already explains why.
  redirect(result.ok ? `/orders/${result.orderId}` : AREA_PATHS.student);
}
