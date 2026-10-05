/**
 * THE GUEST-VIEW PROTOCOL (FR-04): what a host and a view written by
 * somebody the viewer does not trust may say to each other.
 *
 * The guest runs in `<iframe sandbox="allow-scripts">` and never with
 * `allow-same-origin`, so its origin is opaque ("null"): no cookie, no
 * storage, no store, no token of the host's is reachable from it. It has
 * one way out, a MessageChannel the host hands it once it says it is ready:
 *
 *   guest → parent   { graview: "guest-ready", protocol }            (window.postMessage, once per document)
 *   host  → guest    { graview: "host-hello", protocol, nonce, view } (window.postMessage, with the port)
 *   host  → guest    { type: "props", props }                        (over the port, whenever what it sees moves)
 *   guest → host     { type: "act", nonce, id, name, args }          (over the port: ask for an act)
 *   guest → host     { type: "navigate", nonce, to }                 (over the port: go to a record)
 *   guest → host     { type: "size", nonce, height }                 (over the port: the height it wants)
 *   host  → guest    { type: "answer", id, ok, … }                   (over the port: what became of an act)
 *
 * A GUEST IN A WORKER (FR-68) says the same things. Its `guest-ready` goes
 * to the worker's owner (`self.postMessage`), which is the host by
 * construction, and the hello comes back the same way with the port. A
 * worker has no DOM of its own to draw in, so it draws in the host's, from
 * the component kit alone (kit.ts):
 *
 *   guest → host     { type: "render", nonce, records }              (over the port: Remote DOM mutation records)
 *   host  → guest    { type: "event", listener, detail }             (over the port: a kit event the viewer raised)
 *
 * A frame guest never sends `render`; a host that is not drawing a worker
 * drops it unread.
 *
 * The host answers a `guest-ready` only from its own frame's window and
 * only from the opaque origin, and every request over the port carries the
 * nonce of that hello. What the guest is pushed is the store as the viewer
 * sees it; an act it asks for is applied under the viewer's principal, so
 * the policy refuses on its behalf exactly as it would refuse a click.
 *
 * This module has no imports: a guest bundle carries it and nothing of the
 * framework.
 */

/** Moves only when a guest of the previous protocol can no longer be served. */
export const GUEST_PROTOCOL = 1;

/** The only sandbox token a guest frame is given. Never `allow-same-origin`. */
export const GUEST_SANDBOX = "allow-scripts";

/** The origin a sandboxed frame without `allow-same-origin` posts from. */
export const OPAQUE_ORIGIN = "null";

/** A record as a guest receives it: plain data, only ever one the viewer may see. */
export interface GuestNode {
  readonly id: string;
  readonly kind: string;
  readonly label?: string;
  readonly [field: string]: unknown;
}

/** A link between two records the viewer may both see. */
export interface GuestEdge {
  readonly kind: string;
  readonly from: string;
  readonly to: string;
}

/** An act the viewer may run, by name, as the guest may ask for it. */
export interface GuestAct {
  readonly name: string;
  readonly title: string;
  readonly description?: string;
  /** The kinds the act is done to, when it is done to a record. */
  readonly subject?: { readonly kinds: readonly string[] | "*"; readonly arg: string };
}

/**
 * WHAT A GUEST VIEW IS HANDED: the plain-data half of `ViewProps`, read
 * from the store as the viewer sees it. A record the viewer may not see is
 * not in it — not as a node, a member, an edge or an id in `implicated`.
 */
export interface GuestProps {
  /** The view's registered name: what the rail says an act came through. */
  readonly view: string;
  /** The record, for a `one` view. Absent when the viewer may not see it. */
  readonly node?: GuestNode;
  /** The members, for a `many` view. */
  readonly nodes?: readonly GuestNode[];
  /** The links among the records above. */
  readonly edges: readonly GuestEdge[];
  readonly label?: string;
  readonly fidelity?: "full" | "summary" | "glyph";
  readonly cardinality?: "one" | "many";
  readonly mode?: "scene" | "fullscreen";
  readonly selected?: boolean;
  readonly implicated?: readonly string[];
  readonly flagged?: readonly string[];
  /** The acts the viewer may run here: what the guest may ask for. */
  readonly acts: readonly GuestAct[];
}

/** Why the host did not apply an act the guest asked for. */
export type GuestRefusal =
  /** The policy refused it, in the policy's sentence: the same answer a click would get. */
  | "refused"
  /** More acts than the frame is allowed in the window. */
  | "rate-limited"
  /** No act by that name. */
  | "unknown-act"
  /** The request was not one the protocol knows. */
  | "malformed"
  /** The act ran and threw: its arguments did not fit, or its own rule said no. */
  | "failed";

export type GuestAnswer =
  | { readonly type: "answer"; readonly id: string | number; readonly ok: true; readonly intent: string }
  | { readonly type: "answer"; readonly id: string | number; readonly ok: false; readonly reason: GuestRefusal; readonly message: string };

export interface GuestReady {
  readonly graview: "guest-ready";
  readonly protocol: number;
}

export interface HostHello {
  readonly graview: "host-hello";
  readonly protocol: number;
  readonly nonce: string;
  readonly view: string;
}

/**
 * A kit event the viewer raised on something a worker guest drew: which of
 * the guest's listeners to call, and the one plain value the kit declares
 * for it (an input's text), if any.
 */
export interface GuestEvent {
  readonly type: "event";
  readonly listener: number;
  readonly detail?: string | number | boolean | null;
}

export type HostMessage = { readonly type: "props"; readonly props: GuestProps } | GuestAnswer | GuestEvent;

export type GuestRequest =
  | { readonly type: "act"; readonly nonce: string; readonly id: string | number; readonly name: string; readonly args: Readonly<Record<string, unknown>> }
  | { readonly type: "navigate"; readonly nonce: string; readonly to: string }
  | { readonly type: "size"; readonly nonce: string; readonly height: number }
  /** A worker guest's drawing: Remote DOM mutation records, with each listener sent as `{ listener: id }`. */
  | { readonly type: "render"; readonly nonce: string; readonly records: readonly unknown[] };

/** Whether a window message is a guest saying it is ready. */
export function isGuestReady(data: unknown): data is GuestReady {
  return typeof data === "object" && data !== null && (data as GuestReady).graview === "guest-ready";
}

/** Whether a window message is the host's hello. */
export function isHostHello(data: unknown): data is HostHello {
  const hello = data as HostHello;
  return typeof data === "object" && data !== null && hello.graview === "host-hello" && typeof hello.nonce === "string";
}
