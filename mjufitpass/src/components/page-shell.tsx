import { th } from "@/messages/th";

/** Centered single-column layout for the student-facing, mobile-first pages. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <p className="text-center text-lg font-semibold tracking-tight">{th.app.name}</p>
      {children}
    </main>
  );
}
