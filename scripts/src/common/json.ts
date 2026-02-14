import type { CsvReadResult } from "./csv";

interface ToJsonOptions {
  arrayFields?: string[];
  numericFields?: string[];
  booleanFields?: string[];
  emptyAsNull?: boolean;
  lowercaseFields?: boolean;
  ignoreFields?: string[];
  fieldTransformer?: (fieldName: string, value: string) => unknown;
}

export const csvOutputToJson = <T = Record<string, unknown>>(csv: CsvReadResult, options: ToJsonOptions = {}): T[] => {
  const {
    arrayFields = [],
    numericFields = [],
    booleanFields = [],
    emptyAsNull = false,
    lowercaseFields = false,
    ignoreFields = [],
    fieldTransformer,
  } = options;

  if (csv.headers.length === 0 || csv.rows.length === 0) {
    return [];
  }

  const result: T[] = [];

  for (const row of csv.rows) {
    const obj: Record<string, unknown> = {};

    for (let i = 0; i < csv.headers.length; i++) {
      let header = csv.headers[i];
      if (lowercaseFields) {
        header = header.toLowerCase();
      }
      if (ignoreFields.includes(header)) {
        continue;
      }
      const value: string = row[i] || "";

      // Handle empty values
      if (value === "" && emptyAsNull) {
        obj[header] = null;
        continue;
      }

      // Apply custom field transformer if provided
      if (fieldTransformer) {
        obj[header] = fieldTransformer(header, value);
        continue;
      }

      // Convert to array if specified
      if (arrayFields.includes(header)) {
        obj[header] =
          value === ""
            ? []
            : value
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
        continue;
      }

      // Convert to number if specified
      if (numericFields.includes(header)) {
        if (value === "") {
          obj[header] = emptyAsNull ? null : NaN;
        } else {
          const num = Number(value);
          obj[header] = isNaN(num) ? value : num;
        }
        continue;
      }

      // Convert to boolean if specified
      if (booleanFields.includes(header)) {
        obj[header] = value === "" ? (emptyAsNull ? null : false) : value.toLowerCase() === "true";
        continue;
      }

      // Default: keep as string
      obj[header] = value === "" ? (emptyAsNull ? null : "") : value;
    }

    result.push(obj as T);
  }

  return result;
};
