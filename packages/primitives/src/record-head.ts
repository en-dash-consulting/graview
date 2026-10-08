import { createContext, type ReactNode } from "react";

/**
 * A RECORD'S DECLARED HEAD, handed to the framework's own record (FR-141).
 *
 * A kind's `page` view heads its record. In the scene the two were drawn
 * as two things: the page's blocks bare, centered on a box the record's
 * card was sized for and spilling out of it under the bar and over the
 * neighbors, and the record's card in front saying the same goal and the
 * same four topics again. Now the page is drawn INSIDE the record's own
 * frame, as its head: the page's title is the frame's title, its blocks
 * come first, and the record adds only what the page did not say — the
 * fields it left out (each editable where an act writes it) and the ties it
 * did not list.
 */
export interface RecordHead {
  /** The record this head belongs to: a record drawn inside it is not headed by it. */
  readonly nodeId: string;
  /** The page's own title, when its first block is one. */
  readonly title?: string;
  /** The page's blocks, drawn: the head of the frame. */
  readonly body: ReactNode;
  /** The fields the page already says. */
  readonly fields: ReadonlySet<string>;
  /** The records the page already lists. */
  readonly records: ReadonlySet<string>;
}

export const RecordHeadContext = createContext<RecordHead | null>(null);
