/**
 * Minimal SpreadsheetML workbook — opens in Excel / LibreOffice without a SheetJS dependency.
 */
function xmlEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function toSpreadsheetMl(rows: Array<Record<string, string>>, columns: Array<{ id: string; header: string }>) {
  const headerCells = columns
    .map((col) => `<Cell><Data ss:Type="String">${xmlEscape(col.header)}</Data></Cell>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const raw = row[col.id] ?? "";
          const asNumber = raw !== "" && /^-?\d+(\.\d+)?$/.test(raw);
          if (asNumber) {
            return `<Cell><Data ss:Type="Number">${raw}</Data></Cell>`;
          }
          return `<Cell><Data ss:Type="String">${xmlEscape(raw)}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Transactions">
  <Table>
   <Row>${headerCells}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>
`;
}
