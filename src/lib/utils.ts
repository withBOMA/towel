/** Only allow same-site relative redirect targets (blocks open redirects). */
export function safeNext(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "") || "org";
}

/** Build a path with query params, e.g. withParams("/login", { error: "x" }). */
export function withParams(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const CANADIAN_TIMEZONES = [
  { value: "America/St_Johns", label: "Newfoundland" },
  { value: "America/Halifax", label: "Atlantic" },
  { value: "America/Toronto", label: "Eastern" },
  { value: "America/Winnipeg", label: "Central (Manitoba)" },
  { value: "America/Regina", label: "Saskatchewan" },
  { value: "America/Edmonton", label: "Mountain" },
  { value: "America/Vancouver", label: "Pacific" },
] as const;
