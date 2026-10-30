import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { numberedRabRows, groupAmount, lineAmount, rabTotals, rupiah, type OpnameItem } from "./stock-opname";
import { rabTaxTotals, readRabFinalization, type FinalizedRab } from "./rab-finalization";

type ReportHeader = {
  project_name: string; division_location: string; disposition_number: string;
  responsible_name: string; auditor_name: string; status: string; completed_at: string | null;
} & FinalizedRab;
export function stockOpnamePdf(header: ReportHeader, items: OpnameItem[], documents: { item_id: string; file_name: string }[]) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFontSize(18);
  pdf.text("AURA - Laporan Hasil Stock Opname", 14, 16);
  autoTable(pdf, {
    startY: 23, theme: "plain", styles: { fontSize: 10 },
    body: [
      ["Project", header.project_name, "Divisi / lokasi", header.division_location || "-"],
      ["Nomor disposisi", header.disposition_number || "-", "Penanggung jawab", header.responsible_name || "-"],
      ["Auditor", header.auditor_name || "-", "Status", header.status === "selesai" ? "Selesai" : "Berjalan"],
      ["Tanggal laporan", new Date().toLocaleDateString("id-ID"), "Tanggal selesai", header.completed_at ? new Date(header.completed_at).toLocaleDateString("id-ID") : "-"],
      ["Status RAB", header.finalized_at ? "Final / terkunci" : "Draft", "Tanggal finalisasi", header.finalized_at ? new Date(header.finalized_at).toLocaleDateString("id-ID") : "-"],
    ],
  });
  const rows = numberedRabRows(items).map(({ item: i, number, children }) => {
    const group = children.length > 0;
    const rab = group ? groupAmount(children, "quantity") : lineAmount(i.quantity, i.unit_price);
    const actual = group ? (children.some(c => c.actual_quantity !== null) ? groupAmount(children, "actual_quantity") : null) : i.actual_quantity === null ? null : lineAmount(i.actual_quantity, i.unit_price);
    return [number, i.description, group ? "" : i.quantity.toLocaleString("id-ID"), group ? "" : i.unit, group ? "" : rupiah(i.unit_price), rupiah(rab), group ? "" : i.actual_quantity === null ? "Belum diisi" : i.actual_quantity.toLocaleString("id-ID"), actual === null ? "-" : rupiah(actual), actual === null ? "-" : rupiah(actual - rab), documents.filter(d => d.item_id === i.id).map(d => d.file_name).join("\n") || "-"];
  });
  const totals = rabTotals(items);
  autoTable(pdf, {
    theme: "grid", styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    head: [["No.", "Uraian pengerjaan", "Jumlah RAB", "Satuan", "Nilai", "Amount RAB", "Jumlah riil", "Amount opname", "Selisih", "Lampiran"]],
    body: rows,
    foot: [["", "Total", "", "", "", rupiah(totals.rab), `${totals.counted}/${totals.total} diisi`, rupiah(totals.actual), rupiah(totals.difference), ""]],
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 45 }, 9: { cellWidth: 35 } },
    didDrawPage: () => {
      pdf.setFontSize(8);
      pdf.text(`AURA | Halaman ${pdf.getNumberOfPages()}`, 14, pdf.internal.pageSize.getHeight() - 8);
    },
  });
  const tax = rabTaxTotals(totals.rab, header.vat_included);
  autoTable(pdf, { theme: "plain", styles: { fontSize: 10 }, body: [["Total RAB sebelum PPN", rupiah(tax.subtotal)], [header.vat_included ? "PPN 11% (Include)" : "PPN (Exclude)", rupiah(tax.ppn)], ["Total akhir RAB", rupiah(tax.total)]] });
  const details = readRabFinalization(header);
  if (details) {
    autoTable(pdf, { theme: "grid", styles: { fontSize: 10 }, head: [["Kontraktor", "Penawaran sebelum PPN"]], body: details.contractors.map(c => [c.name, rupiah(c.amount)]) });
    autoTable(pdf, { theme: "grid", styles: { fontSize: 10, minCellHeight: 16 }, head: [["Kewenangan", "Nama", "Jabatan", "Tanda tangan"]], body: [...details.approvers.map(p => ["Menyetujui", p.name, p.position, ""]), ...details.acknowledgers.map(p => ["Mengetahui", p.name, p.position, ""])] });
  }
  const safeName = header.project_name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "Project";
  pdf.save(`Stock Opname - ${safeName}.pdf`);
}