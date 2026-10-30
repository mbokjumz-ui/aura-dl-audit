import { z } from "zod";

const name = z.string().trim().min(1, "Nama wajib diisi.").max(150);
const signatory = z.object({ name, position: z.string().trim().min(1, "Jabatan wajib diisi.").max(150) });
export const rabFinalizationSchema = z.object({
  vatIncluded: z.boolean(),
  contractors: z.array(z.object({ name, amount: z.number().finite().min(0).max(100000000000000) })).min(1).max(3),
  approvers: z.array(signatory).min(1).max(2),
  acknowledgers: z.array(signatory).min(1).max(2),
});
export type RabFinalization = z.infer<typeof rabFinalizationSchema>;
export type FinalizedRab = {
  finalized_at: string | null;
  vat_included: boolean;
  contractor_quotes: unknown;
  approvers: unknown;
  acknowledgers: unknown;
};
export function rabTaxTotals(subtotal: number, included: boolean) {
  const ppn = included ? Math.round(subtotal * 0.11 * 100) / 100 : 0;
  return { subtotal, ppn, total: Math.round((subtotal + ppn) * 100) / 100 };
}
export function readRabFinalization(rab: FinalizedRab): RabFinalization | null {
  const parsed = rabFinalizationSchema.safeParse({ vatIncluded: rab.vat_included, contractors: rab.contractor_quotes, approvers: rab.approvers, acknowledgers: rab.acknowledgers });
  return parsed.success ? parsed.data : null;
}