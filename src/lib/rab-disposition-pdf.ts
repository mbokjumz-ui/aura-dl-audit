import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { dispositionAmounts, rupiahWords } from "./rab-disposition";
import { readRabFinalization, type FinalizedRab } from "./rab-finalization";
import { rupiah, type OpnameItem } from "./stock-opname";

type DispositionHeader = FinalizedRab & { project_name: string; division_location: string; disposition_number: string; responsible_name: string };
export function createRabDispositionPdf(header: DispositionHeader, items: OpnameItem[]) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
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
    autoTable(pdf, { startY: y, margin: { left: margin, right: margin, top: 20, bottom: 17 }, theme: "plain", styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" }, ...options });
    const tablePdf = pdf as jsPDF & { lastAutoTable?: { finalY: number } };
    y = (tablePdf.lastAutoTable?.finalY ?? y) + 8;
  }
  const { rows, totals } = dispositionAmounts(items, header.vat_included);
  const details = readRabFinalization(header);
  text("PERMOHONAN DISPOSISI PROYEK", true, true);
  text(header.disposition_number || "-", true, true);
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
  });
  text(`Note: ${header.disposition_note || "-"}`);
  text(`Lama Pekerjaan: ${header.work_duration || "-"}`);
  text("Perbandingan Penawaran Sebelum PPN:", true);
  table({ head: [["No.", "Kontraktor", "Penawaran sebelum PPN"]], body: details?.contractors.map((c, i) => [String(i + 1), c.name, rupiah(c.amount)]) ?? [["-", "-", "-"]], columnStyles: { 0: { cellWidth: 12 }, 2: { halign: "right" } } });
  text("Pembayaran:", true);
  text(`- Pembayaran DP ${(header.down_payment_percent ?? 0).toLocaleString("id-ID")}%`);
  text("- Pembayaran Pelunasan setelah Pekerjaan selesai sesuai Stock Opname.");
  function signatures(title: string, people: { name: string; position: string }[]) {
    for (let offset = 0; offset < people.length; offset += 2) {
      const pair = people.slice(offset, offset + 2);
      pdf.setFontSize(11);
      const cellWidth = width / pair.length;
      const nameLines = pair.map(p => pdf.splitTextToSize(p.name || "-", cellWidth - 8) as string[]);
      const positionLines = pair.map(p => pdf.splitTextToSize(p.position || "-", cellWidth - 8) as string[]);
      const height = 39 + Math.max(...nameLines.map(lines => lines.length)) * 5 + Math.max(...positionLines.map(lines => lines.length)) * 5;
      space(height); text(title, true);
      const start = y;
      pair.forEach((p, i) => {
        const x = margin + cellWidth * (i + 0.5);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
        pdf.text("(Tanda tangan)", x, start + 22, { align: "center" });
        pdf.setFont("helvetica", "bold");
        pdf.text(nameLines[i] ?? [p.name], x, start + 31, { align: "center" });
        pdf.setFont("helvetica", "normal");
        pdf.text(positionLines[i] ?? [p.position], x, start + 31 + (nameLines[i]?.length ?? 1) * 5, { align: "center" });
      });
      y = start + height;
    }
  }
  signatures("Menyetujui", details?.approvers ?? [{ name: "-", position: "-" }]);
  signatures("Mengetahui", details?.acknowledgers ?? [{ name: "-", position: "-" }]);
  signatures("Penanggung jawab proyek", [{ name: header.responsible_name, position: header.responsible_position || "-" }]);
  return pdf;
}
export function rabDispositionPdf(header: DispositionHeader, items: OpnameItem[]) {
  const name = header.project_name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "Project";
  createRabDispositionPdf(header, items).save(`Permohonan Disposisi - ${name}.pdf`);
}