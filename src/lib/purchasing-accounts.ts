export function assertPurchasingDeletionAllowed(callerId: string, targetId: string, isInternalAudit: boolean, targetRoles: readonly string[]) {
  if (!isInternalAudit) throw new Error("Hanya Internal Audit dapat menghapus akun Pembelian.");
  if (callerId === targetId) throw new Error("Anda tidak dapat menghapus akun sendiri.");
  if (!targetRoles.includes("purchasing") || targetRoles.some(role => role !== "purchasing")) {
    throw new Error("Hanya akun khusus Pembelian yang dapat dihapus melalui menu ini.");
  }
}