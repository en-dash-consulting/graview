// A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts) — `@graview/core`, which it reads text with.
import { applySplice, isUnset, TYPE_TEXT, type AnySchema, type MutationCall, type Operation, type Principal, type Store, type TextSplice } from "@graview/core";
import { composeSplices, diffSplice } from "@graview/core/typing";

/**
 * TYPING INTO A FIELD TYPED TOGETHER, OVER THE WIRE (Roadmap f-collab-text,
 * phase 3). Loaded by `remote.typing(node, field)` — with
 * `@graview/core/typing` — once somebody types into such a field, so a
 * page that only opens an app carries none of it.
 *
 * The discipline is the one a server-ordered transform needs (ot.js): at
 * most ONE run of keystrokes per field is on its way to the server. What is
 * typed meanwhile is shown at once and held, as runs of its own, and sent
 * only once the server has answered the one before — so the revision it
 * claims is past that run, and the server carries it over nobody's typing
 * but other people's. While runs wait, the server's ops land under them
 * and each keystroke is carried over what they typed (`Store.rebase`, with
 * `@graview/core/typing` loaded), so what is sent is where the text now
 * says it is.
 *
 * A run is one batch, sent as one `type-text` splice: the text as it was
 * before the run against the text after it. It ends after 400 ms with no
 * keystroke, when the caret jumps (a keystroke that does not touch the run),
 * after a word (a space or a stop typed), or when the editor says so
 * (`flush`, on a blur).
 */

/** What the typing of one field is handed of the remote store it types through. */
export interface TypingWire {
  readonly store: Store<AnySchema>;
  /** Applies calls here only — shown, not sent — in `batch` when given, else a new one. */
  apply(calls: readonly MutationCall[], batch?: string): { readonly batch: string; readonly ops: readonly Operation[] };
  /** Holds a batch this client applied as its own and pending, until it is sent or let go. */
  hold(batch: string): void;
  /** What a held batch would be sent as, should it be carried to a new store (a reload, a new declaration). */
  ask(batch: string, calls: readonly MutationCall[]): void;
  /** Sends a held batch; resolves once the server answered it, either way. */
  send(batch: string, calls: readonly MutationCall[]): Promise<unknown>;
  /** Lets go of a held batch that came to change nothing: taken out here, and never sent. */
  drop(batch: string): void;
  /** The last of the server's ops this client has: the revision a run claims. */
  seen(): number;
  /** Whether the remote store has been closed or let go of. */
  gone(): boolean;
  /**
   * The answers to wait for before a run is sent: the batches of this
   * client's pending ahead of it that changed the same field — an undo of
   * an earlier run, a whole write. A run claims the revision the server's
   * ops reach here, so it is sent only once what it was typed over is
   * among them.
   */
  ahead(batch: string, node: string, field: string): readonly { readonly batch: string; readonly answer: Promise<unknown> }[];
}

/**
 * WHAT `openRemote` HANDS THE DOOR OF ITS INSIDES: its store and its own
 * apply, the batches it holds pending and what each asked, and how it
 * sends, settles and lands one. The wire is made of them here, so a page
 * that never types carries none of it.
 */
export interface TypingInsides {
  readonly store: Store<AnySchema>;
  readonly author: Principal | undefined;
  readonly appliedAll: (calls: readonly MutationCall[], options: { author?: Principal; batch?: string }) => { readonly batch: string; readonly ops: readonly Operation[] };
  readonly pending: string[];
  readonly provisional: Set<string>;
  readonly asked: Map<string, { calls: readonly MutationCall[] }>;
  readonly answers: Map<string, Promise<unknown>>;
  /** Batches let go of without ever being sent, so an undo of one is let go of too. */
  readonly letGo: Set<string>;
  /** Sends a batch, taken back if refused; resolves once answered either way. */
  sent(batch: string, calls: readonly MutationCall[]): Promise<unknown>;
  settle(batch: string): void;
  land(ops: readonly Operation[], drop: readonly string[]): unknown;
  seen(): number;
  gone(): boolean;
}

