import { getViewer } from "@/lib/auth/viewer";
import { appNow } from "@/lib/clock";
import { loadBuyers } from "@/lib/buyers";
import { formatBaht } from "@/lib/sales";
import { toCsv } from "@/lib/stats";
import { bangkokDate, bangkokTime } from "@/lib/time";
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
  const now = await appNow();
  const filename = `buyer_${bangkokDate(now)}_${bangkokTime(now).replace(":", "")}.csv`; // e.g. buyer_2026-10-05_0947.csv
  // BOM so Excel reads Thai as UTF-8.
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
