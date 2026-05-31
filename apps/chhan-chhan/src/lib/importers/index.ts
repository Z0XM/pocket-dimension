import { csvImportRowSchema } from "$lib/validation/finance";
import type { BankImporter, ImportRow, StatementInput } from "$lib/importers/types";
import { parseCsvRows, rowsToObjects } from "$lib/server/csv-parse";
import { kotakImporter } from "$lib/importers/kotak";

export const genericImporter: BankImporter = {
  id: "generic",
  label: "Generic CSV",
  accept: ".csv,text/csv",
  async parse(input: StatementInput) {
    const text = new TextDecoder().decode(input.bytes);
    const rows = rowsToObjects(parseCsvRows(text));
    const parsedRows: ImportRow[] = rows.map((row) => ({
      occurredOn: row.occurredOn,
      amountMinor: Number(row.amountMinor),
      type: row.type as ImportRow["type"],
      merchant: row.merchant,
      notes: row.notes,
      externalRef: row.externalRef,
    }));

    for (const row of parsedRows) {
      csvImportRowSchema.parse(row);
    }

    return { rows: parsedRows, metadata: {} };
  },
};

const importers: Record<string, BankImporter> = {
  [kotakImporter.id]: kotakImporter,
  [genericImporter.id]: genericImporter,
};

export function getImporter(id: string): BankImporter {
  const importer = importers[id];
  if (!importer) throw new Error(`Unknown bank importer: ${id}`);
  return importers[id];
}

export function listImporters(): BankImporter[] {
  return Object.values(importers);
}

export function importerAcceptList(): string {
  return listImporters()
    .flatMap((importer) => importer.accept.split(","))
    .join(",");
}