/** The wire a field's typing runs on, made of a remote store's insides. */
export function wireOf(inside: TypingInsides): TypingWire {
  const { store, author, pending, provisional, asked } = inside;
  /*
   * A run is answered from the moment it is held, not only once it is sent:
   * an undo of a run still held behind the one on its way waits for its
   * answer (`answers`), so it never reaches the server before the run does.
   */
  const answered = new Map<string, (value: unknown) => void>();
  const answer = (batch: string, value?: unknown) => {
    answered.get(batch)?.(value);
    answered.delete(batch);
  };
  return {
    store,
    apply: (calls, batch) => inside.appliedAll(calls, { ...(author ? { author } : {}), ...(batch !== undefined ? { batch } : {}) }),
    hold(batch) {
      pending.push(batch);
      provisional.add(batch);
      inside.answers.set(batch, new Promise((resolve) => answered.set(batch, resolve)));
    },
    ask: (batch, calls) => void asked.set(batch, { calls }),
    send(batch, calls) {
      asked.set(batch, { calls });
      const sent = inside.sent(batch, calls);
      const done = () => answer(batch, sent);
      sent.then((said) => {
        // Carried over what others deleted meanwhile, the run made nothing on the server: an undo of it has nothing to take back there either.
        if (Array.isArray((said as { ops?: unknown } | undefined)?.ops) && (said as { ops: unknown[] }).ops.length === 0) inside.letGo.add(batch);
        done();
      }, done);
      return sent;
    },
    drop(batch) {
      inside.letGo.add(batch);
      inside.settle(batch);
      asked.delete(batch);
      inside.land([], [batch]);
      answer(batch);
    },
    seen: inside.seen,
    gone: inside.gone,
    ahead(batch, node, field) {
      const at = pending.indexOf(batch);
      const ops = store.log.all();
      const touches = (one: string) =>
        ops.some((op) => op.batch === one && op.primitives.some((p) => (p.op === "splice-text" && p.id === node && p.field === field) || (p.op === "patch-node" && p.id === node && field in p.after)));
      return pending.slice(0, Math.max(0, at)).flatMap((one) => {
        const answer = inside.answers.get(one);
        return answer && touches(one) ? [{ batch: one, answer }] : [];
      });
    },
  };
}

/** Typing into one field of one record, as `remote.typing(node, field)` hands it to an editor. */
export interface RemoteTyping {
  /**
   * A keystroke, or several: at `at` (UTF-16 code units) in the field's
   * text as the page shows it now, `remove` characters out and `insert` in.
   * Shown at once; sent with the run it belongs to. Throws what the store
   * refuses here, as `store.apply` would.
   */
  splice(at: number, remove: number, insert: string): void;
  /** Ends the run typed so far and sends it, or holds it behind the one on its way: a blur, Enter, a caret moved. */
  flush(): void;
  /** Runs typed and not yet answered by the server: the one on its way and the ones held behind it. */
  waiting(): number;
}

/** How long a run waits for another keystroke before it is sent. */
export const TYPING_IDLE_MS = 400;
/** A keystroke ending in one of these ends a word, and its run. */
const WORD_ENDS = /[\s.,;:!?)\]}]$/u;

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * WHAT A RUN TYPED, AS ONE SPLICE: the field's text before its first
 * keystroke against the text after its last, read by walking the log back
 * from the field's text now. Whatever this client typed after the run (a
 * later run, held) is walked back first, so the splice says the run alone.
 * None when the run changed nothing, or is no longer in the log.
 */
export function runSplice(store: Store<AnySchema>, batch: string, node: string, field: string): TextSplice | undefined {
  const log = store.log.all();
  const first = log.findIndex((op) => op.batch === batch);
  if (first < 0) return undefined;
  let text = textOf((store.graph.getNode(node) as Record<string, unknown> | undefined)?.[field]);
  let after: string | undefined;
  for (let at = log.length - 1; at >= first; at--) {
    const op = log[at]!;
    if (op.batch === batch && after === undefined) after = text;
    for (let index = op.primitives.length - 1; index >= 0; index--) {
      const one = op.primitives[index]!;
      if (one.op === "splice-text" && one.id === node && one.field === field) text = applySplice(text, { at: one.at, removed: one.inserted, inserted: one.removed });
      else if (one.op === "patch-node" && one.id === node && field in one.after) text = isUnset(one.before[field]) ? "" : textOf(one.before[field]);
    }
  }
  if (after === undefined || after === text) return undefined;
  return diffSplice(text, after);
}

