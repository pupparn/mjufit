import { appNow, clockOffsetMs, devClockEnabled } from "@/lib/clock";
import { bangkokDate, bangkokTime } from "@/lib/time";
import { setDevClock } from "./actions";

// Developer tool, not user-facing, so its copy stays out of messages/th.ts.
const PRESETS = [
  { value: "07:00", label: "07:00 before open" },
  { value: "19:25", label: "19:25 before cutoff" },
  { value: "19:35", label: "19:35 after cutoff" },
  { value: "20:05", label: "20:05 after close" },
];

function formatOffset(ms: number): string {
  const sign = ms < 0 ? "-" : "+";
  const minutes = Math.round(Math.abs(ms) / 60_000);
  return `${sign}${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Floating clock override, rendered only under `next dev`. */
export async function DevClockPanel() {
  if (!devClockEnabled()) return null;

  const [now, offset] = await Promise.all([appNow(), clockOffsetMs()]);
  const shifted = offset !== 0;
  const pickerValue = `${bangkokDate(now)}T${bangkokTime(now)}`;

  return (
    <details className="fixed right-3 bottom-3 z-50 w-72 rounded-xl border bg-background/95 text-xs shadow-lg backdrop-blur">
      <summary className="cursor-pointer list-none px-3 py-2 font-mono select-none">
        🕒 {bangkokDate(now)} {bangkokTime(now)}
        {shifted ? (
          <span className="ml-1 font-semibold text-amber-600">({formatOffset(offset)})</span>
        ) : (
          <span className="ml-1 text-muted-foreground">(real)</span>
        )}
      </summary>
      <form action={setDevClock} className="flex flex-col gap-2 border-t p-3">
        <p className="text-muted-foreground">Dev clock (Bangkok time). Affects sales, orders and expiry.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              name="preset"
              value={preset.value}
              className="rounded-md border px-2 py-1 text-left hover:bg-muted"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            type="datetime-local"
            name="at"
            defaultValue={pickerValue}
            className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1"
          />
          <button className="rounded-md border px-2 py-1 hover:bg-muted">Set</button>
        </div>
        {shifted && (
          <button name="preset" value="reset" className="rounded-md border px-2 py-1 hover:bg-muted">
            Reset to real time
          </button>
        )}
      </form>
    </details>
  );
}
