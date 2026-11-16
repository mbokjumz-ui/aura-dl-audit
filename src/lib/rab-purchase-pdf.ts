import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { activeRabItems, numberedRabRows, groupAmount, lineAmount, rupiah } from "./stock-opname";
import { rabDiscountTotals } from "./rab-finalization";
import { purchaseEstimateTotal, type PurchaseSnapshot } from "./rab-purchase";
import reportStyles from "../styles.css?raw";

const color = (token: string) => reportStyles.match(new RegExp(`--report-table-${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? "";
export function createPurchaseRabPdf(snapshot: PurchaseSnapshot) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const rows = numberedRabRows(activeRabItems(snapshot.items));
  const totals = rabDiscountTotals(purchaseEstimateTotal(snapshot.items), false, snapshot.discount);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
  pdf.text("RAB PEMBELIAN", 105, 15, { align: "center" });
  autoTable(pdf, { startY: 20, theme: "plain", styles: { fontSize: 9, cellPadding: 1.5, textColor: color("text") }, body: [["Proyek", snapshot.project_name], ["Divisi / lokasi", snapshot.division_location], ["Nomor disposisi", snapshot.disposition_number], ["Penanggung jawab", snapshot.responsible_name], ["Auditor", snapshot.auditor_name]] });
  autoTable(pdf, {
    startY: (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50,
    margin: { left: 8, right: 8, top: 10, bottom: 12 }, theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, textColor: color("text"), lineColor: color("border"), lineWidth: 0.15 },
    headStyles: { fillColor: color("estimate-header"), textColor: color("text") },
    footStyles: { fillColor: color("total"), textColor: color("text") },
    head: [["No.", "Uraian pengerjaan", "Volume", "Satuan", "Harga perkiraan (Rp)", "Jumlah harga (Rp)"]],
    body: rows.map(({ item, number, children }) => [number, item.description, children.length ? "" : String(item.quantity), children.length ? "" : item.unit, children.length ? "" : rupiah(item.unit_price), rupiah(children.length ? groupAmount(children, "quantity") : lineAmount(item.quantity, item.unit_price))]),
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 62 }, 2: { halign: "right", cellWidth: 16 }, 3: { cellWidth: 18 }, 4: { halign: "right", cellWidth: 42 }, 5: { halign: "right", cellWidth: 46 } },
    foot: [
      [{ content: "Jumlah sebelum PPN", colSpan: 5 }, rupiah(totals.subtotal)],
      [{ content: `Diskon${snapshot.discount.discount_type === "percent" ? ` (${snapshot.discount.discount_value}%)` : ""}`, colSpan: 5 }, rupiah(totals.discount)],
      [{ content: "Grand Total sebelum PPN", colSpan: 5 }, rupiah(totals.total)],
    ], showFoot: "lastPage",
  });
  autoTable(pdf, { startY: ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80) + 8, theme: "plain", rowPageBreak: "avoid", styles: { halign: "center", fontSize: 9, minCellHeight: 25, textColor: color("text") }, body: [[`Disusun oleh\n\n\n${snapshot.responsible_name}`, "Disetujui oleh\n\n\n____________________"]] });
  return pdf;
}