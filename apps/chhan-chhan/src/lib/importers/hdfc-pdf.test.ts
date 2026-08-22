import { describe, expect, test } from "bun:test";
import { parseHdfcPdf } from "$lib/importers/hdfc-pdf";
import { merchantFromHdfcDescription, stripHdfcPdfChunkFooter } from "$lib/importers/hdfc-shared";

describe("stripHdfcPdfChunkFooter", () => {
  test("removes statement summary after last transaction", () => {
    const chunk =
      "24/05/26 UPI-AIRTEL-AIRTEL-BILLPAYMENT.PAYTM@PTYB 0000651001062080 24/05/26 1,261.42 29,550.03 L-YESB0PTMUPI STATEMENT SUMMARY :- Opening Balance";

    expect(stripHdfcPdfChunkFooter(chunk)).toBe(
      "24/05/26 UPI-AIRTEL-AIRTEL-BILLPAYMENT.PAYTM@PTYB 0000651001062080 24/05/26 1,261.42 29,550.03 L-YESB0PTMUPI"
    );
  });
});

describe("merchantFromHdfcDescription", () => {
  test("parses UPI, UPI-AUTOPAY, and ACH narrations", () => {
    expect(merchantFromHdfcDescription("UPI-CHEQ DIGITAL PRIVATE-CHEQ4.PAYU@AXIS BANK-UTIB0003156")).toBe("CHEQ DIGITAL PRIVATE");
    expect(merchantFromHdfcDescription("UPI-AUTOPAY-GROWW INVEST TECH PR-GROWW.S TOCKSIP.BRK@VALIDHDFC-HDFC0MERUPI")).toBe("GROWW INVEST TECH PR");
    expect(merchantFromHdfcDescription("UPI-AIRTEL-AIRTEL-BILLPAYMENT.PAYTM@PTYB L-YESB0PTMUPI")).toBe("AIRTEL");
    expect(merchantFromHdfcDescription("ACH D- GROWW INVEST TECH PR-7GXEAIE8O5BQ")).toBe("GROWW INVEST TECH PR");
  });
});

describe("parseHdfcPdf", () => {
  test("parses HDFC savings statement rows with withdrawal amounts", () => {
    const text = [
      "Account No : 50100337618638",
      "RTGS/NEFT IFSC: HDFC0001897",
      "Statement of accountFrom : 17/05/2026 To : 28/05/2026",
      "Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance",
      "17/05/26 ACH D- GROWW INVEST TECH PR-7GXEAIE8O5BQ 0000003629187862 17/05/26 5,000.00 68,771.87",
      "17/05/26 UPI-AUTOPAY-GROWW INVEST TECH PR-GROWW.S 0000103311981143 17/05/26 2,500.00 66,271.87 TOCKSIP.BRK@VALIDHDFC-HDFC0MERUPI-103311 981143-DEBIT FOR STOCKS S",
      "24/05/26 UPI-CHEQ DIGITAL PRIVATE-CHEQ4.PAYU@AXIS 0000651054873872 24/05/26 17,663.00 43,608.87 BANK-UTIB0003156-651054873872-UPI",
      "24/05/26 UPI-AIRTEL-AIRTEL-BILLPAYMENT.PAYTM@PTYB 0000651001062080 24/05/26 1,261.42 29,550.03 L-YESB0PTMUPI-651001062080-AIRTELBROADBA NDBIL",
      "STATEMENT SUMMARY :- Opening Balance Dr Count Cr Count Debits Credits Closing Bal 73,771.87 4 0 26,424.42 0.00 29,550.03",
    ].join(" ");

    const { rows, metadata } = parseHdfcPdf(text);

    expect(metadata.accountNumber).toBe("50100337618638");
    expect(metadata.ifsc).toBe("HDFC0001897");
    expect(metadata.openingBalance).toBe("73,771.87");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      sortOrder: 1,
      occurredOn: "2026-05-17",
      merchant: "GROWW INVEST TECH PR",
      externalRef: "0000003629187862",
      amountMinor: 500000,
      type: "expense",
      balanceMinor: 6877187,
    });
    expect(rows[1]).toMatchObject({
      merchant: "GROWW INVEST TECH PR",
      externalRef: "0000103311981143",
      amountMinor: 250000,
      type: "expense",
      balanceMinor: 6627187,
    });
    expect(rows[2]).toMatchObject({
      merchant: "CHEQ DIGITAL PRIVATE",
      amountMinor: 1766300,
      type: "expense",
    });
    expect(rows[3]).toMatchObject({
      merchant: "AIRTEL",
      amountMinor: 126142,
      type: "expense",
      balanceMinor: 2955003,
    });
  });

  test("classifies deposits as income via balance delta", () => {
    const text = [
      "Account No : 50100337618638",
      "STATEMENT SUMMARY :- Opening Balance Dr Count Cr Count Debits Credits Closing Bal 10,000.00 0 1 0.00 5,000.00 15,000.00",
      "Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance",
      "01/06/26 NEFT CR-ACME CORP-SALARY 0000001111222233 01/06/26 5,000.00 15,000.00",
    ].join(" ");

    const { rows } = parseHdfcPdf(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "income",
      amountMinor: 500000,
      balanceMinor: 1500000,
      merchant: "NEFT CR-ACME CORP-SALARY",
    });
  });
});
