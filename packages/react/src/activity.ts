import { participantKey, violationKey, type AnySchema, type Author, type Operation, type Store } from "@graview/core";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Who was moving, in the terms the op log already records.
 *
 * `directed` is a person; `autonomous` is an agent taking a turn of its own;
 * `co-edited` is more than one participant on the same thing inside the
 * window; `rule` is the invariant engine repairing something. Nothing new is
 * invented to tell them apart — every op carries an author with a kind, an
 * id and a session, and this is only a reading of it.
 */
export type Manner = "directed" | "autonomous" | "co-edited" | "rule";

export interface ActivityMark {
  /** When it happened, in `performance.now()`-comparable milliseconds. */
  readonly at: number;
  readonly manner: Manner;
  /** What was MEANT, from the op. Not a description of what changed. */
  readonly intent: string;
  /** Something here was written. */
  readonly wrote: boolean;
  /**
   * Something here was READ while deciding, and not written.
   *
   * This is the half a diff cannot show, and the half that makes an agent's
   * turn legible: what it looked at before it moved says more about whether
   * to trust the move than the move does.
   */
  readonly read: boolean;
  /** A rule that implicates this began failing with this change. */
  readonly broke: boolean;
  /** Distinct participants, so a second one turns the mark into `co-edited`. */
  readonly participants: readonly string[];
}

/** One author's identity across a window. Session is what separates two agents. */
function participantOf(op: Operation): string {
  return participantKey(op.author);
}

function mannerOf(participants: readonly string[], last: Operation["author"]["kind"]): Manner {
  if (participants.length > 1) return "co-edited";
  if (last === "rule") return "rule";
  return last === "agent" ? "autonomous" : "directed";
}


/**
 * Folds one notification into the marks that are still current.
 *
 * Pure, and separate from the hook, because "what does the picture say after
 * an agent turn" is a question worth being able to ask without a renderer.
 */
export function markActivity(
  previous: ReadonlyMap<string, ActivityMark>,
  ops: readonly Operation[],
  broken: readonly BrokenRule[],
  at: number,
  holdMs: number,
): Map<string, ActivityMark> {
  const next = new Map<string, ActivityMark>();
  // Anything still inside the window survives, so two changes a second apart
  // read as two things happening rather than the second erasing the first.
  for (const [id, mark] of previous) {
    if (at - mark.at < holdMs) next.set(id, mark);
  }

  const broke = new Set(broken.flatMap((violation) => violation.nodeIds));
  const touch = (
    id: string,
    op: Operation,
    fields: { wrote?: boolean; read?: boolean },
  ) => {
    const existing = next.get(id);
    const participants = existing?.participants.includes(participantOf(op))
      ? existing.participants
      : [...(existing?.participants ?? []), participantOf(op)];
    next.set(id, {
      at,
      manner: mannerOf(participants, op.author.kind),
      intent: op.intent,
      wrote: (existing?.wrote ?? false) || (fields.wrote ?? false),
      // A write outranks a read: once something was changed, saying it was
      // also looked at adds nothing.
      read: ((existing?.read ?? false) || (fields.read ?? false)),
      broke: (existing?.broke ?? false) || broke.has(id),
      participants,
    });
  };

  for (const op of ops) {
    for (const id of op.writes) touch(id, op, { wrote: true });
    for (const id of op.reads) {
      if (op.writes.includes(id)) continue;
      touch(id, op, { read: true });
    }
  }
  /*
   * A rule that has just begun to fail marks EVERY node it implicates, not
   * only the one that was written.
   *
   * That is the whole point of watching from up here: the change lands on
   * one card and the consequence appears on another, and seeing the second
   * without having gone looking for it is the thing a list of diffs cannot
   * do. The rule speaks in its own voice — its message is the intent.
   */
  for (const violation of broken) {
    for (const id of violation.nodeIds) {
      const existing = next.get(id);
      next.set(id, {
        at,
        manner: existing?.manner ?? "rule",
        intent: existing?.intent ?? violation.message,
        wrote: existing?.wrote ?? false,
        read: existing?.read ?? false,
        broke: true,
        participants: existing?.participants ?? ["rule::"],
      });
    }
  }
  return next;
}

/** A violation that was not failing a moment ago. */
export interface BrokenRule {
  readonly nodeIds: readonly string[];
  readonly message: string;
}

/** How long a mark stays up. Long enough to notice, short enough to mean "just". */
export const ACTIVITY_HOLD_MS = 2600;

/**
 * The activity state itself, owned by the provider.
 *
 * Returns the marks and the way to add attention that never became an op —
 * an agent reading the graph changes nothing and produces no diff, which is
 * exactly why it needs its own way in.
 */
export function useActivityState<S extends AnySchema>(
  store: Store<S>,
  holdMs = ACTIVITY_HOLD_MS,
): {
  activity: ReadonlyMap<string, ActivityMark>;
  noteAttention: (note: Attention) => void;
} {
  const [marks, setMarks] = useState<ReadonlyMap<string, ActivityMark>>(() => new Map());
  const live = useRef(marks);
  live.current = marks;
  // One timer for the whole thing, reset by whatever happened last. A quiet
  // graph holds no timer at all.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publish = useCallback(
    (next: Map<string, ActivityMark>) => {
      live.current = next;
      setMarks(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        live.current = new Map();
        setMarks(new Map());
      }, holdMs);
    },
    [holdMs],
  );

  useEffect(() => {
    let failing = new Set(store.violations().map(violationKey));
    const unsubscribe = store.subscribe((_diff, ops) => {
      const after = store.violations();
      const fresh = after.filter((violation) => !failing.has(violationKey(violation)));
      failing = new Set(after.map(violationKey));
      publish(
        markActivity(
          live.current,
          ops,
          fresh.map((violation) => ({
            nodeIds: violation.nodeIds,
            message: violation.message,
          })),
          Date.now(),
          holdMs,
        ),
      );
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [store, holdMs, publish]);

  const noteAttention = useCallback(
    (note: Attention) => {
      if (note.reads.length === 0) return;
      publish(
        markActivity(
          live.current,
          [attentionAsOp(note)],
          [],
          Date.now(),
          holdMs,
        ),
      );
    },
    [holdMs, publish],
  );

  return { activity: marks, noteAttention };
}

/**
 * Something looked at, by someone, for a reason.
 *
 * A read leaves no diff and no operation, so there is nothing in the log to
 * fold. This is the one thing the interface is told rather than derived —
 * and it is told by the tool runtime, which is the only thing that knows.
 */
export interface Attention {
  readonly reads: readonly string[];
  readonly author: Author;
  readonly intent: string;
}

/**
 * A read dressed as an operation, so it walks the same path a write does.
 *
 * Not appended to any log — the log is for things that happened to the
 * graph, and looking at something did not. This exists only so `markActivity`
 * has one shape to fold rather than two.
 */
function attentionAsOp(note: Attention): Operation {
  return {
    id: `attention:${note.intent}`,
    seq: -1,
    batch: "attention",
    author: note.author,
    intent: note.intent,
    mutation: null,
    primitives: [],
    inverse: [],
    reads: note.reads,
    writes: [],
    at: new Date().toISOString(),
  };
}

/**
 * The shape of a settled tool call, structurally.
 *
 * Declared here rather than imported so that the react binding does not take
 * a dependency on the tool runtime for the sake of one field: anything that
 * announces calls in this shape can be watched.
 */
export interface ToolCallLike {
  readonly name: string;
  readonly phase: "running" | "ok" | "failed";
  readonly reads?: readonly string[];
  readonly args?: Readonly<Record<string, unknown>>;
}
