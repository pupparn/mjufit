import { z } from "zod";

// Keep in sync with the CHECK constraint and register_student() in
// supabase/migrations/.
export const STUDENT_ID_PATTERN = /^\d{8,10}$/;

export const studentIdSchema = z
  .string()
  .trim()
  .regex(STUDENT_ID_PATTERN, { message: "invalid_format" });
