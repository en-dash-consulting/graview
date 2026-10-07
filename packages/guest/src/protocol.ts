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
 *   guest → host     { type: "navigate", nonce, place }              (over the port: go to a named place of the app, by its slug)
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
 * A WORKER VIEW ON THE OPEN KIT (FR-90) draws HTML, SVG and CSS rather than
 * the kit's components, so its records name native elements and their
 * attributes, and it says two things more and hears one:
 *
 *   guest → host     { type: "style", nonce, css }                   (over the port: its one stylesheet)
 *   guest → host     { type: "pushed", nonce, push, ms }             (over the port: the runtime has drawn push `push`, in `ms`)
 *   host  → guest    { type: "dom-event", target, event, … }         (over the port: the viewer clicked, typed or chose on what it drew)
 *
 * The host draws a stylesheet only as the open kit allows (host/css.ts),
 * and numbers each props push (`push`) so the runtime can say when it has
 * drawn it.
 *
 * A worker's host also watches that the worker is alive. Its runtime — not
 * the guest's code, which can stop it only by blocking its own event loop —
 * answers each heartbeat with the beat it was asked, and a worker that goes
 * `limits.silentMs` without an answer is stopped:
 *
 *   host  → guest    { type: "heartbeat", beat }                     (over the port, on an interval)
 *   guest → host     { type: "heartbeat", nonce, beat }              (over the port: the runtime's answer)
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
 * THE APP'S LOOK, AS A WORKER VIEW IS HANDED IT (FR-91): the scheme the app
 * is drawn in now — the app's own toggle, not the system's preference —
 * and the tokens a view draws with, as CSS colours and font stacks. The
 * same tokens reach a view's stylesheet as `--graview-*` custom
 * properties; these are for what a view computes.
 */
export interface GuestTheme {
  readonly scheme: "light" | "dark";
  readonly accent: string;
  readonly ground: string;
  readonly panel: string;
  readonly ink: string;
  readonly inkMuted: string;
  readonly edge: string;
  readonly fontBody: string;
  /** Headings and the wordmark (FR-127): `--graview-font-display`. */
  readonly fontDisplay: string;
  readonly fontMono: string;
  /** A panel's corner (FR-127): `--graview-radius`, as a CSS length. */
  readonly radius: string;
  /** The app's name, as its wordmark says it (FR-127). Absent when the app has no brand. */
  readonly name?: string;
  /**
   * The brand's logo (FR-127), for `<img src>`: a `blob:` URL of the host's
   * page for a worker view, a `data:` image for a frame — the host made it,
   * so the view loads nothing. Absent when the brand has none, or names one
   * on another origin.
   */
  readonly logo?: string;
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
  /** The app's look now, for a worker view (FR-91): pushed again when the app's scheme changes. */
  readonly theme?: GuestTheme;
  /** The app's named places, for a worker view to link to by slug (FR-93): never an address outside the app. */
  readonly places?: readonly GuestPlace[];
}

/** A named place of the app: a picture by its title, and the slug a link names it by. */
export interface GuestPlace {
  readonly as: string;
  readonly title: string;
  readonly kind: string;
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
  | "failed"
  /** A worker view asked for an act its manifest does not name (FR-92). */
  | "undeclared"
  /**
   * A worker view asked for an act from its own code, in an app where some
   * members may not see some records: there, an act applies only from the
   * viewer's own press on what the view drew (FR-92).
   */
  | "press-only"
  /** A press would have carried a field's value the view filled in, not one the viewer typed (FR-92). */
  | "untyped"
  /** A press was bound (`data-record`) to a record the view was not shown, or to an act that takes none (FR-92). */
  | "unbound";

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

/** The host asking a worker guest's runtime whether it is still answering. */
export interface HostHeartbeat {
  readonly type: "heartbeat";
  readonly beat: number;
}

/**
 * What the viewer did on something an open-kit view drew (FR-90): which
 * node (the view's own id for it), and what the host read off it — a
 * field's `value` and `checked`, a key's name — never anything of the
 * host's page.
 */
export interface GuestDomEvent {
  readonly type: "dom-event";
  /** The view's id for the node it happened on. */
  readonly target: string;
  /** `click`, `input`, `change`, `keydown` or `toggle`. */
  readonly event: string;
  readonly value?: string;
  readonly checked?: boolean;
  readonly key?: string;
  /**
   * What became of the act the press was bound to (`data-act`), when it
   * was: applied by the host in the press's own handler, before the view
   * heard of it (FR-92).
   */
  readonly pressed?: GuestPressed;
}

/** The answer to a press bound to an act: the act's name, and whether it applied or why not. */
export interface GuestPressed {
  /** What the view called it (`data-act`). */
  readonly as: string;
  readonly ok: boolean;
  readonly intent?: string;
  readonly reason?: GuestRefusal;
  readonly message?: string;
}

export type HostMessage =
  /** `push` numbers it, for a worker view's runtime to say when it has drawn it (FR-94). */
  | { readonly type: "props"; readonly props: GuestProps; readonly push?: number }
  | GuestAnswer
  | GuestEvent
  | GuestDomEvent
  | HostHeartbeat;

export type GuestRequest =
  | { readonly type: "act"; readonly nonce: string; readonly id: string | number; readonly name: string; readonly args: Readonly<Record<string, unknown>> }
  | { readonly type: "navigate"; readonly nonce: string; readonly to: string }
  /** Go to a named place of this app, by its slug (FR-93): a worker view's links stay in the app. */
  | { readonly type: "navigate"; readonly nonce: string; readonly place: string }
  | { readonly type: "size"; readonly nonce: string; readonly height: number }
  /** A worker guest's drawing: Remote DOM mutation records, with each listener sent as `{ listener: id }`. */
  | { readonly type: "render"; readonly nonce: string; readonly records: readonly unknown[] }
  /** The runtime's answer to a heartbeat, with the beat it was asked. */
  | { readonly type: "heartbeat"; readonly nonce: string; readonly beat: number }
  /** An open-kit view's one stylesheet (FR-90): the host draws what the open kit allows of it. */
  | { readonly type: "style"; readonly nonce: string; readonly css: string }
  /** An open-kit view's runtime has drawn props push `push`, its listeners taking `ms` (FR-94). */
  | { readonly type: "pushed"; readonly nonce: string; readonly push: number; readonly ms: number };

/** Whether a window message is a guest saying it is ready. */
export function isGuestReady(data: unknown): data is GuestReady {
  return typeof data === "object" && data !== null && (data as GuestReady).graview === "guest-ready";
}

/** Whether a window message is the host's hello. */
export function isHostHello(data: unknown): data is HostHello {
  const hello = data as HostHello;
  return typeof data === "object" && data !== null && hello.graview === "host-hello" && typeof hello.nonce === "string";
}
