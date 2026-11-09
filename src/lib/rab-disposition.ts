import { numberedRabRows, groupAmount, lineAmount, rabTotals, type OpnameItem } from "./stock-opname";
import { rabDiscountTotals, type FinalizedRab } from "./rab-finalization";

const digits = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
function integerWords(n: number): string {
  if (n < 12) return digits[n] ?? "";
  if (n < 20) return `${integerWords(n - 10)} belas`;
  if (n < 100) return `${integerWords(Math.floor(n / 10))} puluh ${integerWords(n % 10)}`.trim();
  if (n < 200) return `seratus ${integerWords(n - 100)}`.trim();
  if (n < 1000) return `${integerWords(Math.floor(n / 100))} ratus ${integerWords(n % 100)}`.trim();
  if (n < 2000) return `seribu ${integerWords(n - 1000)}`.trim();
  for (const [value, label] of [[1e12, "triliun"], [1e9, "miliar"], [1e6, "juta"], [1e3, "ribu"]] as const) {
    if (n >= value) return `${integerWords(Math.floor(n / value))} ${label} ${integerWords(n % value)}`.trim();
  }
  return "";
}
export function rupiahWords(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 100) throw new Error("Nilai terbilang di luar batas.");
  const cents = Math.round(value * 100);
  const whole = Math.floor(cents / 100), fraction = cents % 100;
  const words = `${whole === 0 ? "nol" : integerWords(whole)} rupiah${fraction ? ` ${integerWords(fraction)} sen` : ""}`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
export function dispositionAmounts(items: OpnameItem[], vatIncluded: boolean, discount: Pick<FinalizedRab, "discount_type" | "discount_value"> = {}) {
  return {
    rows: numberedRabRows(items).map(row => ({ ...row, amount: row.children.length ? groupAmount(row.children, "quantity") : lineAmount(row.item.quantity, row.item.unit_price) })),
    totals: rabDiscountTotals(rabTotals(items).rab, vatIncluded, discount),
  };
}