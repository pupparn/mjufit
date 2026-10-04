"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FACULTIES, YEARS_OF_STUDY, type RegistrationField, type RegistrationValues } from "@/lib/registration";
import { th } from "@/messages/th";
import { submitRegistration, type RegisterFormState } from "./actions";

const t = th.register;

// Native <select> (best on phones), styled to match <Input>.
const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30";

export function RegisterForm({
  initialValues,
  studentIdLocked,
}: {
  initialValues: RegistrationValues;
  studentIdLocked: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitRegistration, {
    values: initialValues,
    fieldErrors: {},
    error: null,
  } satisfies RegisterFormState);

  const fieldProps = (name: RegistrationField) => ({
    id: name,
    name,
    defaultValue: state.values[name],
    "aria-invalid": state.fieldErrors[name] ? true : undefined,
    "aria-describedby": state.fieldErrors[name] ? `${name}-error` : undefined,
  });

  const fieldError = (name: RegistrationField) =>
    state.fieldErrors[name] && (
      <p id={`${name}-error`} className="text-sm text-destructive">
        {t.fieldErrors[state.fieldErrors[name]] ?? t.fieldErrors.required}
      </p>
    );

  return (
    // key: remount on each result so defaultValue reflects the submitted values.
    <form key={JSON.stringify(state)} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="studentId">{t.fields.studentId}</Label>
        <Input
          {...fieldProps("studentId")}
          inputMode="numeric"
          autoComplete="off"
          placeholder={t.studentIdPlaceholder}
          readOnly={studentIdLocked}
          required
        />
        {studentIdLocked && <p className="text-xs text-muted-foreground">{t.studentIdLocked}</p>}
        {fieldError("studentId")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">{t.fields.firstName}</Label>
          <Input {...fieldProps("firstName")} autoComplete="given-name" maxLength={100} required />
          {fieldError("firstName")}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">{t.fields.lastName}</Label>
          <Input {...fieldProps("lastName")} autoComplete="family-name" maxLength={100} required />
          {fieldError("lastName")}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="faculty">{t.fields.faculty}</Label>
        <select {...fieldProps("faculty")} className={selectClass} required>
          <option value="" disabled>
            {t.facultyPlaceholder}
          </option>
          {FACULTIES.map((faculty) => (
            <option key={faculty} value={faculty}>
              {faculty}
            </option>
          ))}
        </select>
        {fieldError("faculty")}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="yearOfStudy">{t.fields.yearOfStudy}</Label>
        <select {...fieldProps("yearOfStudy")} className={selectClass} required>
          <option value="" disabled>
            {t.yearPlaceholder}
          </option>
          {YEARS_OF_STUDY.map((year) => (
            <option key={year} value={year}>
              {t.year(year)}
            </option>
          ))}
        </select>
        {fieldError("yearOfStudy")}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {t.errors[state.error]}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
