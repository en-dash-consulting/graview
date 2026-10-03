import type { FieldConflict, FieldRevision, MutationCall, Operation, Presence } from "@graview/core";

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
   * since is a `conflict`.
   */
  | {
      readonly t: "call";
      readonly cid: string;
      readonly calls: readonly MutationCall[];
      readonly intent?: string;
      readonly batch?: string;
      readonly via?: string;
      readonly base?: readonly FieldRevision[];
    }
  /** Batches to take back, judged as the seat that asks. */
  | { readonly t: "undo"; readonly cid: string; readonly batches: readonly string[]; readonly intent?: string; readonly batch?: string; readonly via?: string }
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
      readonly state?: { readonly version: number; readonly snapshot: unknown; readonly log: readonly Operation[]; readonly migrated: readonly string[] };
    }
  /** A call or undo landed: the ops it made, in the batch they landed in. Every op before them has already been sent. */
  | { readonly t: "ack"; readonly cid: string; readonly seq: number; readonly batch: string; readonly ops: readonly Operation[] }
  /** Refused, in the policy's own sentence. Nothing landed. */
  | { readonly t: "refused"; readonly cid: string; readonly sentence: string }
  /** A stale write: each field that moved since the call's base, theirs and yours. Nothing landed. */
  | { readonly t: "conflict"; readonly cid: string; readonly sentence: string; readonly conflicts: readonly FieldConflict[] }
  /** Ops that landed, everybody's, in seq order and none skipped; `seq` is the last of them. */
  | { readonly t: "ops"; readonly seq: number; readonly ops: readonly Operation[] }
  /** Who else is here now. */
  | { readonly t: "presence"; readonly who: readonly Presence[] }
  /** A message the server could not read. */
  | { readonly t: "error"; readonly sentence: string };

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
