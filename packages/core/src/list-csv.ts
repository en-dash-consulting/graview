import type { AnySchema } from "./schema/schema.js";
import type { AnyGraphNode, GraphReader } from "./graph/types.js";
import type { labelOf } from "./schema/define-node.js";
import type { readableFields } from "./schema/reading.js";
import type { withComputed } from "./document/computed-values.js";
import type { KeptViews } from "./views/kept.js";
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

/**
 * HOW A RECORD IS SAID, handed in by whoever draws it: `labelOf` from
 * `@graview/core`, `readableFields` from `@graview/core/words` and
 * `withComputed` from `@graview/core/blocks`, which a page that draws a
 * list holds already. This module imports none of them, so fetching it with
 * the press brings only what writes the file and splits none of the chunks
 * a page shares them in.
 */
export interface ListWords {
  readonly labelOf: typeof labelOf;
  readonly readableFields: typeof readableFields;
  readonly withComputed: typeof withComputed;
}

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
  /** How a record is said (`ListWords`). */
  readonly words: ListWords;
}

/** The header and the rows of a shown list, each cell said as the page says it. */
export function listCsvRows(options: ListCsvOptions): string[][] {
  const { schema, graph, kind } = options;
  const { labelOf, readableFields, withComputed } = options.words;
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
  const header = [...(options.grouped ? ["Group"] : []), "Name", ...columns.map((column) => column.label.charAt(0).toUpperCase() + column.label.slice(1))];
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

/** A place's list as it is shown, ready to save: what `listCsv` reads, the title the file is named by, and where the host saves it. */
export interface ShownListToExport extends ListCsvOptions {
  /** The place's title, which names the file: "Tasks — 2026-10-23.csv". */
  readonly title: string;
  /** Where a host that saves files itself takes it; unsaid, the browser downloads it. */
  readonly onExport?: ((csv: string, filename: string) => void | Promise<void>) | undefined;
}

/**
 * WHAT A DRAWN PLACE SAYS IT SHOWS, for the place menu to export by: kept on
 * the page in a map on `globalThis` under `Symbol.for("graview.shown-lists")`
 * (`Map<string, () => ShownListSaid>`), by `list:<kind>` or `place:<as>`, as
 * each is drawn — so the menu reads it without importing what draws it, and
 * nothing up front imports this module to find it.
 */
export interface ShownListSaid {
  /** `true` where the declaration offers nobody "Export CSV" here: the owner is offered "Turn on export". */
  readonly off: boolean;
  /** What `set-lens-export` names: a lens by its title and kind, a kind's list by its kind. */
  readonly about: { readonly lens: string; readonly on?: string } | { readonly kind: string };
  /** The list as it is shown now, asked when somebody presses Export. */
  read(): ShownListToExport;
  /**
   * The place menu's rows for it: "Export CSV" unless it is off, and for
   * whoever may change the declaration (`owner`, with the host's `keeper`)
   * "Turn off export" or "Turn on export" (`switchExport`). Made by the
   * list, so a menu drawn before any list carries none of their words.
   */
  menu(owner: boolean, keeper: Pick<KeptViews, "lens"> | undefined, board: ExportNotices | null): { readonly id: string; readonly label: string; readonly run: () => void }[];
}

/** Where a page says what an act did: a notice board's `notify`, as `@graview/primitives` draws one. */
export interface ExportNotices {
  notify(notice: { readonly kind: "toast"; readonly tone?: "bad"; readonly sentence: string }): unknown;
}

/**
 * "EXPORT CSV" OFFERED ON A PLACE, OR TO NOBODY, FROM ITS MENU: a change to
 * the declaration the host writes — `set-lens-export`, on a lens by its
 * title, on a kind's list by its kind — said in the page's notices once it
 * is done, or in the host's words when it refused. Fetched with the press.
 */
export async function switchExport(said: Pick<ShownListSaid, "about" | "read">, keeper: Pick<KeptViews, "lens">, on: boolean, board?: ExportNotices | null): Promise<boolean> {
  const title = said.read().title;
  const about = said.about;
  try {
    await keeper.lens?.("kind" in about ? { op: "set-lens-export", title: about.kind, export: on } : { op: "set-lens-export", title: about.lens, ...(about.on !== undefined ? { on: about.on } : {}), export: on });
  } catch (error) {
    board?.notify({ kind: "toast", tone: "bad", sentence: error instanceof Error && error.message ? error.message : on ? `Export could not be turned on for “${title}”.` : `Export could not be turned off for “${title}”.` });
    return false;
  }
  board?.notify({ kind: "toast", sentence: on ? `“${title}” offers Export CSV again.` : `“${title}” offers Export CSV to nobody now.` });
  return true;
}

/** What a page downloads with: the few browser names `saveShownList` reaches for, read off `globalThis`. */
interface Downloading {
  readonly Blob: new (parts: readonly string[], options: { type: string }) => object;
  readonly URL: { createObjectURL(blob: object): string; revokeObjectURL(url: string): void };
  readonly document: { createElement(tag: "a"): { href: string; download: string; click(): void } };
}

/**
 * WRITES A SHOWN LIST AND SAVES IT (Roadmap f-view-export-csv): handed to the
 * host's `onExport` where it saves files itself, else downloaded by the
 * browser through a link made for the click and never put in the page.
 */
export async function saveShownList(list: ShownListToExport): Promise<void> {
  const csv = listCsv(list);
  const name = csvFileName(list.title);
  if (list.onExport) return void (await list.onExport(csv, name));
  const page = globalThis as unknown as Downloading;
  const url = page.URL.createObjectURL(new page.Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = page.document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Taken back once the browser has begun the download.
  setTimeout(() => page.URL.revokeObjectURL(url), 30_000);
}
