import { z } from "zod";
import { studentIdSchema } from "./student-id";

// Best-effort list of Maejo University faculties/colleges/campuses.
// Verify against the university's official list; the DB doesn't constrain
// the value, so editing this array needs no migration.
export const FACULTIES = [
  "คณะผลิตกรรมการเกษตร",
  "คณะวิศวกรรมและอุตสาหกรรมเกษตร",
  "คณะวิทยาศาสตร์",
  "คณะบริหารธุรกิจ",
  "คณะเศรษฐศาสตร์",
  "คณะพัฒนาการท่องเที่ยว",
  "คณะศิลปศาสตร์",
  "คณะสารสนเทศและการสื่อสาร",
  "คณะสัตวศาสตร์และเทคโนโลยี",
  "คณะเทคโนโลยีการประมงและทรัพยากรทางน้ำ",
  "คณะสถาปัตยกรรมศาสตร์และการออกแบบสิ่งแวดล้อม",
  "วิทยาลัยพลังงานทดแทนและสมาร์ทกริดเทคโนโลยี",
  "วิทยาลัยบริหารศาสตร์",
  "อื่น ๆ",
] as const;

export const YEARS_OF_STUDY = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const nameSchema = z.string().trim().min(1, "required").max(100, "too_long");

export const registrationSchema = z.object({
  studentId: studentIdSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  faculty: z.enum(FACULTIES, { message: "required" }),
  yearOfStudy: z.coerce.number({ message: "required" }).int().min(1, "required").max(8, "required"),
});

export type Registration = z.infer<typeof registrationSchema>;
export type RegistrationField = keyof Registration;
export type RegistrationValues = Record<RegistrationField, string>;

export type RegistrationFormError =
  | "duplicate"
  | "already_registered"
  | "student_id_locked"
  | "consent_required"
  | "unknown";

/** Maps a Postgres error from register_student() to a form-level error. */
export function registrationErrorFromDb(error: { code?: string; message?: string }): RegistrationFormError {
  if (error.code === "23505") return "duplicate";
  const known = ["already_registered", "student_id_locked", "consent_required"] as const;
  return known.find((k) => error.message?.includes(k)) ?? "unknown";
}

/** Splits a Google display name into a first/last guess for prefilling. */
export function splitFullName(fullName: string | null): { firstName: string; lastName: string } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}
