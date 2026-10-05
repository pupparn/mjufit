import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { localSupabase } from "./local-supabase";

// 1×1 transparent PNG; the mock verifier accepts any image.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test("student buys a Day Pass and enters through the kiosk with the backup code", async ({ browser }) => {
  const run = Date.now().toString().slice(-8);
  const studentId = `20${run}`;
  const studentEmail = `student-${run}@e2e.test`;
  const staffEmail = `staff-${run}@e2e.test`;

  // --- Student: sign in → consent → register → buy → mock slip "pass" → ticket
  const student = await (await browser.newContext()).newPage();
  await student.goto(`/auth/dev-login?email=${studentEmail}&name=${encodeURIComponent("สมชาย ใจดี")}`);
  await expect(student).toHaveURL(/\/onboarding\/consent/);
  await student.getByRole("button", { name: "ยอมรับและดำเนินการต่อ" }).click();

  await expect(student).toHaveURL(/\/onboarding\/register/);
  await student.getByLabel("รหัสนักศึกษา").fill(studentId);
  await expect(student.getByLabel("ชื่อ", { exact: true })).toHaveValue("สมชาย");
  await student.getByLabel("คณะ").selectOption({ index: 1 });
  await student.getByLabel("ชั้นปี").selectOption("2");
  await student.getByRole("button", { name: "ลงทะเบียน" }).click();

  await expect(student).toHaveURL(/\/me/);
  await student.getByRole("button", { name: /ซื้อ Day Pass วันนี้/ }).click();

  await expect(student).toHaveURL(/\/orders\//);
  await student.getByLabel("รูปสลิป").setInputFiles({ name: "slip.png", mimeType: "image/png", buffer: PNG });
  await student.getByRole("button", { name: "ส่งสลิป" }).click();
  await expect(student.getByText("ชำระเงินสำเร็จ")).toBeVisible();

  await student.goto("/ticket");
  const codeText = await student.locator("p.font-mono.tracking-\\[0\\.3em\\]").textContent();
  const code = (codeText ?? "").replace(/\s/g, "");
  expect(code).toMatch(/^\d{6}$/);

  // --- Staff: allowlisted → kiosk → manual entry → door opens
  const sb = localSupabase();
  const admin = createClient(sb.url, sb.secret, { auth: { persistSession: false } });
  const { error } = await admin.from("staff_members").insert({ email: staffEmail, role: "staff" });
  expect(error).toBeNull();

  const staff = await (await browser.newContext()).newPage();
  await staff.goto(`/auth/dev-login?email=${staffEmail}`);
  await expect(staff).toHaveURL(/\/dashboard/);
  await staff.goto("/kiosk");
  await staff.getByPlaceholder("รหัสนักศึกษา").fill(studentId);
  await staff.getByPlaceholder("รหัสสำรอง 6 หลัก").fill(code);
  await staff.getByRole("button", { name: "ตรวจสอบ" }).click();
  await expect(staff.getByText("ประตูเปิด")).toBeVisible();
  await expect(staff.getByText("สวัสดี สมชาย")).toBeVisible();
});
