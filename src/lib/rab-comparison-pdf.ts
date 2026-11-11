import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { numberedRabRows, rupiah, type OpnameItem } from "./stock-opname";
import { comparisonAmount, priceComparisons, readSuppliers, sourcePrice } from "./rab-pricing";
import reportStyles from "../styles.css?raw";

const reportColor = (token: string) => reportStyles.match(new RegExp(`--report-table-${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? "";
export function createRabComparisonPdf(header: { project_name: string; division_location: string; disposition_number: string; suppliers?: unknown }, items: OpnameItem[]) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFontSize(16); pdf.text("PERBANDINGAN HARGA RAB", 14, 16);
  pdf.setFontSize(10);
  autoTable(pdf, { startY: 21, theme: "plain", body: [["Proyek", header.project_name], ["Divisi / lokasi", header.division_location], ["No. disposisi", header.disposition_number]] });
  const comparisons = priceComparisons(items, readSuppliers(header.suppliers));
  // One estimate/supplier pair per table keeps an unlimited supplier list legible.
  for (const source of comparisons) {
    const previousEnd = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 35;
    let startY = previousEnd + 15;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
    const titleLines = pdf.splitTextToSize(source.name, 269) as string[];
    const titleHeight = titleLines.length * 5;
    if (startY + titleHeight + 30 > pdf.internal.pageSize.getHeight() - 14) {
      pdf.addPage(); startY = 20 + titleHeight;
    } else startY += titleHeight - 5;
    autoTable(pdf, { startY, margin: { top: 20 + titleHeight, bottom: 14, left: 14, right: 14 }, theme: "grid", styles: { fontSize: 9, cellPadding: 2, textColor: reportColor("text"), lineColor: reportColor("border") }, headStyles: { fillColor: reportColor(source.id === "estimate" ? "estimate-header" : "header"), textColor: reportColor(source.id === "estimate" ? "text" : "header-text") }, footStyles: { fillColor: reportColor("total"), textColor: reportColor("text") },
      willDrawPage: data => {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(reportColor("text"));
        pdf.text(titleLines, 14, (data.cursor?.y ?? startY) - titleHeight);
      },
      head: [["No.", "Uraian pengerjaan", "Status", "Jumlah", "Satuan", "Nilai / unit (Rp)", "Amount (Rp)"]],
      body: numberedRabRows(items).map(({ item, number, children }) => {
        const cancelled = item.is_cancelled || items.some(p => p.id === item.parent_id && p.is_cancelled);
        const price = sourcePrice(item, source.id), amount = comparisonAmount(item, source.id);
        return [number, item.description, cancelled ? "Batal" : "Aktif", children.length ? "" : String(item.quantity), children.length ? "" : item.unit, children.length ? "" : price === null ? "Belum diisi" : rupiah(price), children.length ? "" : cancelled ? "Tidak dihitung" : amount === null ? "Belum diisi" : rupiah(amount)];
      }),
      foot: [["", "Total item aktif sebelum diskon / PPN", "", "", "", "", source.complete ? rupiah(source.amount ?? 0) : "Belum lengkap"]], showFoot: "lastPage", columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 85 }, 5: { halign: "right" }, 6: { halign: "right" } },
    });
  }
  return pdf;
}
export function rabComparisonPdf(header: Parameters<typeof createRabComparisonPdf>[0], items: OpnameItem[]) {
  const name = header.project_name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "Project";
  createRabComparisonPdf(header, items).save(`Perbandingan Harga - ${name}.pdf`);
}