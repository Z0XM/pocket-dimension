import { describe, expect, test } from "bun:test";
import { normalizeKotakCsvChronology, parseKotakCsv } from "$lib/importers/kotak";
import type { ImportRow } from "$lib/importers/types";

function row(partial: Partial<ImportRow> & Pick<ImportRow, "occurredOn" | "amountMinor" | "type" | "sortOrder" | "balanceMinor">): ImportRow {
  return {
    merchant: partial.merchant ?? "Test",
    ...partial,
  };
}

describe("normalizeKotakCsvChronology", () => {
  test("leaves oldest-first rows unchanged", () => {
    const rows = [
      row({ occurredOn: "2026-09-01", amountMinor: 100, type: "expense", sortOrder: 1, balanceMinor: 900 }),
      row({ occurredOn: "2026-09-02", amountMinor: 100, type: "expense", sortOrder: 2, balanceMinor: 800 }),
    ];

    const normalized = normalizeKotakCsvChronology(rows);
    expect(normalized.map((entry) => entry.sortOrder)).toEqual([1, 2]);
    expect(normalized.map((entry) => entry.occurredOn)).toEqual(["2026-09-01", "2026-09-02"]);
  });

  test("reverses newest-first rows and inverts serials", () => {
    // Newest first in file: serial 1 is Oct 2, serial 2 is Oct 1.
    const rows = [
      row({
        occurredOn: "2026-10-02",
        amountMinor: 49806,
        type: "expense",
        sortOrder: 1,
        balanceMinor: 4_917_188,
        merchant: "Zomato",
      }),
      row({
        occurredOn: "2026-10-01",
        amountMinor: 708_886,
        type: "expense",
        sortOrder: 2,
        balanceMinor: 4_966_994,
        merchant: "Cursor",
      }),
      row({
        occurredOn: "2026-09-30",
        amountMinor: 40_100,
        type: "income",
        sortOrder: 3,
        balanceMinor: 5_675_880,
        merchant: "Interest",
      }),
    ];

    const normalized = normalizeKotakCsvChronology(rows);
    expect(normalized.map((entry) => entry.merchant)).toEqual(["Interest", "Cursor", "Zomato"]);
    expect(normalized.map((entry) => entry.sortOrder)).toEqual([1, 2, 3]);
  });
});

describe("parseKotakCsv", () => {
  test("parses newest-first CSV without inventing balance breaks", () => {
    const csv = [
      '"","","Account Statement"',
      '"Sl. No.","Transaction Date","Value Date","Description","Chq /Ref No.","Amount","Dr / Cr","Balance","Dr / Cr"',
      '"1","02-10-2026 21:41:42","02-10-2026","UPI/ZOMATO LTD/HDFC/559426936057/Pay via Razo","UPI-1","498.06","DR","49,171.88","CR"',
      '"2","01-10-2026 20:37:19","01-10-2026","PCI/3519/CURSOR, AI POWERED IDE/+18314011026/20:37","627415067836","7,088.86","DR","49,669.94","CR"',
      '"3","01-10-2026 04:13:22","30-09-2026","Int.Pd:2546953512:01-07-2026 to 30-09-2026","","401.00","CR","56,758.80","CR"',
    ].join("\n");

    const { rows } = parseKotakCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows.map((entry) => entry.merchant)).toEqual(["Interest", "CURSOR, AI POWERED IDE", "ZOMATO LTD"]);
    expect(rows.map((entry) => entry.sortOrder)).toEqual([1, 2, 3]);

    // Chronological balance chain should hold after normalization.
    for (let i = 1; i < rows.length; i += 1) {
      const prev = rows[i - 1]!;
      const next = rows[i]!;
      const expected = next.type === "income" ? prev.balanceMinor! + next.amountMinor : prev.balanceMinor! - next.amountMinor;
      expect(expected).toBe(next.balanceMinor);
    }
  });

  test("parses oldest-first CSV without reversing", () => {
    const csv = [
      '"","","Account Statement"',
      '"Sl. No.","Transaction Date","Value Date","Description","Chq /Ref No.","Amount","Dr / Cr","Balance","Dr / Cr"',
      '"1","01-09-2026 10:00:00","01-09-2026","UPI/Alpha/HDFC/1/Payment","UPI-1","100.00","DR","1,000.00","CR"',
      '"2","02-09-2026 10:00:00","02-09-2026","UPI/Beta/HDFC/2/Payment","UPI-2","200.00","DR","800.00","CR"',
    ].join("\n");

    const { rows } = parseKotakCsv(csv);
    expect(rows.map((entry) => entry.merchant)).toEqual(["Alpha", "Beta"]);
    expect(rows.map((entry) => entry.sortOrder)).toEqual([1, 2]);
  });
});
