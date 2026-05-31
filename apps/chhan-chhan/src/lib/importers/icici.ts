import type { BankImporter, StatementInput } from "$lib/importers/types";
import { parseIciciPdf } from "$lib/importers/icici-pdf";
import { extractPdfText } from "$lib/server/pdf-text";

function isPdfInput(input: StatementInput): boolean {
  const name = input.fileName.toLowerCase();
  return input.mimeType === "application/pdf" || name.endsWith(".pdf");
}

export const iciciImporter: BankImporter = {
  id: "icici",
  label: "ICICI Bank",
  accept: ".pdf,application/pdf",
  async parse(input) {
    if (!isPdfInput(input)) {
      throw new Error("ICICI importer supports PDF statements only");
    }

    const text = await extractPdfText(input.bytes);
    return parseIciciPdf(text);
  },
};
