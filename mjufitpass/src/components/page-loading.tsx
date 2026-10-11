import { th } from "@/messages/th";

/** Route-level loading indicator: a top progress bar plus a centered spinner. */
export function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
      <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-primary/15">
        <div className="h-full w-1/3 animate-[page-loading-bar_1.2s_ease-in-out_infinite] bg-primary" />
      </div>
      <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="text-sm text-muted-foreground">{th.app.loading}</p>
    </div>
  );
}
