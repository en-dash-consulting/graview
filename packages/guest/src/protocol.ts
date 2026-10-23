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
 *   guest → host     { type: "navigate", nonce, to, section? }       (over the port: go to a record)
 *   guest → host     { type: "navigate", nonce, place, where?, section? } (over the port: go to a named place or a kind's list, by its slug, narrowed)
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
 *   guest → host     { type: "style", nonce, sheets }                (over the port: its stylesheets, in order)
 *   guest → host     { type: "pushed", nonce, push, ms }             (over the port: the runtime has drawn push `push`, in `ms`)
 *   host  → guest    { type: "dom-event", target, event, … }         (over the port: the viewer clicked, typed or chose on what it drew)
 *   host  → guest    { type: "notice", text }                        (over the port: something it did went nowhere, and why, for its console)
 *
 * A GUEST THAT ASKS FOR PICTURES (FR-175) — a worker view's manifest or a
 * frame's host saying `pictures` — is handed each file on a record it is
 * handed as a `GuestFile`, in the record's field, where the record keeps a
 * path on the host: nothing new is said on the wire, and a guest that does
 * not ask is handed what it always was.
 *
 * A WORKER VIEW THAT TAKES FILES (FR-193) — its manifest saying `accepts`,
 * an element it drew saying `data-drop` — says one thing more, and hears
 * one: what it listens for, so the host knows whether to leave a drop to
 * it, and a drop the host has stored.
 *
 *   guest → host     { type: "hears", nonce, events }                (over the port: the events its `graview.on` listens for, each once)
 *   guest → host     { type: "clicks", nonce, selectors }           (over the port: where its `graview.on("click", …)` listens, all of it, again whenever it moves)
 *   host  → guest    { type: "dom-event", target, event: "drop", files, refused? } (over the port: files the person dropped, stored)
 *
 * And an act may be asked for several times as one change, one undo:
 * `{ type: "act", …, name, args: [args, …] }`.
 *
 * A WORKER VIEW THAT TAKES GESTURES (0.1.42) — its manifest saying
 * `gestures: true` — says where it listens for a wheel, a drag and a pinch,
 * and hears each, at most once an animation frame, its deltas coalesced:
 *
 *   guest → host     { type: "gestures", nonce, bound: [{ event, selector }, …] } (over the port: where `graview.on("wheel" | "drag" | "pinch", selector, …)` listens, all of it, again whenever it moves)
 *   host  → guest    { type: "dom-event", target, event: "wheel", deltaX, deltaY, deltaMode, ctrlKey, metaKey, x, y, width, height }
 *   host  → guest    { type: "dom-event", target, event: "drag", phase, pointerId, button, pressure, x, y, dx, dy, width, height }
 *   host  → guest    { type: "dom-event", target, event: "pinch", phase, scale, rotation, x, y, width, height }
 *
 * `x` and `y` are where the pointer is, in CSS pixels from the top left of
 * the element the selector matched, and `width` and `height` that
 * element's size, so a view maps them to its own coordinates without a
 * layout of its own. The host takes a wheel or a pinch from the page — its
 * `preventDefault` — only over an element a view that opted in listens on;
 * everywhere else the page scrolls and zooms as it always did.
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

/**
 * A record as a guest receives it: plain data, only ever one the viewer may
 * see. Its `id`, `kind` and `label`, and each of its declared fields on it
 * by name — a deliverable's draft is `node.draft` — with no `fields` key.
 */
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
 * and the tokens a view draws with, as CSS colors and font stacks. The
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
 * A FILE ON A RECORD, AS A GUEST THAT ASKED FOR PICTURES IS HANDED IT
 * (FR-175). Where the record keeps a file (`FileValue`, FR-162), a guest
 * that declared `pictures` is handed this in its place, never the host's
 * path to it: a sandboxed frame or a worker cannot load that path with the
 * reader's credentials, and should not learn it.
 *
 * A picture (`image/*`, not SVG) carries `src`, an address for
 * `<img src>` the host made from the bytes it fetched as the reader: a
 * `blob:` URL of the host's page for a worker view, a `data:` image for a
 * frame, as the brand's logo is (FR-127). It is absent while the host is
 * making it (the guest is pushed again when it has), and where the picture
 * was left out — past the view's budget, past one picture's, or not
 * loaded — `left` says why. A document, and an SVG, is its name, type and
 * size alone.
 */
export interface GuestFile {
  /** What it was called when it was put on the record: `porch.jpg`. */
  readonly name: string;
  /** Its media type, as the record keeps it. */
  readonly type: string;
  /** Its size in bytes, as the record keeps it. */
  readonly bytes: number;
  /** A picture's size in pixels, where the record says it. */
  readonly width?: number;
  readonly height?: number;
  /** What a picture or a video shows, in words: its alt text. */
  readonly caption?: string;
  /**
   * A video's length in seconds, where the record says it (0.1.37). A video
   * is handed its facts and never an address: the host plays it where the
   * view places `<graview-video data-record data-field>`.
   */
  readonly duration?: number;
  /** A picture's address for `<img src>`, made by the host from the bytes. Smaller than the file where the view needs no more. */
  readonly src?: string;
  /** Why a picture was left out, in a sentence that names the view. */
  readonly left?: string;
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
  /** The members, for a `many` view, and the records a view reads beyond its own. A `one` view's own record is `node`, never one of these. */
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
  /**
   * WHAT A VIEW SAYS A DAY AND A TIME IN (FR-178, Roadmap f-app-time-zone):
   * the locale ("en-US") and the IANA time zone ("America/New_York") every
   * other surface of the app says them in — the person's a host passed,
   * else the app's `brand.locale` and `brand.timeZone`, else the runtime's.
   * A record holds an instant as it is kept (`2026-10-16T14:47:00Z`); a
   * view says it with `new Intl.DateTimeFormat(props.locale, { timeZone:
   * props.timeZone, hour: "numeric", minute: "2-digit" })`, never a zone
   * of its own.
   */
  readonly locale?: string;
  readonly timeZone?: string;
}


/** What a list or a place is narrowed to: a field and the one value it keeps, `{ stage: "building" }`. */
export type GuestWhere = Readonly<Record<string, string | number | boolean>>;

/**
 * WHERE A VIEW ASKS TO GO: a record by its id (a bare string is a record
 * first, then a place by that slug); a named place, or a kind's list by its
 * plural (`"features"`) or its name — narrowed by `where`, in the kind's
 * own fields — and either one to a `section` of its page, a heading's
 * words or an element's id.
 *
 *   graview.navigate({ place: "features", where: { stage: "building" }, section: "shipping-soon" })
 */
export type GuestNavigateTo =
  | string
  | { readonly record: string; readonly section?: string }
  | { readonly place: string; readonly where?: GuestWhere; readonly section?: string };

/** The message a destination is sent as, without its nonce: what the host judges (a `where` on a record is refused there, in a sentence). */
export function navigateRequest(to: GuestNavigateTo): { readonly type: "navigate"; readonly to: string; readonly where?: GuestWhere; readonly section?: string } | { readonly type: "navigate"; readonly place: string; readonly where?: GuestWhere; readonly section?: string } | undefined {
  if (typeof to === "string") return { type: "navigate", to };
  const { place, record, where, section } = (to ?? {}) as { place?: unknown; record?: unknown; where?: GuestWhere; section?: unknown };
  const also = { ...(where === undefined ? {} : { where }), ...(section === undefined ? {} : { section: String(section) }) };
  return typeof place === "string" ? { type: "navigate", place, ...also } : typeof record === "string" ? { type: "navigate", to: record, ...also } : undefined;
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
  /**
   * `click`, `input`, `change`, `keydown` or `toggle`; or `acted`, what
   * became of an act a press or a field saved as it is typed asked for, on
   * the element bound to it (FR-191); or `drop`, files the person dropped
   * on (or picked for) an element marked `data-drop`, stored by the host
   * (FR-193); or `wheel`, `drag` and `pinch`, a gesture over an element a
   * view whose manifest says `gestures: true` listens on (0.1.42).
   */
  readonly event: string;
  readonly value?: string;
  readonly checked?: boolean;
  readonly key?: string;
  /**
   * What became of the act the press was bound to (`data-act`), when it
   * was: applied by the host in the press's own handler, before the view
   * heard of it (FR-92). On `acted`, what became of the act a press or a
   * field's save (`data-save`) asked for (FR-191).
   */
  readonly pressed?: GuestPressed;
  /** On `drop`: each file the host stored, as it keeps it (FR-193). */
  readonly files?: readonly GuestDroppedFile[];
  /** On `drop`: each file the host would not take, and why, in a sentence. */
  readonly refused?: readonly string[];
  /** On `wheel`, `drag` and `pinch` (0.1.42): where the pointer is, in CSS pixels from the top left of the element the view listens on. */
  readonly x?: number;
  readonly y?: number;
  /** On `wheel`, `drag` and `pinch`: the size of the element the view listens on, in CSS pixels. */
  readonly width?: number;
  readonly height?: number;
  /** On `wheel`: how far it scrolled since the view last heard, summed over the frame, in `deltaMode`'s units (0 pixels, 1 lines, 2 pages). */
  readonly deltaX?: number;
  readonly deltaY?: number;
  readonly deltaMode?: number;
  /** On `wheel`: whether Control or Meta was held. A trackpad's pinch is a wheel with Control held, heard as `pinch` where the view listens for it. */
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  /** On `drag` and `pinch`: `start`, `move` (a drag) or `change` (a pinch), and `end`. */
  readonly phase?: "start" | "move" | "change" | "end";
  /** On `drag`: which pointer, its button when it went down, and how hard it presses (0 to 1). */
  readonly pointerId?: number;
  readonly button?: number;
  readonly pressure?: number;
  /** On `drag`: how far it moved since the view last heard of this pointer, in CSS pixels. */
  readonly dx?: number;
  readonly dy?: number;
  /** On `pinch`: the factor it grew by since the view last heard (above 1 apart, below 1 together), and its turn in degrees. */
  readonly scale?: number;
  readonly rotation?: number;
}

/** The gestures a view may listen for, with `gestures: true` in its manifest (0.1.42). */
export const GUEST_GESTURES = ["wheel", "drag", "pinch"] as const;
export type GuestGesture = (typeof GUEST_GESTURES)[number];

/** Where a view listens for a gesture: the event, and the selector `graview.on` was given. */
export interface GuestGestureBinding {
  readonly event: GuestGesture;
  readonly selector: string;
}

/**
 * A FILE THE PERSON DROPPED, AS THE HOST STORED IT (FR-193): what a record
 * keeps of it (`FileValue`) — where the host keeps it, never its bytes —
 * and two things more. `field` is the field of the `data-drop` kind it is
 * for, by its type (a picture to the image field, a video to the video
 * field); `at` is when the file was made, as the host's upload read it
 * from the file (`FileValue.at`, a photograph's EXIF, FR-195), else when
 * it was last changed, as the person's device said it. Handed back in an
 * act's argument, it goes as the host kept it — `field` and `at` left off —
 * and a file the host did not hand is refused.
 */
export interface GuestDroppedFile {
  /** Where the host keeps it: a path on the host, as the record will. */
  readonly href: string;
  readonly name: string;
  readonly type: string;
  readonly bytes: number;
  readonly width?: number;
  readonly height?: number;
  readonly poster?: string;
  readonly duration?: number;
  /** When it was made, as the host stored it (`FileValue.at`), else when it was last changed: an ISO instant. */
  readonly at?: string;
  /** The field it is for: one of the manifest's `accepts` for the dropped-on kind. */
  readonly field: string;
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
  /** Something a worker view did went nowhere, and why: its runtime says it in the view's console (FR-93). */
  | { readonly type: "notice"; readonly text: string }
  | HostHeartbeat;

export type GuestRequest =
  /** An act, or several of it as one change and one undo (`args` a list, FR-193). */
  | { readonly type: "act"; readonly nonce: string; readonly id: string | number; readonly name: string; readonly args: Readonly<Record<string, unknown>> | readonly Readonly<Record<string, unknown>>[] }
  /** Where a worker view's `graview.on` listens for a wheel, a drag or a pinch, all of it, again whenever it moves (0.1.42). */
  | { readonly type: "gestures"; readonly nonce: string; readonly bound: readonly GuestGestureBinding[] }
  /** The events a worker view's `graview.on` listens for, each said once (FR-193): a view that hears `drop` is left the drop. */
  | { readonly type: "hears"; readonly nonce: string; readonly events: readonly string[] }
  /** Where a worker view's `graview.on("click", selector, …)` listens, all of it, again whenever it moves (0.1.48): what an audit of the page holds to the keyboard. */
  | { readonly type: "clicks"; readonly nonce: string; readonly selectors: readonly string[] }
  | { readonly type: "navigate"; readonly nonce: string; readonly to: string; readonly where?: GuestWhere; readonly section?: string }
  /**
   * Go to a named place or a kind's list of this app, by its slug (FR-93): a
   * worker view's links stay in the app. `where` narrows it, held to the
   * kind's fields; `section` is a heading's words or an element's id.
   */
  | { readonly type: "navigate"; readonly nonce: string; readonly place: string; readonly where?: GuestWhere; readonly section?: string }
  | { readonly type: "size"; readonly nonce: string; readonly height: number }
  /** A worker guest's drawing: Remote DOM mutation records, with each listener sent as `{ listener: id }`. */
  | { readonly type: "render"; readonly nonce: string; readonly records: readonly unknown[] }
  /** The runtime's answer to a heartbeat, with the beat it was asked. */
  | { readonly type: "heartbeat"; readonly nonce: string; readonly beat: number }
  /** An open-kit view's stylesheets, every one it gave, in order (FR-90): the host draws what the open kit allows of each. */
  | { readonly type: "style"; readonly nonce: string; readonly sheets: readonly string[] }
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
