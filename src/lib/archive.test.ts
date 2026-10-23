import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { archiveBranch, type Finding } from "./archive";

describe("Susunan empat level arsip", () => {
  const row = (id: string, year: number, month: number, project: string, number: string): Finding => ({ id, archive_year: year, archive_month: month, project_key: project, project_name: project, source_project_id: null, finding_number: number, title: "Temuan", description: "", created_at: "2026-10-15" });
  const rows = [row("1",2026,10,"A","01"),row("2",2026,11,"A","02"),row("3",2025,10,"A","03"),row("4",2026,10,"B","04")];
  it("mengelompokkan Tahun → Bulan → Project → Nomor Temuan", () => {
    assert.deepEqual(archiveBranch(rows,2026,10,"A").map(f => f.finding_number), ["01"]);
    assert.equal(archiveBranch(rows,2026).length, 3);
    assert.equal(archiveBranch(rows,2026,10).length, 2);
  });
});