/**
 * CSV encoding with protection against spreadsheet formula injection: a cell
 * starting with = + - @ or a control character is prefixed with a quote so
 * Excel and Google Sheets show it as text instead of running it.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
