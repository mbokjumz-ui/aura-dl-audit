import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isoYearObjects, type IsoObject } from "./iso-archive";

describe("Arsip ISO dua level", () => {
  it("menampilkan object ISO hanya pada tahun yang dipilih tanpa bulan atau project", () => {
    const rows: IsoObject[] = [
      { id: "a", archive_year: 2026, object_name: "ISO 9001", created_at: "2026-10-16" },
      { id: "b", archive_year: 2025, object_name: "ISO 9001", created_at: "2025-10-16" },
      { id: "c", archive_year: 2026, object_name: "ISO 27001", created_at: "2026-10-16" },
    ];
    assert.deepEqual(isoYearObjects(rows, 2026).map(o => o.id), ["a", "c"]);
    assert.deepEqual(isoYearObjects(rows, 2025).map(o => o.id), ["b"]);
    assert.deepEqual(isoYearObjects(rows, 2024), []);
  });
});