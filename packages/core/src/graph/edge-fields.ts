import type { GraphEdge } from "./types.js";

/**
 * A LINK'S OWN FIELDS, RESERVED FOR 1.0 (Roadmap f-1-0-edge-fields).
 *
 * A link may carry an `id` and a `data` object, kept and folded by every
 * reader. What a write of one is held to: an id of 1–`idLength`
 * characters with no space or control character in it, and data that is
 * a JSON object of at most `dataLength` characters as JSON. A second link
 * of one kind between one pair stays refused (`sameKindPerPair: 1`) until
 * a version opens it — which it can do without a break, since every
 * reader already tells two links apart by id.
 */
export const EDGE_FIELDS = { idLength: 200, dataLength: 4096, sameKindPerPair: 1 } as const;

/** What is wrong with a link's id or data, in a sentence; undefined when nothing is. */
export function edgeFieldsProblem({ id, data }: GraphEdge): string | undefined {
  if (id !== undefined && !(typeof id === "string" && id.length <= EDGE_FIELDS.idLength && /^[^\s\p{Cc}]+$/u.test(id))) return `A link's id is 1–${EDGE_FIELDS.idLength} characters with no space`;
  if (data !== undefined && !(data && typeof data === "object" && !Array.isArray(data) && JSON.stringify(data).length <= EDGE_FIELDS.dataLength)) return `A link's data is a JSON object of at most ${EDGE_FIELDS.dataLength} characters`;
  return undefined;
}
