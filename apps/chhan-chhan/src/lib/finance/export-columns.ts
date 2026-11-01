export const EXPORT_COLUMN_IDS = ["date", "merchant", "amount", "balance", "tags", "notes", "space", "spaceBalance"] as const;

export type ExportColumnId = (typeof EXPORT_COLUMN_IDS)[number];

export type ExportColumnDef = {
  id: ExportColumnId;
  label: string;
  /** Always include unless the user explicitly unchecks (soft-required). */
  required?: boolean;
  /** Only offered when exporting inside a single space filter. */
  spaceOnly?: boolean;
};

export const EXPORT_COLUMNS: readonly ExportColumnDef[] = [
  { id: "date", label: "Date", required: true },
  { id: "merchant", label: "Merchant", required: true },
  { id: "amount", label: "Amount", required: true },
  { id: "balance", label: "Balance" },
  { id: "tags", label: "Tags" },
  { id: "notes", label: "Notes" },
  { id: "space", label: "Space" },
  { id: "spaceBalance", label: "Space balance", spaceOnly: true },
];

export const DEFAULT_EXPORT_COLUMNS: ExportColumnId[] = ["date", "merchant", "amount", "balance"];

export function normalizeExportColumns(selected: Iterable<string>, options: { includeSpaceBalance?: boolean } = {}): ExportColumnId[] {
  const allowed = new Set(
    EXPORT_COLUMNS.filter((col) => options.includeSpaceBalance || !col.spaceOnly).map((col) => col.id)
  );
  const picked = new Set([...selected].filter((id): id is ExportColumnId => allowed.has(id as ExportColumnId)));
  for (const col of EXPORT_COLUMNS) {
    if (col.required && allowed.has(col.id)) picked.add(col.id);
  }
  if (picked.size === 0) {
    for (const id of DEFAULT_EXPORT_COLUMNS) {
      if (allowed.has(id)) picked.add(id);
    }
  }
  return EXPORT_COLUMNS.map((col) => col.id).filter((id) => picked.has(id));
}

export function exportColumnHeader(id: ExportColumnId): string {
  return EXPORT_COLUMNS.find((col) => col.id === id)?.label ?? id;
}
