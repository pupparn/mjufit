// What Slip2Go accepts (png/jpg/jpeg), within the `slips` bucket limits. 4 MB keeps the
// whole request under Vercel's 4.5 MB function body limit.
export const SLIP_MAX_BYTES = 4 * 1024 * 1024;

const SLIP_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const SLIP_ACCEPT = Object.keys(SLIP_TYPES).join(",");

export type SlipFileError = "missing" | "too_large" | "bad_type";

export function validateSlipFile(
  file: unknown,
): { ok: true; file: File; ext: string } | { ok: false; error: SlipFileError } {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "missing" };
  if (file.size > SLIP_MAX_BYTES) return { ok: false, error: "too_large" };
  const ext = SLIP_TYPES[file.type];
  if (!ext) return { ok: false, error: "bad_type" };
  return { ok: true, file, ext };
}
