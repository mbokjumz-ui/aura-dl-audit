import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { dispositionAmounts, rupiahWords } from "./rab-disposition";
import { readRabFinalization, type FinalizedRab } from "./rab-finalization";
import { rupiah, type OpnameItem } from "./stock-opname";
import reportStyles from "../styles.css?raw";
import { workScheduleLabel } from "./rab-schedule";
import { mergedRabBlob } from "./rab-attachments-client";

function reportColor(token: string) {
  const color = reportStyles.match(new RegExp(`--report-table-${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  if (!color) throw new Error("Warna tabel laporan tidak tersedia.");
  return color;
}

type DispositionHeader = FinalizedRab & { project_name: string; division_location: string; disposition_number: string; responsible_name: string };
export function createRabDispositionPdf(header: DispositionHeader, items: OpnameItem[], options: { draft?: boolean } = {}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  if (header.revision_number && header.revision_number > 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`rev${header.revision_number}`, 16, 10);
  }
  const margin = 16, width = 178, bottom = 280;
  let y = 22;
  function space(height: number) { if (y + height > bottom) { pdf.addPage(); y = 20; } }
  function text(value: string, bold = false, centered = false) {
    pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(value, width) as string[];
    for (const line of lines) { space(6); pdf.text(line, centered ? 105 : margin, y, centered ? { align: "center" } : undefined); y += 6; }
    y += 2;
  }
  function table(options: Parameters<typeof autoTable>[1]) {
    autoTable(pdf, {
      startY: y, margin: { left: margin, right: margin, top: 20, bottom: 17 }, theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak", lineWidth: 0.2, lineColor: reportColor("border"), textColor: reportColor("text") },
      headStyles: { fillColor: reportColor("header"), textColor: reportColor("header-text"), fontStyle: "bold", lineWidth: 0.2 },
      footStyles: { fillColor: reportColor("total"), textColor: reportColor("text"), fontStyle: "bold", lineWidth: 0.2 },
      ...options,
    });
    const tablePdf = pdf as jsPDF & { lastAutoTable?: { finalY: number } };
    y = (tablePdf.lastAutoTable?.finalY ?? y) + 8;
  }
  const { rows, totals } = dispositionAmounts(items, header.vat_included);
  const details = readRabFinalization(header);
  text("PERMOHONAN DISPOSISI PROYEK", true, true);
  text(header.disposition_number || "-", true, true);
  if (options.draft) text("DRAFT - BELUM FINAL", true, true);
  y += 5;
  text(`Mohon disposisi biaya ${header.project_name} di ${header.division_location || "-"}`);
  text(rupiah(totals.total), true);
  text(`(${rupiahWords(totals.total)})`);
  text("Dengan rincian sebagai berikut:");
  table({
    head: [["No.", "Uraian pengerjaan", "Jumlah", "Satuan", "Nilai (Rp)", "Amount (Rp)"]],
    body: rows.map(({ number, item, children, level, amount }) => [number, `${level ? "   " : ""}${item.description}`, children.length ? "" : item.quantity.toLocaleString("id-ID"), children.length ? "" : item.unit, children.length ? "" : rupiah(item.unit_price), rupiah(amount)]),
    foot: [["", "Total sebelum PPN", "", "", "", rupiah(totals.subtotal)], ["", header.vat_included ? "PPN 11% (Include)" : "PPN (Exclude)", "", "", "", rupiah(totals.ppn)], ["", "Total akhir RAB", "", "", "", rupiah(totals.total)]],
    showFoot: "lastPage", columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 62 }, 2: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section === "body" && rows[data.row.index]?.children.length) {
        data.cell.styles.fillColor = reportColor("parent");
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  text(`Note: ${header.disposition_note || "-"}`);
  text(`Lama Pekerjaan: ${workScheduleLabel(header)}`);
  text("Perbandingan Penawaran Sebelum PPN:", true);
  table({ head: [["No.", "Kontraktor", "Penawaran sebelum PPN"]], body: details?.contractors.map((c, i) => [String(i + 1), c.name, rupiah(c.amount)]) ?? [["-", "-", "-"]], columnStyles: { 0: { cellWidth: 12 }, 2: { halign: "right" } } });
  text("Pembayaran:", true);
  text(`- Pembayaran DP ${(header.down_payment_percent ?? 0).toLocaleString("id-ID")}%`);
  text("- Pembayaran Pelunasan setelah Pekerjaan selesai sesuai Stock Opname.");
  const signatureGroups = [
    { title: "Menyetujui", people: details?.approvers ?? [{ name: "-", position: "-" }] },
    { title: "Mengetahui", people: details?.acknowledgers ?? [{ name: "-", position: "-" }] },
    { title: "Penanggung jawab proyek", people: [{ name: header.responsible_name || "-", position: header.responsible_position || "-" }] },
  ];
  const count = signatureGroups.reduce((total, group) => total + group.people.length, 0);
  const cellWidth = width / count;
  const fontSize = Math.min(10, cellWidth / 2.8);
  const lineHeight = fontSize * 0.45;
  const contentWidth = cellWidth * 0.92;
  const columns = signatureGroups.flatMap(group => group.people.map(person => ({ ...person, title: group.title })));
  pdf.setFontSize(fontSize);
  pdf.setFont("helvetica", "bold");
  const headings = columns.map(p => pdf.splitTextToSize(p.title, contentWidth) as string[]);
  const names = columns.map(p => pdf.splitTextToSize(p.name, contentWidth) as string[]);
  pdf.setFont("helvetica", "normal");
  const positions = columns.map(p => pdf.splitTextToSize(p.position, contentWidth) as string[]);
  const headingHeight = Math.max(...headings.map(lines => lines.length)) * lineHeight;
  const nameHeight = Math.max(...names.map(lines => lines.length)) * lineHeight;
  const positionHeight = Math.max(...positions.map(lines => lines.length)) * lineHeight;
  const height = headingHeight + 30 + nameHeight + positionHeight;
  space(height);
  const start = y;
  columns.forEach((_, i) => {
    const x = margin + cellWidth * (i + 0.5);
    pdf.setFont("helvetica", "bold");
    pdf.text(headings[i] ?? [], x, start, { align: "center", lineHeightFactor: 1.25 });
    pdf.setFont("helvetica", "normal");
    pdf.text("(Tanda tangan)", x, start + headingHeight + 22, { align: "center" });
    pdf.setFont("helvetica", "bold");
    pdf.text(names[i] ?? [], x, start + headingHeight + 28, { align: "center", lineHeightFactor: 1.25 });
    pdf.setFont("helvetica", "normal");
    pdf.text(positions[i] ?? [], x, start + headingHeight + 28 + nameHeight, { align: "center", lineHeightFactor: 1.25 });
  });
  y = start + height;
  return pdf;
}
export async function rabDispositionPdf(header: DispositionHeader & { id: string }, items: OpnameItem[]) {
  const name = header.project_name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "Project";
  const blob = await mergedRabBlob(header.id, createRabDispositionPdf(header, items).output("arraybuffer"));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = `Permohonan Disposisi - ${name}.pdf`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}