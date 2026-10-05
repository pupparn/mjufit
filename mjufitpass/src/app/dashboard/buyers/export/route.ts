import { getViewer } from "@/lib/auth/viewer";
import { loadBuyers } from "@/lib/buyers";
import { formatBaht } from "@/lib/sales";
import { toCsv } from "@/lib/stats";
import { th } from "@/messages/th";

export async function GET(request: Request) {
  if ((await getViewer()).kind !== "staff") return new Response("Forbidden", { status: 403 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 50);
  const rows = await loadBuyers(q, 5000);
  const csv = toCsv([
    [...th.staff.buyers.csvHeader],
    ...rows.map((r) => [
      r.business_date,
      r.profiles?.student_id ?? null,
      r.profiles?.first_name ?? null,
      r.profiles?.last_name ?? null,
      r.profiles?.faculty ?? null,
      r.profiles?.year_of_study ?? null,
      formatBaht(r.amount_satang),
      r.status,
      r.refunded_at ? "คืนแล้ว" : r.refund_required ? "รอคืน" : "",
    ]),
  ]);
  // BOM so Excel reads Thai as UTF-8.
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="buyers.csv"',
    },
  });
}
