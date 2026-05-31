import { describe, expect, test } from "bun:test";
import { parseKotakPdf } from "$lib/importers/kotak-pdf";
import { stripKotakPdfChunkFooter } from "$lib/importers/kotak-shared";

describe("stripKotakPdfChunkFooter", () => {
  test("removes page footer after last transaction on a page", () => {
    const chunk =
      "1476 10 Oct 2024 UPI/Soni Neel Himan/428474484644/via Sanjana Sin UPI-428451796244 10,000.00 70,485.25 MUKUL SINGH Account No. 2546953512";

    expect(stripKotakPdfChunkFooter(chunk)).toBe(
      "1476 10 Oct 2024 UPI/Soni Neel Himan/428474484644/via Sanjana Sin UPI-428451796244 10,000.00 70,485.25"
    );
  });
});

describe("parseKotakPdf", () => {
  test("parses page-boundary transactions with footer noise", () => {
    const text = [
      "Account Statement 17 Jul 2022 - 31 May 2026",
      "1475 10 Oct 2024 UPI/SWIGGY/989259777131/Payment from Ph UPI-428434828365 448.00 80,485.25",
      "1476 10 Oct 2024 UPI/Soni Neel Himan/428474484644/via Sanjana Sin UPI-428451796244 10,000.00 70,485.25",
      "MUKUL SINGH Account No. 2546953512 Statement Generated on 31 May 2026 Page 44 of88",
      "1477 11 Oct 2024 UPI/GRAMIQ C4/191303422266/Payment from Ph UPI-428599108565 1,074.00 69,411.25",
    ].join(" ");

    const { rows } = parseKotakPdf(text);

    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({
      sortOrder: 1476,
      occurredOn: "2024-10-10",
      merchant: "Soni Neel Himan",
      externalRef: "UPI-428451796244",
      amountMinor: 1_000_000,
      type: "expense",
      balanceMinor: 7_048_525,
    });
  });
});