export function typingOf(node: string, field: string, wire: TypingWire): RemoteTyping {
  /** The run being typed: its batch, shown and held, not yet ended. */
  let open: string | undefined;
  /** Runs ended and waiting for the one on its way. */
  const queue: string[] = [];
  /** The run on its way to the server. */
  let flying: string | undefined;
  let idle: ReturnType<typeof setTimeout> | undefined;
  /** Waiting for the answer to a change of this client's to the field, made ahead of the next run (an undo, a whole write). */
  let holding = false;
  /** Those changes, once answered. */
  const heard = new Set<string>();

  const callOf = (splice: TextSplice): MutationCall => ({
    name: TYPE_TEXT,
    args: { node, field, at: splice.at, remove: splice.removed.length, insert: splice.inserted, rev: wire.seen() },
  });
  const end = () => {
    if (idle) clearTimeout(idle);
    idle = undefined;
    if (open !== undefined) queue.push(open);
    open = undefined;
    pump();
  };
  /** The next run, once nothing of this field's is on its way: one at a time, so the server only carries it over other people's typing. */
  const pump = (): void => {
    if (flying !== undefined || holding || wire.gone()) return;
    const batch = queue.shift();
    if (batch === undefined) return;
    const waits = wire.ahead(batch, node, field).filter((one) => !heard.has(one.batch));
    if (waits.length > 0) {
      queue.unshift(batch);
      holding = true;
      void Promise.allSettled(waits.map((one) => one.answer)).then(() => {
        for (const one of waits) heard.add(one.batch);
        holding = false;
        pump();
      });
      return;
    }
    const splice = runSplice(wire.store, batch, node, field);
    if (!splice) {
      wire.drop(batch);
      return pump();
    }
    flying = batch;
    void wire.send(batch, [callOf(splice)]).finally(() => {
      flying = undefined;
      pump();
    });
  };

  return {
    splice(at, remove, insert) {
      if (wire.gone()) return;
      const text = textOf((wire.store.graph.getNode(node) as Record<string, unknown> | undefined)?.[field]);
      const keystroke: TextSplice = { at, removed: text.slice(at, at + remove), inserted: insert };
      // A keystroke that does not touch the run is the caret moved: the run ends there.
      if (open !== undefined) {
        const run = runSplice(wire.store, open, node, field);
        if (!run || !composeSplices(run, keystroke)) end();
      }
      const made = wire.apply([{ name: TYPE_TEXT, args: { node, field, at, remove, insert } }], open);
      if (made.ops.length === 0) return;
      if (open === undefined) {
        open = made.batch;
        wire.hold(open);
      }
      const run = runSplice(wire.store, open, node, field);
      if (run) wire.ask(open, [callOf(run)]);
      if (WORD_ENDS.test(insert)) return end();
      if (idle) clearTimeout(idle);
      idle = setTimeout(end, TYPING_IDLE_MS);
      (idle as { unref?: () => void }).unref?.();
    },
    flush: end,
    waiting: () => queue.length + (open !== undefined ? 1 : 0) + (flying !== undefined ? 1 : 0),
  };
}

/**
 * A RUN OF TYPING THAT CONFLICTS — typed against text whose history the
 * server no longer holds — as the person is offered it, read before it is
 * taken back: the text this page showed, typing and all ("yours"), and the
 * one keystroke that puts it over theirs whole, against the text the page
 * holds once theirs stands. None for calls that are not typing.
 */
export function yoursOf(store: Store<AnySchema>, calls: readonly MutationCall[]): { readonly node: string; readonly field: string; readonly yours: unknown; over(seen: number): MutationCall } | undefined {
  const typed = calls.find((one) => one.name === TYPE_TEXT)?.args as { node?: unknown; field?: unknown } | undefined;
  if (typeof typed?.node !== "string" || typeof typed.field !== "string") return undefined;
  const { node, field } = typed as { node: string; field: string };
  const textOf = () => (store.graph.getNode(node) as Record<string, unknown> | undefined)?.[field];
  const yours = textOf();
  return {
    node,
    field,
    yours,
    over: (seen) => {
      const theirs = textOf();
      return { name: TYPE_TEXT, args: { node, field, at: 0, remove: typeof theirs === "string" ? theirs.length : 0, insert: typeof yours === "string" ? yours : "", rev: seen } };
    },
  };
}
