import type { BankImporter, StatementInput } from "$lib/importers/types";
import { parseHdfcPdf } from "$lib/importers/hdfc-pdf";
import { extractPdfText } from "$lib/server/pdf-text";

function isPdfInput(input: StatementInput): boolean {
  const name = input.fileName.toLowerCase();
  return input.mimeType === "application/pdf" || name.endsWith(".pdf");
}

export const hdfcImporter: BankImporter = {
  id: "hdfc",
  label: "HDFC Bank",
  accept: ".pdf,application/pdf",
  async parse(input) {
    if (!isPdfInput(input)) {
      throw new Error("HDFC importer supports PDF statements only");
    }

    const text = await extractPdfText(input.bytes);
    return parseHdfcPdf(text);
  },
};
