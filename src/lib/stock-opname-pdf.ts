import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { rupiah, type OpnameItem } from "./stock-opname";
import { type FinalizedRab } from "./rab-finalization";
import { stockOpnameReport } from "./stock-opname-report";
import { readSuppliers } from "./rab-pricing";
import reportStyles from "../styles.css?raw";

type ReportHeader = {
  project_name: string; division_location: string; disposition_number: string;
  responsible_name: string; auditor_name: string; status: string; completed_at: string | null;
} & FinalizedRab;
const reportColor = (token: string) => reportStyles.match(new RegExp(`--report-table-${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? "";
const number = (value: number) => value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const percent = (value: number) => `${number(value)}%`;

export function createStockOpnamePdf(header: ReportHeader, items: OpnameItem[], documents: { item_id: string; file_name: string }[]) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const { rows, disposition, opname, discountPercent, workPercent } = stockOpnameReport(items, header);
  const margin = 14;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(reportColor("text"));
  const title = pdf.splitTextToSize(`Berita Acara Stok Opname Pekerjaan ${header.project_name} di ${header.division_location || "-"}`, width) as string[];
  pdf.text(title, pdf.internal.pageSize.getWidth() / 2, 16, { align: "center" });
  const lastY = () => (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30;
  autoTable(pdf, {
    startY: 20 + title.length * 6, theme: "plain", styles: { fontSize: 9, textColor: reportColor("text") },
    body: [
      ["Nomor disposisi", header.disposition_number || "-", "Penanggung jawab", header.responsible_name || "-"],
      ["Auditor", header.auditor_name || "-", "Status", header.status === "selesai" ? "Selesai" : "Berjalan"],
      ["Tanggal laporan", new Date().toLocaleDateString("id-ID"), "Tanggal selesai", header.completed_at ? new Date(header.completed_at).toLocaleDateString("id-ID") : "-"],
      ["Status RAB", header.finalized_at ? "Final / terkunci" : "Draft", "Tanggal finalisasi", header.finalized_at ? new Date(header.finalized_at).toLocaleDateString("id-ID") : "-"],
    ],
  });
  const summaryRow = (label: string, left: number, right: number) => [
    { content: label, colSpan: 7, styles: { halign: "right" as const } }, rupiah(left), rupiah(right),
  ];
  autoTable(pdf, {
    startY: lastY() + 4, margin: { left: margin, right: margin, top: 14, bottom: 14 },
    theme: "grid", styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak", textColor: reportColor("text"), lineColor: reportColor("border"), lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: reportColor("header"), textColor: reportColor("header-text"), halign: "center" },
    footStyles: { fillColor: reportColor("total"), textColor: reportColor("text"), halign: "right" },
    head: [[
      { content: "No.", rowSpan: 2 }, { content: "Uraian Pekerjaan", rowSpan: 2 }, { content: "Satuan", rowSpan: 2 },
      { content: "Volume", colSpan: 3 }, { content: "Harga Satuan (Rp.)", rowSpan: 2 },
      { content: "Jumlah Harga Disposisi (Rp.)", rowSpan: 2 }, { content: "Jumlah Harga Stok Opname (Rp.)", rowSpan: 2 },
    ], ["Disposisi", "Opname", "%"]],
    body: rows.map(({ item, number: rowNumber, children, level, dispositionAmount, opnameAmount, volumePercent }) => [
      rowNumber, `${level ? "   " : ""}${item.description}`, children.length ? "" : item.unit,
      children.length ? "" : number(item.quantity), children.length ? "" : item.actual_quantity === null ? "Belum diisi" : number(item.actual_quantity),
      volumePercent === null ? "-" : percent(volumePercent), children.length ? "" : rupiah(item.unit_price),
      rupiah(dispositionAmount), opnameAmount === null ? "-" : rupiah(opnameAmount),
    ]),
    foot: [summaryRow("Total", disposition.subtotal, opname.subtotal), summaryRow("Diskon (Rupiah)", disposition.discount, opname.discount),
      summaryRow("Total Setelah Diskon", disposition.netSubtotal, opname.netSubtotal),
      summaryRow(header.vat_included ? "PPN 11%" : "PPN 11% (Exclude)", disposition.ppn, opname.ppn), summaryRow("Grand Total", disposition.total, opname.total)],
    showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 67 }, 2: { cellWidth: 16 }, 3: { cellWidth: 20, halign: "right" }, 4: { cellWidth: 20, halign: "right" }, 5: { cellWidth: 16, halign: "right" }, 6: { cellWidth: 35, halign: "right" }, 7: { cellWidth: 41, halign: "right" }, 8: { halign: "right" } },
    didParseCell: data => {
      if (data.section === "body" && rows[data.row.index]?.children.length) {
        data.cell.styles.fillColor = reportColor("parent");
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  autoTable(pdf, { startY: lastY() + 5, theme: "grid", styles: { fontSize: 9, textColor: reportColor("text"), lineColor: reportColor("border") },
    body: [["Persentase Diskon", percent(discountPercent)], ["Prestasi Kerja", percent(workPercent)]], columnStyles: { 0: { cellWidth: 65 } } });
  const supplierName = readSuppliers(header.suppliers).find(s => s.id === header.selected_price_source)?.name ?? "Perkiraan Pembelian";
  let y = lastY() + 9;
  const signatories = [
    { role: "Pimpinan Internal Audit", name: "Suyatno" }, { role: "GM Pembelian", name: "Suyatno" },
    { role: "Auditor Proyek", name: header.auditor_name || "-" }, { role: "Supervisor", name: "Cahyo" },
    { role: "Purchasing", name: header.responsible_name || "-" },
  ];
  const cellWidth = width / signatories.length;
  pdf.setFontSize(9);
  const roles = signatories.map(p => pdf.splitTextToSize(p.role, cellWidth - 4) as string[]);
  const names = signatories.map(p => pdf.splitTextToSize(p.name, cellWidth - 4) as string[]);
  const closing = pdf.splitTextToSize(`Nama Pemborong / Supplier: ${supplierName}`, width) as string[];
  const roleHeight = Math.max(...roles.map(r => r.length)) * 4;
  const nameHeight = Math.max(...names.map(r => r.length)) * 4;
  const blockHeight = closing.length * 4 + 12 + roleHeight + 24 + nameHeight;
  if (y + blockHeight > pdf.internal.pageSize.getHeight() - 16) { pdf.addPage(); y = 20; }
  pdf.setFont("helvetica", "bold");
  pdf.text(closing, margin, y);
  y += closing.length * 4 + 12;
  signatories.forEach((_, index) => {
    const x = margin + cellWidth * (index + 0.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(roles[index] ?? [], x, y, { align: "center" });
    pdf.line(x - 20, y + roleHeight + 22, x + 20, y + roleHeight + 22);
    pdf.setFont("helvetica", "bold");
    pdf.text(names[index] ?? [], x, y + roleHeight + 27, { align: "center" });
  });
  const attachments = rows.flatMap(row => documents.filter(d => d.item_id === row.item.id).map(d => [row.number, d.file_name]));
  if (attachments.length) {
    autoTable(pdf, { startY: y + roleHeight + 27 + nameHeight + 8, theme: "grid", styles: { fontSize: 8, textColor: reportColor("text"), lineColor: reportColor("border") },
      headStyles: { fillColor: reportColor("header"), textColor: reportColor("header-text") }, head: [["No. Poin", "Nama Lampiran"]], body: attachments });
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    pdf.text(`AURA | Halaman ${page} dari ${pdf.getNumberOfPages()}`, margin, pdf.internal.pageSize.getHeight() - 7);
  }
  return pdf;
}
export function stockOpnamePdf(header: ReportHeader, items: OpnameItem[], documents: { item_id: string; file_name: string }[]) {
  const safeName = header.project_name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "Project";
  createStockOpnamePdf(header, items, documents).save(`Berita Acara Stok Opname - ${safeName}.pdf`);
}