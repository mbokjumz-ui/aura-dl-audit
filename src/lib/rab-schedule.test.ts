import { test } from "node:test";
import assert from "node:assert/strict";
import { workEndDate, rabScheduleSchema } from "./rab-schedule";

test("Tanggal mulai merupakan hari pertama pengerjaan", () => {
  assert.equal(workEndDate("2026-11-04", 1), "2026-11-04");
  assert.equal(workEndDate("2026-11-04", 14), "2026-11-17");
});
test("Tanggal selesai otomatis melewati batas bulan dan tahun", () => {
  assert.equal(workEndDate("2026-12-28", 7), "2027-01-03");
  assert.equal(workEndDate("2028-02-28", 3), "2028-03-01");
});
test("Lama pengerjaan wajib hari bulat positif dan tanggal mulai valid", () => {
  for (const workDays of [0, -1, 1.5, NaN]) assert.equal(rabScheduleSchema.safeParse({ workDays, workStartDate: "2026-11-04" }).success, false);
  assert.equal(rabScheduleSchema.safeParse({ workDays: 14, workStartDate: "2026-02-30" }).success, false);
  assert.equal(rabScheduleSchema.safeParse({ workDays: 14, workStartDate: "2026-11-04" }).success, true);
});