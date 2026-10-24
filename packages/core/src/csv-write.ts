/*
 * ROWS WRITTEN AS A SPREADSHEET SAVES THEM (Roadmap f-view-export-csv), the
 * mirror of `parseCsv`: RFC 4180's quoting — a cell holding a comma, a
 * quote, a carriage return or a line feed is put in double quotes, a quote
 * inside written twice — CRLF between rows, and the byte-order mark at the
 * front so Excel reads "Café" as it was written rather than as "CafÃ©".
 *
 * A CELL IS NEVER A FORMULA. A spreadsheet runs a cell that starts with
 * `=`, `+`, `-` or `@` (and one that starts with a tab or a carriage return
 * as one too), so a record named `=HYPERLINK("http://…")` would be a live
 * link in whoever opened the file. Such a cell is written with an
 * apostrophe in front, which a spreadsheet shows as text and does not run.
 */

/** The byte-order mark Excel writes at the front of a UTF-8 file, and reads as "this is UTF-8". */
export const CSV_BOM = "﻿";

/** The characters a spreadsheet takes as the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/** One cell as a spreadsheet can only read as text: an apostrophe before what it would run as a formula. */
export function csvSafe(cell: string): string {
  return FORMULA_START.test(cell) ? `'${cell}` : cell;
}

/** One cell, quoted where RFC 4180 says it must be. */
export function csvCell(cell: string): string {
  const safe = csvSafe(cell);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export interface ToCsvOptions {
  /** Whether the file starts with the byte-order mark Excel reads UTF-8 by. On unless declined. */
  readonly bom?: boolean;
}

/** Rows of cells as CSV text: each cell guarded and quoted, rows ended with CRLF, the byte-order mark first. */
export function toCsv(rows: readonly (readonly string[])[], options: ToCsvOptions = {}): string {
  const body = rows.map((row) => `${row.map(csvCell).join(",")}\r\n`).join("");
  return options.bom === false ? body : CSV_BOM + body;
}
