/**
 * AN ARCHIVED RECORD (FR-173) is kept — its fields, its links, its history —
 * and set aside: out of lists, the Scene, counts, computed fields and rules
 * by default, still found by its id, by search, and on its own page. It is
 * said on the record itself, under a key no declared field can take (a
 * field is a word; `$` begins none), so it goes wherever the record goes —
 * the log, an adapter, an export — and an undo is the patch's inverse.
 */
export const ARCHIVED = "$archived";

/**
 * Which records a read reaches: `false` (the default) the live ones, `true`
 * only the archived ones, `"all"` both.
 */
export type Archived = boolean | "all";

/** The option every graph read that lists records takes. */
export interface ArchivedOption {
  readonly archived?: Archived;
}

/** Whether a record is archived. */
export const isArchived = (node: unknown): boolean => (node as Record<string, unknown> | null | undefined)?.[ARCHIVED] === true;

/** Whether a record is one a read asking for `archived` reaches. */
export const reaches = (node: unknown, archived: Archived = false): boolean => archived === "all" || isArchived(node) === archived;

/** `archived` read off a caller's words: `true` or `"true"`, `"all"`; anything else is the live records. */
export const archivedFrom = (value: unknown): Archived => (value === true || value === "true" ? true : value === "all" ? "all" : false);
