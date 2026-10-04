"use server";

import { redirect } from "next/navigation";
import { AREA_PATHS } from "@/lib/auth/access";
import { requireArea } from "@/lib/auth/viewer";
import {
  registrationErrorFromDb,
  registrationSchema,
  type RegistrationField,
  type RegistrationFormError,
  type RegistrationValues,
} from "@/lib/registration";
import { createClient } from "@/lib/supabase/server";

export type RegisterFormState = {
  values: RegistrationValues;
  fieldErrors: Partial<Record<RegistrationField, string>>;
  error: RegistrationFormError | null;
};

const FIELDS: RegistrationField[] = ["studentId", "firstName", "lastName", "faculty", "yearOfStudy"];

export async function submitRegistration(
  prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const viewer = await requireArea("register");
  if (viewer.kind !== "student") return { ...prev, error: "unknown" };

  const values = Object.fromEntries(
    FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as RegistrationValues;
  // A student ID saved before registration existed stays locked.
  if (viewer.studentId) values.studentId = viewer.studentId;

  const parsed = registrationSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: RegisterFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as RegistrationField;
      fieldErrors[field] ??= issue.message;
    }
    return { values, fieldErrors, error: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_student", {
    p_student_id: parsed.data.studentId,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_faculty: parsed.data.faculty,
    p_year_of_study: parsed.data.yearOfStudy,
  });
  if (error) return { values, fieldErrors: {}, error: registrationErrorFromDb(error) };

  redirect(AREA_PATHS.student);
}
