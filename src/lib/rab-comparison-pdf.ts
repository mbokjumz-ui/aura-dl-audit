import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { numberedRabRows, rupiah, type OpnameItem } from "./stock-opname";
import { comparisonAmount, priceComparisons, readSuppliers, sourcePrice } from "./rab-pricing";
import { rabComparisonReport } from "./rab-comparison-report";
import type { FinalizedRab } from "./rab-finalization";
import reportStyles from "../styles.css?raw";

const reportColor = (token: string) => reportStyles.match(new RegExp(`--report-table-${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? "";
export function createRabComparisonPdf(header: { project_name: string; division_location: string; disposition_number: string } & Pick<FinalizedRab, "suppliers" | "discount_type" | "discount_value">, items: OpnameItem[]) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 5;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
  pdf.text("PERBANDINGAN HARGA RAB", pdf.internal.pageSize.getWidth() / 2, 10, { align: "center" });
  autoTable(pdf, { startY: 13, margin: { left: margin, right: margin }, theme: "plain", styles: { fontSize: 8, cellPadding: 1, textColor: reportColor("text") }, body: [["Proyek", header.project_name], ["Divisi / lokasi", header.division_location], ["No. disposisi", header.disposition_number]] });
  const comparisons = rabComparisonReport(items, header);
  const rows = numberedRabRows(items);
  const priceWidth = Math.max(25, (width - 36) / (comparisons.length * 2));
  const columnStyles: Record<number, { cellWidth: number; halign?: "right" }> = { 0: { cellWidth: 12 }, 1: { cellWidth: 12, halign: "right" }, 2: { cellWidth: 12 } };
  comparisons.forEach((_, index) => {
    columnStyles[3 + index * 2] = { cellWidth: priceWidth, halign: "right" };
    columnStyles[4 + index * 2] = { cellWidth: priceWidth, halign: "right" };
  });
  const summaryRow = (label: string, key: "subtotal" | "discount" | "total") => [
    { content: label, colSpan: 3 },
    ...comparisons.flatMap(source => ["", source.totals === null ? "Belum lengkap" : rupiah(source.totals[key])]),
  ];
  autoTable(pdf, {
    startY: ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30) + 2,
    margin: { top: margin, bottom: 9, left: margin, right: margin },
    theme: "grid", styles: { fontSize: 7, cellPadding: 1.2, overflow: "linebreak", valign: "middle", textColor: reportColor("text"), lineColor: reportColor("border"), lineWidth: 0.15 },
    headStyles: { fillColor: reportColor("header"), textColor: reportColor("header-text"), halign: "center" },
    footStyles: { fillColor: reportColor("total"), textColor: reportColor("text"), halign: "right" },
    head: [[{ content: "No.", rowSpan: 2 }, { content: "Volume", rowSpan: 2 }, { content: "Satuan", rowSpan: 2 }, ...comparisons.map(source => ({ content: source.id === "estimate" ? "RAB / Perkiraan Pembelian" : source.name, colSpan: 2 }))], comparisons.flatMap(() => ["Harga (Rp.)", "Jumlah Harga (Rp.)"])],
    body: rows.map(({ item, number, children }) => {
      const cancelled = item.is_cancelled || items.some(p => p.id === item.parent_id && p.is_cancelled);
      return [cancelled ? `${number}\nBatal` : number, children.length ? "" : String(item.quantity), children.length ? "" : item.unit,
        ...comparisons.flatMap(source => {
          if (children.length) return ["", ""];
          const price = sourcePrice(item, source.id), amount = comparisonAmount(item, source.id);
          return [price === null ? "Belum diisi" : rupiah(price), cancelled ? "Tidak dihitung" : amount === null ? "Belum diisi" : rupiah(amount)];
        })];
    }),
    foot: [summaryRow("Jumlah", "subtotal"), summaryRow("Diskon", "discount"), summaryRow("Grand Total", "total")],
    showFoot: "lastPage", columnStyles,
    horizontalPageBreak: true, horizontalPageBreakRepeat: [0, 1, 2, 3, 4], horizontalPageBreakBehaviour: "afterAllRows",
    didParseCell: data => {
      if (data.section === "head" && (data.column.index === 3 || data.column.index === 4)) {
        data.cell.styles.fillColor = reportColor("estimate-header");
        data.cell.styles.textColor = reportColor("text");
      }
      if (data.section === "body" && rows[data.row.index]?.children.length) {
        data.cell.styles.fillColor = reportColor("parent"); data.cell.styles.fontStyle = "bold";
      }
    },
  });
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
    pdf.text(`AURA | Perbandingan sebelum PPN | Halaman ${page} dari ${pdf.getNumberOfPages()}`, margin, pdf.internal.pageSize.getHeight() - 4);
  }
  return pdf;
}
export function rabComparisonPdf(header: Parameters<typeof createRabComparisonPdf>[0], items: OpnameItem[]) {
  const name = header.project_name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "Project";
  createRabComparisonPdf(header, items).save(`Perbandingan Harga - ${name}.pdf`);
}