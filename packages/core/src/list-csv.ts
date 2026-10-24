import type { AnySchema } from "./schema/schema.js";
import type { AnyGraphNode, GraphReader } from "./graph/types.js";
import { capitalize } from "./capital.js";
import { labelOf } from "./schema/define-node.js";
import { readableFields } from "./schema/reading.js";
import { withComputed } from "./document/computed-values.js";
import { toCsv } from "./csv-write.js";

/*
 * A PLACE'S LIST, WRITTEN AS IT IS SHOWN (Roadmap f-view-export-csv): the
 * records in the place's order, with its filter, its words and its groups —
 * a "Group" column first when it is grouped, then each record's name, then
 * the fields its page reads, computed ones too, each said as the page says
 * it (money in the app's currency, a day in its locale, a choice as it is
 * declared). Never more than the seat sees: the rows are the records the
 * caller's store serves its seat, so a field its sight keeps is in no row,
 * and a field in no row is no column.
 */

/** One group of a shown list: its words (unsaid when the list is not grouped) and its records, in order. */
export interface ListCsvGroup {
  readonly label?: string;
  readonly nodes: readonly ({ readonly id: string; readonly kind: string } & object)[];
}

export interface ListCsvOptions {
  readonly schema: AnySchema;
  /** The graph the records are read in, as the seat sees it: what a computed field is worked out over. */
  readonly graph: GraphReader;
  readonly kind: string;
  readonly groups: readonly ListCsvGroup[];
  /** Whether the list is drawn in groups, and so whether the first column says which. */
  readonly grouped: boolean;
  /** The locale days are said in; the page's when unsaid. */
  readonly locale?: string | undefined;
  /** The time zone instants are said in; the page's when unsaid. */
  readonly timeZone?: string | undefined;
}

/** The header and the rows of a shown list, each cell said as the page says it. */
export function listCsvRows(options: ListCsvOptions): string[][] {
  const { schema, graph, kind } = options;
  const definition = schema.tryDefinition(kind);
  const computed = Object.keys((definition as { computed?: object } | undefined)?.computed ?? {}).length > 0;
  const read = (node: ListCsvGroup["nodes"][number]) => (computed ? withComputed(schema, graph, node as AnyGraphNode) : node) as unknown as { id: string; kind: string } & Record<string, unknown>;
  const rows = options.groups.flatMap((group) =>
    group.nodes.map((node) => {
      const record = read(node);
      const name = labelOf(definition, record);
      // The name is its own column: a field that only says it again (a title the label is) is not a second one, as on the record's page.
      const fields = readableFields(record, definition, { said: [name], locale: options.locale, timeZone: options.timeZone });
      return { group: group.label ?? "", name, fields };
    }),
  );
  /*
   * THE COLUMNS, IN THE ORDER A RECORD'S PAGE READS ITS FIELDS — the ones
   * its page names first, then the kind's as it declares them, its computed
   * ones after — of every field some row says. A field no row says — kept
   * by the seat's sight, or empty everywhere — is no column.
   */
  const page = definition?.display?.page;
  const declared = [...(page?.fields ?? []), ...(page?.groups ?? []).flatMap((one) => one.fields), ...Object.keys((definition?.fields as { shape?: object } | undefined)?.shape ?? {}), ...Object.keys((definition as { computed?: object } | undefined)?.computed ?? {})];
  const labels = new Map<string, string>();
  for (const row of rows) for (const field of row.fields) if (!labels.has(field.key)) labels.set(field.key, field.label);
  const rank = (key: string) => {
    const at = declared.indexOf(key);
    return at < 0 ? declared.length : at;
  };
  const columns = [...labels].map(([key, label], at) => ({ key, label, at })).sort((a, b) => rank(a.key) - rank(b.key) || a.at - b.at);
  const header = [...(options.grouped ? ["Group"] : []), "Name", ...columns.map((column) => capitalize(column.label))];
  const body = rows.map((row) => {
    const values = new Map(row.fields.map((field) => [field.key, field.value]));
    return [...(options.grouped ? [row.group] : []), row.name, ...columns.map((column) => values.get(column.key) ?? "")];
  });
  return [header, ...body];
}

/** A shown list as CSV text, ready to save: the byte-order mark, a header, a row a record. */
export function listCsv(options: ListCsvOptions): string {
  return toCsv(listCsvRows(options));
}

/**
 * THE FILE A LIST IS SAVED AS: the place's title and the day, "Tasks —
 * 2026-10-23.csv", the characters a file system refuses (`/ \ : * ? " < > |`
 * and control characters) replaced with a dash.
 */
export function csvFileName(title: string, day: Date | string = new Date()): string {
  const date = typeof day === "string" ? day.slice(0, 10) : `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  // eslint-disable-next-line no-control-regex
  const safe = title.replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, "-").replace(/\s+/g, " ").trim().replace(/^\.+/, "") || "List";
  return `${safe} — ${date}.csv`;
}
