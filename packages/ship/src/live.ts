import type { FieldConflict, FieldRevision, MutationCall, Operation, Presence, Principal, RefusalReason } from "@graview/core";
export { REFUSAL_REASONS } from "@graview/core";
export type { RefusalReason, WireRefusal } from "@graview/core";

/**
 * THE LIVE WIRE (FR-05): the same store, pushed down a WebSocket.
 *
 * Polling stays — it is the wire a person can reproduce with `curl`, and
 * every runtime answers it — and beside it, at `LIVE_PATH`, one socket per
 * client carries the same things as messages: calls in, the ops they made
 * out, everybody else's ops the moment they land, and who is here. Each
 * message is one JSON object, told apart by `t`.
 *
 * The protocol is numbered by `WIRE_PROTOCOL` (`@graview/core`), which
 * `hello` and `welcome` both say. The socket is an addition to protocol 1,
 * not a new protocol: every client of protocol 1 is still served, so the
 * number stays where it is (docs/stability.md, "The wire").
 *
 * Seqs mean what they mean on `GET /graview/since?seq=N`: the position of
 * an op in the store's log, and a client's seq is the last one it has. -1
 * is "none yet".
 *
 * What a seat may not see holds here exactly as on the HTTP routes (FR-02,
 * FR-16): every op a socket is sent is the op as that seat may see it,
 * withheld in place where it touched what the seat may not see, and who is
 * here is told as the seat may be told it.
 */
export const LIVE_PATH = "/graview/live";

/** What a client says. A field the server does not know is ignored, never refused. */
export type LiveClientMessage =
  /**
   * The first word on a socket. `seq` is the last op the client has: the
   * welcome carries exactly the ops after it. Without one, the welcome
   * carries the whole state, as `GET /graview/state` would.
   */
  | { readonly t: "hello"; readonly seq?: number; readonly protocol?: number }
  /**
   * Calls, as `POST /graview/ops` takes them. `cid` names the answer.
   * `batch` is the batch the ops land in — the client's own provisional
   * one, so a call it sent twice across a reconnect is answered with the
   * ops it already made rather than made again. `base` is the revision of
   * each field the calls change as the client last saw it; one that moved
   * since is a `conflict`. What the calls came through is not the
   * client's to say: the host records its own `via` (FR-52).
   */
  | {
      readonly t: "call";
      readonly cid: string;
      readonly calls: readonly MutationCall[];
      readonly intent?: string;
      readonly batch?: string;
      readonly base?: readonly FieldRevision[];
    }
  /** Batches to take back, judged as the seat that asks. */
  | { readonly t: "undo"; readonly cid: string; readonly batches: readonly string[]; readonly intent?: string; readonly batch?: string }
  /** Where this client is, as `POST /graview/here` takes it. */
  | { readonly t: "here"; readonly presence: Presence }
  /** Gone, as `POST /graview/leave`. */
  | { readonly t: "bye" };

