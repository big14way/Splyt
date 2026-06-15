/**
 * Base-unit (BigInt) <-> human-readable string conversions.
 * Sui coins are u64 with a fixed decimals; we keep amounts as bigint internally
 * and only stringify at the UI edges.
 */

/** Format a base-unit bigint as a fixed-decimals human string (no thousands separator). */
export function formatBase(amount: bigint, decimals: number, dp = 4): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  if (dp <= 0) return (neg ? "-" : "") + whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, dp).replace(/0+$/, "");
  return (neg ? "-" : "") + whole.toString() + (fracStr ? "." + fracStr : "");
}

/** Format with comma-grouped whole part for compact display. */
export function formatBaseCompact(amount: bigint, decimals: number, dp = 4): string {
  const raw = formatBase(amount, decimals, dp);
  const [whole, frac] = raw.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}

/** Parse a human string (e.g. "1.25") into base units. Returns null if invalid. */
export function parseBase(input: string, decimals: number): bigint | null {
  const s = input.trim();
  if (!s) return null;
  if (!/^\d*\.?\d*$/.test(s) || s === "." || s === "") return null;
  const [whole = "0", frac = ""] = s.split(".");
  if (frac.length > decimals) return null;
  const padded = (frac + "0".repeat(decimals - frac.length)).slice(0, decimals);
  try {
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
  } catch {
    return null;
  }
}

export function bigintMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
