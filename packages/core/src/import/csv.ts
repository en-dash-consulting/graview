/**
 * A SPREADSHEET SAVED AS TEXT, read as rows (FR-177): RFC 4180's quoting —
 * a field in double quotes may hold the delimiter, a line break, and a
 * quote written twice — CRLF, LF or CR line ends, and the byte-order mark
 * Excel writes at the front. A host is as likely to be handed a paste as a
 * file, so the delimiter is read off the first line when it is not given:
 * a tab (a paste from a sheet), a semicolon (a sheet saved where a comma is
 * the decimal mark) or a comma. A blank line is kept as a row of blanks, so
 * every row keeps the number the sheet gave it; `importRows` passes over it.
 */
export interface CsvOptions {
  /** The character between fields. Unsaid, read off the first line: tab, semicolon or comma. */
  readonly delimiter?: string;
}

export function parseCsv(text: string, options: CsvOptions = {}): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = options.delimiter ?? sniff(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let at = 0;
  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (at < source.length) {
    const char = source[at]!;
    if (quoted) {
      if (char === '"') {
        if (source[at + 1] === '"') {
          field += '"';
          at += 2;
          continue;
        }
        quoted = false;
        at += 1;
        continue;
      }
      field += char;
      at += 1;
      continue;
    }
    if (char === '"' && field.trim().length === 0) {
      // A quote opens a field only at its start; spaces before it are not the field's.
      field = "";
      quoted = true;
      at += 1;
      continue;
    }
    if (char === delimiter) {
      endField();
      at += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      endRow();
      at += char === "\r" && source[at + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += char;
    at += 1;
  }
  if (field.length > 0 || row.length > 0) endRow();
  return rows;
}

/** The delimiter the first line uses most, outside quotes: tab, semicolon or comma. */
function sniff(text: string): string {
  const counts = new Map<string, number>([["\t", 0], [";", 0], [",", 0]]);
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  let best = ",";
  for (const [delimiter, count] of counts) if (count > (counts.get(best) ?? 0)) best = delimiter;
  return best;
}
