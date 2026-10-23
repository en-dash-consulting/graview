// A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts) — `@graview/core`, which it reads text with.
import { applySplice, composeSplices, diffSplice, isUnset, TYPE_TEXT, type AnySchema, type MutationCall, type Operation, type Store, type TextSplice } from "@graview/core";
import "@graview/core/typing";

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
    if (flying !== undefined || wire.gone()) return;
    const batch = queue.shift();
    if (batch === undefined) return;
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
