import { PermissionDeniedError, type AnySchema, type Principal, type Store } from "@graview/core";
import type { GuestAct, GuestAnswer, GuestEdge, GuestNode, GuestProps, GuestRefusal, HostMessage } from "../protocol.js";

/**
 * What the host knows of the place a guest view is drawn: `ViewProps` as
 * the framework hands any view, by id. The host reads every record again
 * from the store as the viewer sees it, so an id here the viewer may not
 * see goes no further.
 */
export interface GuestViewInput {
  readonly node?: { readonly id: string };
  readonly nodes?: readonly { readonly id: string }[];
  readonly label?: string;
  readonly fidelity?: GuestProps["fidelity"];
  readonly cardinality?: GuestProps["cardinality"];
  readonly mode?: GuestProps["mode"];
  readonly selected?: boolean;
  readonly implicated?: readonly string[];
  readonly flagged?: readonly string[];
}

/** How much a frame may ask, per frame. Past either, the host stops listening until the window moves. */
export interface GuestLimits {
  /** Acts a frame may ask for in `actWindowMs`. 30 by default. */
  readonly acts?: number;
  /** 60 000 (a minute) by default. */
  readonly actWindowMs?: number;
  /** Messages of any kind a frame may send in `messageWindowMs`; the rest are dropped unread. 120 by default. */
  readonly messages?: number;
  /** 1 000 by default. */
  readonly messageWindowMs?: number;
  /** The tallest a guest may ask to be, in CSS pixels. 4 000 by default. */
  readonly maxHeight?: number;
}

export interface GuestHostOptions<S extends AnySchema> {
  /** The store, or the store as the viewer sees it: the host reads it through `seenBy(principal)` either way. */
  readonly store: Store<S>;
  /** The viewer. Every act the guest asks for is applied as them, and only what they may see is pushed. */
  readonly principal: Principal;
  /** The view's registered name. Acts it asks for are recorded `via: "view:<name>"`. */
  readonly view: string;
  /** This frame's nonce. A request without it is dropped. */
  readonly nonce: string;
  /** Where messages to the guest go: the host's end of the frame's port. */
  send(message: HostMessage): void;
  /** What is drawn where the guest is, read on every push. */
  readonly input?: () => GuestViewInput;
  /** The guest asked to go to a record the viewer may see. */
  readonly onNavigate?: (id: string) => void;
  /** The guest asked for a height. */
  readonly onSize?: (height: number) => void;
  readonly limits?: GuestLimits;
  /**
   * The frame's limiter, when the frame outlives this session: a guest
   * that says it is ready again gets a new nonce, not a new allowance.
   */
  readonly limiter?: GuestLimiter;
  /** The clock, for tests. */
  readonly now?: () => number;
}

/** How much one frame may still ask: each call spends one, and says whether there was one to spend. */
export interface GuestLimiter {
  act(): boolean;
  message(): boolean;
}

/** What a frame has been refused, for a host that wants to show or log it. */
export interface GuestStats {
  /** Acts applied. */
  applied: number;
  /** Acts asked for and not applied, for any reason. */
  refused: number;
  /** Messages dropped unread: a wrong nonce, a shape the protocol does not know, or past the message limit. */
  dropped: number;
}

export interface GuestHost {
  /** Hand the host one message from the frame's port. */
  receive(data: unknown): void;
  /** Push what the viewer sees now. Called on every change to the store, and by a host when the view's input moves. */
  push(): void;
  readonly stats: Readonly<GuestStats>;
  dispose(): void;
}

/** A count over a sliding window: true while under the limit. */
function windowed(limit: number, span: number, now: () => number): () => boolean {
  const times: number[] = [];
  return () => {
    const at = now();
    while (times.length > 0 && times[0]! <= at - span) times.shift();
    if (times.length >= limit) return false;
    times.push(at);
    return true;
  };
}

