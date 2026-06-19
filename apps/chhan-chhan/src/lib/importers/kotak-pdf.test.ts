import { describe, expect, test } from "bun:test";
import { parseKotakPdf } from "$lib/importers/kotak-pdf";
import { stripKotakMonthlyPdfChunkFooter, stripKotakPdfChunkFooter } from "$lib/importers/kotak-shared";

describe("stripKotakPdfChunkFooter", () => {
  test("removes page footer after last transaction on a page", () => {
    const chunk =
      "1476 10 Oct 2024 UPI/Soni Neel Himan/428474484644/via Sanjana Sin UPI-428451796244 10,000.00 70,485.25 MUKUL SINGH Account No. 2546953512";

    expect(stripKotakPdfChunkFooter(chunk)).toBe(
      "1476 10 Oct 2024 UPI/Soni Neel Himan/428474484644/via Sanjana Sin UPI-428451796244 10,000.00 70,485.25"
    );
  });
});

describe("stripKotakMonthlyPdfChunkFooter", () => {
  test("removes monthly page footer after last transaction on a page", () => {
    const chunk =
      "15 21 May 2026 07:55 PM 21 May 2026 UPI/Karnataka Depar/947952264883/Payment for ref UPI-614110717537 -10.00 22,146.86 Statement generated on 19 Jun 2026, 12:10 AM Page 1 of4";

    expect(stripKotakMonthlyPdfChunkFooter(chunk)).toBe(
      "15 21 May 2026 07:55 PM 21 May 2026 UPI/Karnataka Depar/947952264883/Payment for ref UPI-614110717537 -10.00 22,146.86"
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

  test("parses monthly Kotak PDF format with signed amounts and txn time", () => {
    const text = [
      "Account Statement Account # 2546953512 SAVINGS 01 May 2026 - 31 May 2026",
      "# TRANSACTION DATE VALUE DATE TRANSACTION DETAILS CHQ / REF NO. DEBIT/CREDIT(₹) BALANCE(₹)",
      "1 31 May 2026 03:01 PM 31 May 2026 UPI/Firstclub1/411134206165/UPIIntent UPI-615154174598 -1,087.00 15,906.97",
      "2 29 May 2026 06:14 PM 29 May 2026 UPI/Mymarket/627374397910/Payment from Ph UPI-614932901577 -520.00 16,993.97",
    ].join(" ");

    const { rows, metadata } = parseKotakPdf(text);

    expect(metadata.accountNumber).toBe("2546953512");
    expect(metadata.period).toBe("01 May 2026 - 31 May 2026");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sortOrder: 2,
      occurredOn: "2026-05-29",
      merchant: "Mymarket",
      externalRef: "UPI-614932901577",
      amountMinor: 52_000,
      type: "expense",
      balanceMinor: 1_699_397,
    });
    expect(rows[1]).toMatchObject({
      sortOrder: 1,
      occurredOn: "2026-05-31",
      merchant: "Firstclub1",
      externalRef: "UPI-615154174598",
      amountMinor: 108_700,
      type: "expense",
      balanceMinor: 1_590_697,
    });
  });

  test("parses monthly refund credits with plus sign", () => {
    const text = [
      "Account # 2546953512 01 May 2026 - 31 May 2026 # TRANSACTION DATE VALUE DATE",
      "5 28 May 2026 09:59 PM 28 May 2026 UPI/ZOMATO/103366185084/Order Refund UPI-614887793888 +489.74 18,440.90",
    ].join(" ");

    const { rows } = parseKotakPdf(text);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-05-28",
      merchant: "ZOMATO",
      amountMinor: 48_974,
      type: "income",
      balanceMinor: 1_844_090,
    });
  });
});
