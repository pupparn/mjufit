"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/viewer";
import { appNow } from "@/lib/clock";
import { getOwnOrder, submitSlip } from "@/lib/orders";
import { slipVerifierFor } from "@/lib/payments/config";
import { validateSlipFile } from "@/lib/payments/slip-file";
import { th } from "@/messages/th";

export type SlipFormState = { error: string | null };

export async function submitSlipAction(
  orderId: string,
  _prev: SlipFormState,
  formData: FormData,
): Promise<SlipFormState> {
  const viewer = await requireArea("student");
  if (viewer.kind !== "student") return { error: th.order.errors.unknown };

  const order = await getOwnOrder(viewer.id, orderId);
  if (!order) return { error: th.order.errors.unknown };

  const file = validateSlipFile(formData.get("slip"));
  if (!file.ok) return { error: th.order.errors[file.error] };

  const now = await appNow();
  const result = await submitSlip({
    order,
    file: file.file,
    ext: file.ext,
    verifier: slipVerifierFor(formData, now),
    now,
  });

  if (!result.ok) {
    if (result.error === "reupload") {
      return { error: th.order.errors.reupload[result.detail ?? ""] ?? th.order.errors.unknown };
    }
    revalidatePath(`/orders/${orderId}`);
    return { error: th.order.errors[result.error] };
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/me");
  return { error: null };
}