/** One frame's allowance, per `GuestLimits`. */
export function createGuestLimiter(limits: GuestLimits = {}, now: () => number = Date.now): GuestLimiter {
  return {
    act: windowed(limits.acts ?? 30, limits.actWindowMs ?? 60_000, now),
    message: windowed(limits.messages ?? 120, limits.messageWindowMs ?? 1_000, now),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * THE HOST'S HALF OF ONE FRAME, without the DOM: what to push, and what to
 * make of what comes back. `mountGuestView` wires it to an iframe; a test
 * can drive it with plain objects.
 */
export function createGuestHost<S extends AnySchema>(options: GuestHostOptions<S>): GuestHost {
  const limiter = options.limiter ?? createGuestLimiter(options.limits, options.now);
  const maxHeight = options.limits?.maxHeight ?? 4_000;
  const via = `view:${options.view}` as const;
  const stats: GuestStats = { applied: 0, refused: 0, dropped: 0 };
  /* Read through the viewer's sight every time: the store moves, and what they may see moves with it. */
  const seen = () => options.store.seenBy(options.principal);

  const plain = (node: unknown): GuestNode => structuredClone(node) as GuestNode;

  const props = (): GuestProps => {
    const store = seen();
    const graph = store.graph;
    const input = options.input?.() ?? {};
    const node = input.node ? graph.getNode(input.node.id) : undefined;
    const nodes = input.nodes?.flatMap((member) => {
      const found = graph.getNode(member.id);
      return found ? [found] : [];
    });
    const shown = new Set([...(node ? [node.id] : []), ...(nodes ?? []).map((member) => member.id)]);
    const edges: GuestEdge[] = [];
    for (const id of shown) {
      for (const edge of graph.outEdges(id)) {
        if (shown.has(edge.to)) edges.push({ kind: edge.kind, from: edge.from, to: edge.to });
      }
    }
    const visible = (ids: readonly string[] | undefined) => ids?.filter((id) => graph.has(id));
    const acts: GuestAct[] = store.permittedMutations(options.principal).map((mutation) => ({
      name: mutation.name,
      title: mutation.title ?? mutation.name,
      ...(mutation.description !== undefined ? { description: mutation.description } : {}),
      ...(mutation.subject ? { subject: { kinds: mutation.subject.kinds as readonly string[] | "*", arg: mutation.subject.arg } } : {}),
    }));
    return {
      view: options.view,
      ...(node ? { node: plain(node) } : {}),
      ...(nodes ? { nodes: nodes.map(plain) } : {}),
      edges,
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.fidelity !== undefined ? { fidelity: input.fidelity } : {}),
      ...(input.cardinality !== undefined ? { cardinality: input.cardinality } : {}),
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.selected !== undefined ? { selected: input.selected } : {}),
      ...(input.implicated ? { implicated: visible(input.implicated) } : {}),
      ...(input.flagged ? { flagged: visible(input.flagged) } : {}),
      acts,
    };
  };

  let disposed = false;
  const push = () => {
    if (!disposed) options.send({ type: "props", props: props() });
  };

  /* Every change to the store is a push, coalesced: a batch of five ops is one message, not five. */
  let pending = false;
  const off = options.store.subscribe(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      push();
    });
  });

  const answer = (id: string | number, reason: GuestRefusal, message: string) => {
    stats.refused += 1;
    options.send({ type: "answer", id, ok: false, reason, message } satisfies GuestAnswer);
  };

  const act = (id: string | number, name: unknown, args: unknown) => {
    if (typeof name !== "string" || !isRecord(args)) return answer(id, "malformed", "An act is asked for by name, with its arguments as an object.");
    if (!limiter.act()) return answer(id, "rate-limited", "Too many acts asked for at once; this one was not applied.");
    if (!options.store.allMutations().some((mutation) => mutation.name === name)) return answer(id, "unknown-act", "There is no act by that name here.");
    try {
      /*
       * THE VIEWER'S CLICK, NOT THE GUEST'S: the store judges the viewer's
       * principal, refuses a record they may not see before any grant is
       * read, and the op says it came through this view.
       */
      const result = options.store.apply({ name, args }, { author: options.principal, via });
      stats.applied += 1;
      options.send({ type: "answer", id, ok: true, intent: result.intent });
    } catch (error) {
      if (error instanceof PermissionDeniedError) return answer(id, "refused", error.refusal.message);
      /* An act's own error can name what it read; the guest is told only that it did not happen. */
      return answer(id, "failed", "The act could not be applied.");
    }
  };

  return {
    receive(data) {
      if (disposed) return;
      if (!limiter.message()) {
        stats.dropped += 1;
        return;
      }
      if (!isRecord(data) || data.nonce !== options.nonce) {
        stats.dropped += 1;
        return;
      }
      if (data.type === "act" && (typeof data.id === "string" || typeof data.id === "number")) return act(data.id, data.name, data.args);
      if (data.type === "navigate" && typeof data.to === "string") {
        if (seen().graph.has(data.to)) options.onNavigate?.(data.to);
        else stats.dropped += 1;
        return;
      }
      if (data.type === "size" && typeof data.height === "number" && Number.isFinite(data.height)) {
        options.onSize?.(Math.max(0, Math.min(maxHeight, Math.round(data.height))));
        return;
      }
      stats.dropped += 1;
    },
    push,
    get stats() {
      return stats;
    },
    dispose() {
      disposed = true;
      off();
    },
  };
}
