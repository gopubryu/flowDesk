/** Korean-style thousand separators for money/qty display inputs. */

/** Format a number or digit string with commas: 2000000 -> "2,000,000". */
export function formatNumberWithComma(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "") return "";
  const raw =
    typeof value === "number"
      ? String(value)
      : String(value).replace(/,/g, "").trim();
  if (raw === "" || raw === "-") return raw;
  const num = Number(raw);
  if (!Number.isFinite(num)) return "";
  const negative = num < 0;
  const abs = Math.abs(num);
  const [intPart, decPart] = String(abs).split(".");
  const withComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = decPart !== undefined ? `${withComma}.${decPart}` : withComma;
  return negative ? `-${body}` : body;
}

/**
 * Strip commas / non-numeric noise from an input string.
 * Keeps digits and at most one decimal point (for qty/price).
 * Returns a plain digit string suitable for state storage.
 */
export function parseNumberInput(raw: string): string {
  const s = String(raw ?? "").replace(/,/g, "").trim();
  if (s === "") return "";
  let out = "";
  let seenDot = false;
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
    } else if (ch === "." && !seenDot) {
      out += ".";
      seenDot = true;
    }
  }
  return out;
}

/** Parse to a finite non-negative number; invalid -> 0. */
export function parseNonNegNumber(raw: string | number | null | undefined): number {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  }
  const n = Number(parseNumberInput(String(raw ?? "")));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}