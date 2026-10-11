import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { localSupabase } from "./local-supabase";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test("staff finds a slip to review via the tab and gets back to the filtered list", async ({ browser }, info) => {
  const run = Date.now().toString().slice(-8);
  const studentId = `21${run}`;
  const staffEmail = `staff-nav-${run}@e2e.test`;

  // --- Student whose slip fails → needs_review
  const student = await (await browser.newContext()).newPage();
  await student.goto(`/auth/dev-login?email=student-nav-${run}@e2e.test&name=${encodeURIComponent("สมหญิง ทดสอบ")}`);
  await student.getByRole("button", { name: "ยอมรับและดำเนินการต่อ" }).click();
  await student.getByLabel("รหัสนักศึกษา").fill(studentId);
  await student.getByLabel("คณะ").selectOption({ index: 1 });
  await student.getByLabel("ชั้นปี").selectOption("3");
  await student.getByRole("button", { name: "ลงทะเบียน" }).click();
  await student.getByRole("button", { name: /ซื้อ Day Pass วันนี้/ }).click();
  await expect(student).toHaveURL(/\/orders\//);
  await student.getByLabel("รูปสลิป").setInputFiles({ name: "slip.png", mimeType: "image/png", buffer: PNG });
  await student.getByLabel("ไม่ผ่าน (ยอดไม่ตรง)").check();
  await student.getByRole("button", { name: "ส่งสลิป" }).click();

  const sb = localSupabase();
  const admin = createClient(sb.url, sb.secret, { auth: { persistSession: false } });
  await expect
    .poll(async () => (await admin.from("orders").select("status, profiles!inner(student_id)").eq("profiles.student_id", studentId)).data?.[0]?.status)
    .toBe("needs_review");
  expect((await admin.from("staff_members").insert({ email: staffEmail, role: "staff" })).error).toBeNull();

  // --- Staff: tab → filtered list → order → back keeps the filter
  const staff = await (await browser.newContext()).newPage();
  const warnings: string[] = [];
  staff.on("console", (m) => m.text().includes("default value state") && warnings.push(m.text()));
  await staff.goto(`/auth/dev-login?email=${staffEmail}`);
  await expect(staff).toHaveURL(/\/dashboard$/);
  await staff.screenshot({ path: info.outputPath("1-overview.png"), fullPage: true });

  await staff.getByRole("link", { name: /^รอตรวจสอบ \(\d+\)$/ }).click();
  await expect(staff).toHaveURL(/\/dashboard\/buyers\?status=needs_review$/);
  await expect(staff.getByRole("link", { name: /^รอตรวจสอบ/ })).toHaveAttribute("aria-current", "page");

  await staff.getByPlaceholder("ค้นหา รหัสนักศึกษา / ชื่อ").fill(studentId);
  await staff.getByLabel("ทุกชั้นปี").selectOption("3");
  await staff.getByRole("button", { name: "กรอง" }).click();
  await expect(staff).toHaveURL(new RegExp(`q=${studentId}&status=needs_review&.*year=3`)); // native GET form keeps empty fields
  const row = staff.locator("div.rounded-lg.border", { hasText: studentId });
  await expect(row).toHaveCount(1);
  await expect(staff.getByRole("link", { name: /^รอตรวจสอบ/ })).toHaveAttribute("aria-current", "page"); // tabs survive a form submit
  await staff.screenshot({ path: info.outputPath("2-buyers-filtered.png"), fullPage: true });

  await row.getByRole("link", { name: "เปิด" }).click();
  await expect(staff).toHaveURL(/\/dashboard\/orders\/.+\?back=/);
  await staff.getByRole("link", { name: "← กลับ" }).click();
  await expect(staff).toHaveURL(new RegExp(`/dashboard/buyers\\?q=${studentId}&status=needs_review&year=3$`));

  // Client-side tab switch on the same route must reset the form, not keep stale defaults.
  await staff.getByRole("link", { name: "รายชื่อผู้ซื้อ", exact: true }).click();
  await expect(staff).toHaveURL(/\/dashboard\/buyers$/);
  await expect(staff.getByPlaceholder("ค้นหา รหัสนักศึกษา / ชื่อ")).toHaveValue("");
  await expect(staff.getByLabel("ทุกชั้นปี")).toHaveValue("");
  expect(warnings).toEqual([]);

  // Old bookmark still lands on the queue view; a hostile back link falls back to it too.
  await staff.goto("/dashboard/queue");
  await expect(staff).toHaveURL(/\/dashboard\/buyers\?status=needs_review$/);
  const orderUrl = await row.getByRole("link", { name: "เปิด" }).getAttribute("href");
  await staff.goto(`${orderUrl!.split("?")[0]}?back=https://evil.example`);
  await expect(staff.getByRole("link", { name: "← กลับ" })).toHaveAttribute("href", "/dashboard/buyers?status=needs_review");

  // Searching under "all" still finds an order the plain list hides (stuck/expired).
  expect((await admin.from("orders").update({ status: "expired" }).eq("id", orderUrl!.split("/").pop()!.split("?")[0])).error).toBeNull();
  await staff.goto(`/dashboard/buyers?q=${studentId}`);
  await expect(staff.getByText("หมดอายุ")).toBeVisible();
});
