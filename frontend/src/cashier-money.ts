// Work in whole centavos so cash change never depends on floating-point subtraction.
export function centavos(value: string): number | null {
  if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function cashChange(tendered: string, due: string): string | null {
  const cash = centavos(tendered); const charge = centavos(due);
  if (cash === null || charge === null || cash < charge) return null;
  const change = cash - charge;
  return `${Math.floor(change / 100)}.${String(change % 100).padStart(2, "0")}`;
}
