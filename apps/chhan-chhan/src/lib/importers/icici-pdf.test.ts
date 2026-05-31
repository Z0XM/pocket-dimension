import { describe, expect, test } from "bun:test";
import { parseIciciPdf } from "$lib/importers/icici-pdf";
import { stripIciciPdfChunkFooter } from "$lib/importers/icici-shared";

describe("stripIciciPdfChunkFooter", () => {
  test("removes page footer after last transaction on a page", () => {
    const chunk =
      "12 21.05.2026 MITHUN UPI/MITHUN/9118385174@ybl/UPI/INDIA POST/650703821438/YJP4e44a36e43fe474586388 da6e326c832/ 50.00 19619.72 ICICI BANK LTD- BK-11&12";

    expect(stripIciciPdfChunkFooter(chunk)).toBe(
      "12 21.05.2026 MITHUN UPI/MITHUN/9118385174@ybl/UPI/INDIA POST/650703821438/YJP4e44a36e43fe474586388 da6e326c832/ 50.00 19619.72"
    );
  });
});

describe("parseIciciPdf", () => {
  test("parses ICICI savings statement rows", () => {
    const text = [
      "Statement of Transactions in Saving Account no. 777701233844 in INR for the period May 17, 2026 - May 23, 2026",
      "1 17.05.2026 DAS DEPART UPI/DAS DEPART/paytmqr6po7p9@/UPI/YES BANK L/613728578923/YJPbc61e62edb4944fa8d2a5989 278bca45/ 10.00 21486.72",
      "2 17.05.2026 MILAN SWEE UPI/MILAN SWEE/milansweetsand/UPI/HDFC BANK/613730504274/YJP4927df48e3dd4d8ebd4fd 4d61ec6fd0c/ 55.00 21431.72",
    ].join(" ");

    const { rows, metadata } = parseIciciPdf(text);

    expect(metadata.accountNumber).toBe("777701233844");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sortOrder: 1,
      occurredOn: "2026-05-17",
      merchant: "DAS DEPART",
      externalRef: "613728578923",
      amountMinor: 1000,
      type: "expense",
      balanceMinor: 2148672,
    });
    expect(rows[1]).toMatchObject({
      sortOrder: 2,
      merchant: "MILAN SWEE",
      amountMinor: 5500,
      type: "expense",
    });
  });
});
