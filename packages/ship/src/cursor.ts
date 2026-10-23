/**
 * WHERE A READER STANDS IN A LOG, AS THE WIRE SAYS IT (Roadmap
 * f-1-0-opaque-cursor).
 *
 * A store numbers its ops, and keeps numbering them; but a position said
 * to a client is a TOKEN, a string only the server that gave it reads — so
 * a server that one day merges several writers' logs can say where a
 * reader stands without a single sequence. `GET /graview/since?seq=`,
 * `POST /graview/here`'s `seq` and the live socket's `hello`, `welcome`,
 * `ack` and `ops` carry one. Today a token is `s` and the count of ops
 * through that position in base 36 (`s0` is "none yet"); a client must not
 * read it, build it from an op's `seq`, or compare two.
 *
 * A server accepts the number a page before 0.1.49 sends for one minor
 * as well (pre-1.0): `-1`, `12`, `"12"`.
 */
export type Cursor = string;

/** The token for the position just after op `seq` (-1: none yet). */
export const cursorAt = (seq: number): Cursor => `s${(seq + 1).toString(36)}`;

/** The op seq a token (or, for now, an old page's number) stands at; undefined when it is neither. */
export function seqAt(said: unknown): number | undefined {
  if (typeof said === "number") return Number.isInteger(said) && said >= -1 ? said : undefined;
  if (typeof said !== "string") return undefined;
  if (/^s[0-9a-z]{1,11}$/.test(said)) return parseInt(said.slice(1), 36) - 1;
  return /^-?\d{1,15}$/.test(said) ? seqAt(Number(said)) : undefined;
}