/** What the server says. */
export type LiveServerMessage =
  /**
   * The answer to `hello`: the protocol the server speaks, the last seq in
   * its log, and the ops after the client's seq. `state` only when the
   * hello named no seq.
   */
  | {
      readonly t: "welcome";
      readonly protocol: number;
      readonly seq: number;
      readonly ops: readonly Operation[];
      /** `horizon`: the seq `log` begins at, when the store was compacted (FR-23); absent, 0. */
      readonly state?: { readonly version: number; readonly snapshot: unknown; readonly log: readonly Operation[]; readonly migrated: readonly string[]; readonly enabledModules?: readonly string[]; readonly horizon?: number };
    }
  /** A call or undo landed: the ops it made, in the batch they landed in. Every op before them has already been sent. */
  | { readonly t: "ack"; readonly cid: string; readonly seq: number; readonly batch: string; readonly ops: readonly Operation[] }
  /**
   * Refused, in the policy's own sentence, and why as a code a program can
   * branch on (FR-46): `forbidden`, `missing`, `invalid` or `limit`
   * (`REFUSAL_REASONS`), with `wouldNeed` — the roles that could — when
   * the policy knows them. Final: nothing landed, and the client takes the
   * change back.
   */
  | { readonly t: "refused"; readonly cid: string; readonly sentence: string; readonly reason: RefusalReason; readonly wouldNeed?: readonly string[] }
  /**
   * NOT NOW (FR-45): the host is busy — a rate, a queue — and the call was
   * not judged. Nothing landed, and nothing is refused: the client keeps
   * the change shown and sends it again after `retryAfter` milliseconds.
   * Every later call on the socket is busy too until this `cid` comes
   * again, so a burst lands in the order it was made.
   */
  | { readonly t: "busy"; readonly cid?: string; readonly retryAfter: number; readonly sentence?: string }
  /** A stale write: each field that moved since the call's base, theirs and yours. Nothing landed. */
  | { readonly t: "conflict"; readonly cid: string; readonly sentence: string; readonly conflicts: readonly FieldConflict[] }
  /** Ops that landed, everybody's, in seq order and none skipped; `seq` is the last of them. */
  | { readonly t: "ops"; readonly seq: number; readonly ops: readonly Operation[] }
  /** Who else is here now. */
  | { readonly t: "presence"; readonly who: readonly Presence[] }
  /** A message the server could not read. */
  | { readonly t: "error"; readonly sentence: string };

/**
 * WHAT A HOST'S `limit` IS ASKED (FR-45, FR-46): one change, from one seat,
 * before it is judged — on the socket a `call` or an `undo`, over HTTP the
 * body of `POST /graview/ops`.
 */
export interface LimitAsked {
  readonly seat: Principal;
  /** What the change came through, as the host said it (FR-52). */
  readonly via: string;
  readonly t: "call" | "undo";
  /** Its size on the wire, in UTF-8 bytes: the socket message, or the request body. */
  readonly bytes: number;
  /** The calls it carries; none for an undo. */
  readonly calls: readonly MutationCall[];
}

/**
 * WHAT A HOST'S `limit` ANSWERS. Nothing: the change goes on to be judged.
 *
 * - `{ retryAfter, sentence? }` — BUSY: not now (a rate, a queue). The
 *   socket says `busy` and HTTP answers 429 with `Retry-After`; the client
 *   keeps the change and sends it again after `retryAfter` milliseconds.
 * - `{ refuse }` — REFUSED, reason `limit`: never as asked (over a hard
 *   size cap, more calls in one batch than the host takes). The socket says
 *   `refused` and HTTP answers 413; the client takes the change back.
 */
export type LimitAnswer = { readonly retryAfter: number; readonly sentence?: string } | { readonly refuse: string };

/** A host's word on whether a change may be judged now: busy, refused at its limit, or nothing. */
export type Limit = (asked: LimitAsked) => LimitAnswer | undefined | Promise<LimitAnswer | undefined>;

/** A message's size in UTF-8 bytes, as a host's cap counts it. */
export function bytesOf(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * WHAT A HOST HANDS THE PROTOCOL: a way to send one text message down the
 * socket, and to close it. A Worker's `WebSocketPair`, a Durable Object's
 * accepted socket, Node's upgrade, a test's array: whatever carries text.
 */
export interface LiveSocket {
  send(text: string): void;
  close?(code?: number, reason?: string): void;
}

/** The server's end of one socket: hand it every message the client sends, and say when the socket closed. */
export interface LiveConnection {
  receive(text: string): void;
  close(): void;
}

/** Said as a person would read it: a short value, or "nothing". */
export function sayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "nothing";
  if (typeof value === "string") return `“${value.length > 60 ? `${value.slice(0, 57)}…` : value}”`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** "Ana changed label to “Book the church hall” while you were editing; yours was “Book the village hall”. Keep theirs, or send yours again." */
export function conflictSentence(conflicts: readonly FieldConflict[]): string {
  const first = conflicts[0];
  if (!first) return "Someone changed this while you were editing.";
  const more = conflicts.length > 1 ? ` (and ${conflicts.length - 1} more)` : "";
  return `${first.by} changed ${first.field} to ${sayValue(first.theirs)} while you were editing; yours was ${sayValue(first.yours)}${more}. Keep theirs, or send yours again.`;
}
