import { nounOf, pluralOf, withArticle } from "./schema/define-node.js";

/*
 * A COVERAGE WITH NOTHING TO CROSS (2026-10-15, The Beatles).
 *
 * "Songs by genre" with no genre yet drew its forty songs as a plain list
 * with no columns, which read as the answer to a question it could not yet
 * ask. A coverage with no columns, or with columns and not one link between
 * them over a relation, says so instead of listing its rows — the lens and
 * `describePlace` in these same words.
 */

type Schema = { tryDefinition(kind: string): { readonly noun?: string; readonly plural?: string } | undefined };

/** Why a coverage has nothing to draw yet, and what to do about it; nothing when it has. */
export function coverageUnlinkedWords(schema: Schema, options: { readonly rows: string; readonly columns: string; readonly link?: unknown }, grid: { readonly rows: number; readonly columns: number; readonly cells: number }): string | undefined {
  if (grid.rows === 0) return undefined;
  const rows = pluralOf(schema, options.rows).toLowerCase();
  const columns = pluralOf(schema, options.columns).toLowerCase();
  const same = options.rows === options.columns;
  const link = same ? `link ${rows} to each other` : `link ${rows} to ${columns}`;
  if (grid.columns === 0) return `No ${columns} yet: ${link}.`;
  /* Through a path, the records between can be ones a seat may not see: its grid of empty rows is what that seat's picture is, and is drawn. */
  if (grid.cells > 0 || (typeof options.link === "object" && options.link !== null)) return undefined;
  const row = nounOf(schema.tryDefinition(options.rows), options.rows);
  return same ? `No ${row} is linked to another yet: ${link}.` : `No ${row} is linked to ${withArticle(nounOf(schema.tryDefinition(options.columns), options.columns))} yet: ${link}.`;
}
