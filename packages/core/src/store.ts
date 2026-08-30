import { Graph, GraphError } from "./graph/graph.js";
import { diffSnapshots, type GraphDiff } from "./graph/diff.js";
import { invert, type Primitive } from "./graph/primitives.js";
import type { GraphSnapshot } from "./graph/types.js";
import { evaluate } from "./invariants/engine.js";
import type {
  EvaluateOptions,
  InvariantContext,
  InvariantDefinition,
  Violation,
} from "./invariants/types.js";
import { compileMutation } from "./mutations/define-mutation.js";
import type { AnyMutationDefinition, MutationCall } from "./mutations/types.js";
import { OperationLog } from "./ops/log.js";
import type { Author, Batch, Operation } from "./ops/types.js";
import { checkUndo, undoPrimitives, type UndoCheck } from "./ops/undo.js";
import type { AnySchema, NodeOfSchema } from "./schema/schema.js";

export interface StoreOptions<S extends AnySchema> {
  readonly schema: S;
  readonly mutations?: readonly AnyMutationDefinition<S>[];
  readonly invariants?: readonly InvariantDefinition<S>[];
  readonly snapshot?: GraphSnapshot<NodeOfSchema<S>>;
  readonly log?: readonly Operation[];
  /** Defaults to a monotonic counter so tests stay deterministic. */
  readonly ids?: () => string;
  readonly now?: () => string;
  readonly validate?: boolean;
  readonly invariantOptions?: EvaluateOptions<S>;
}

export interface ApplyOptions {
  readonly author?: Author;
  /** Groups several mutations under one gesture or one agent turn. */
  readonly batch?: string;
  readonly intent?: string;
}

export interface Preview<S extends AnySchema> {
  readonly diff: GraphDiff<NodeOfSchema<S>>;
  readonly primitives: readonly Primitive[];
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  readonly intent: string;
  /** Violations the change would introduce that do not exist today. */
  readonly introduces: readonly Violation[];
  /** Violations it would resolve. */
  readonly resolves: readonly Violation[];
  readonly violationsAfter: readonly Violation[];
}

export interface ApplyResult<S extends AnySchema> extends Preview<S> {
  readonly ops: readonly Operation[];
  readonly batch: string;
}

export type UndoPreview<S extends AnySchema> =
  | ({ readonly ok: true; readonly check: UndoCheck } & Preview<S>)
  | { readonly ok: false; readonly check: UndoCheck };

const HUMAN: Author = { kind: "human" };

function violationKey(v: Violation): string {
  return `${v.invariant}|${v.subjectId ?? ""}|${v.message}`;
}

/**
 * The unit of the framework an app holds: a graph, the log it folds from,
 * the mutations that may touch it and the invariants that judge it.
 *
 * Human and agent edits go through exactly the same path, which is why an
 * agent's work needs no bespoke observability layer — it produces the same
 * diff a human edit does, carrying the same attribution.
 */
export class Store<S extends AnySchema> {
  readonly schema: S;
  readonly graph: Graph<S>;
  readonly log: OperationLog;
  private readonly mutations = new Map<string, AnyMutationDefinition<S>>();
  private readonly invariants: readonly InvariantDefinition<S>[];
  private readonly invariantOptions: EvaluateOptions<S>;
  private readonly nextId: () => string;
  private readonly now: () => string;
  private counter = 0;

  constructor(options: StoreOptions<S>) {
    this.schema = options.schema;
    this.invariants = options.invariants ?? [];
    this.invariantOptions = options.invariantOptions ?? {};
    let n = 0;
    this.nextId = options.ids ?? (() => `op${++n}`);
    this.now = options.now ?? (() => new Date(0).toISOString());

    for (const mutation of options.mutations ?? []) {
      if (this.mutations.has(mutation.name)) {
        throw new GraphError(`Duplicate mutation "${mutation.name}"`);
      }
      this.mutations.set(mutation.name, mutation);
    }

    if (options.log) {
      this.log = OperationLog.from(options.log);
      this.graph = this.log.fold(options.schema, { validate: options.validate ?? true });
    } else {
      this.log = new OperationLog();
      this.graph = Graph.from(options.schema, options.snapshot ?? { nodes: [], edges: [] }, {
        validate: options.validate ?? true,
      });
    }
  }

  mutation(name: string): AnyMutationDefinition<S> {
    const found = this.mutations.get(name);
    if (!found) {
      throw new GraphError(
        `Unknown mutation "${name}"`,
        `Registered: ${[...this.mutations.keys()].join(", ") || "(none)"}`,
      );
    }
    return found;
  }

  allMutations(): AnyMutationDefinition<S>[] {
    return [...this.mutations.values()];
  }

  allInvariants(): readonly InvariantDefinition<S>[] {
    return this.invariants;
  }

  /** Current violations, evaluated fresh — nothing is cached or stale. */
  violations(context?: InvariantContext): Violation[] {
    return evaluate(this.graph, this.invariants, {
      ...this.invariantOptions,
      ...(context === undefined ? {} : { context }),
    });
  }

  /**
   * What a mutation would do, without doing it. Every action in the interface
   * previews through here first — a typed mutation is checkable before it
   * applies, whether a human or an agent proposed it.
   */
  preview(call: MutationCall, context?: InvariantContext): Preview<S> {
    const definition = this.mutation(call.name);
    const compiled = compileMutation(this.graph, definition, call.args);
    return this.previewPrimitives(compiled.primitives, {
      reads: compiled.reads,
      writes: compiled.writes,
      intent: compiled.intent,
      context,
    });
  }

  private previewPrimitives(
    primitives: readonly Primitive[],
    meta: {
      reads: readonly string[];
      writes: readonly string[];
      intent: string;
      context?: InvariantContext;
    },
  ): Preview<S> {
    const before = this.violations(meta.context);
    const trial = Graph.from(this.schema, this.graph.snapshot());
    const diff = trial.applyPrimitives(primitives);
    const after = evaluate(trial, this.invariants, {
      ...this.invariantOptions,
      ...(meta.context === undefined ? {} : { context: meta.context }),
    });

    const beforeKeys = new Set(before.map(violationKey));
    const afterKeys = new Set(after.map(violationKey));
    return {
      diff,
      primitives,
      reads: meta.reads,
      writes: meta.writes,
      intent: meta.intent,
      introduces: after.filter((v) => !beforeKeys.has(violationKey(v))),
      resolves: before.filter((v) => !afterKeys.has(violationKey(v))),
      violationsAfter: after,
    };
  }

  /** Applies one mutation as its own batch, or joins an open batch. */
  apply(call: MutationCall, options: ApplyOptions = {}): ApplyResult<S> {
    return this.applyAll([call], options);
  }

  /** Applies several mutations as one gesture — one batch, one undo unit. */
  applyAll(calls: readonly MutationCall[], options: ApplyOptions = {}): ApplyResult<S> {
    const batch = options.batch ?? `batch:${++this.counter}`;
    const author = options.author ?? HUMAN;
    const ops: Operation[] = [];
    const allPrimitives: Primitive[] = [];
    const reads = new Set<string>();
    const writes = new Set<string>();
    const intents: string[] = [];

    const before = this.violations();
    const rollback = this.graph.snapshot();

    try {
      for (const call of calls) {
        const definition = this.mutation(call.name);
        const compiled = compileMutation(this.graph, definition, call.args);
        const op: Operation = {
          id: this.nextId(),
          seq: this.log.length,
          batch,
          author,
          intent: options.intent ?? compiled.intent,
          mutation: call,
          primitives: compiled.primitives,
          inverse: [...compiled.primitives].reverse().map(invert),
          reads: compiled.reads,
          writes: compiled.writes,
          at: this.now(),
        };
        this.graph.applyPrimitives(op.primitives);
        this.log.append(op);
        ops.push(op);
        allPrimitives.push(...op.primitives);
        for (const id of op.reads) reads.add(id);
        for (const id of op.writes) writes.add(id);
        intents.push(op.intent);
      }
    } catch (error) {
      this.graph.load(rollback);
      throw error;
    }

    const after = this.violations();
    const beforeKeys = new Set(before.map(violationKey));
    const afterKeys = new Set(after.map(violationKey));

    return {
      batch,
      ops,
      diff: diffSnapshots(rollback, this.graph.snapshot()),
      primitives: allPrimitives,
      reads: [...reads],
      writes: [...writes],
      intent: options.intent ?? intents.join("; "),
      introduces: after.filter((v) => !beforeKeys.has(violationKey(v))),
      resolves: before.filter((v) => !afterKeys.has(violationKey(v))),
      violationsAfter: after,
    };
  }

  batches(): Batch[] {
    return this.log.batches();
  }

  /** Whether a batch can come out on its own, and what blocks it if not. */
  canUndo(batchIds: string | readonly string[]): UndoCheck {
    return checkUndo(this.log, typeof batchIds === "string" ? [batchIds] : batchIds);
  }

  /**
   * What an undo would look like as a diff, including any invariant it would
   * re-violate. Nothing applies until `undo` is called.
   */
  previewUndo(
    batchIds: string | readonly string[],
    context?: InvariantContext,
  ): UndoPreview<S> {
    const check = this.canUndo(batchIds);
    if (!check.ok) return { ok: false, check };
    const primitives = undoPrimitives(check.ops);
    const writes = new Set<string>();
    for (const op of check.ops) for (const id of op.writes) writes.add(id);
    return {
      ok: true,
      check,
      ...this.previewPrimitives(primitives, {
        reads: [...new Set(check.ops.flatMap((op) => [...op.reads]))],
        writes: [...writes],
        intent: `Undo: ${check.ops.map((op) => op.intent).join("; ")}`,
        ...(context === undefined ? {} : { context }),
      }),
    };
  }

  /**
   * Undo APPENDS inverse ops rather than rewinding a pointer. History is
   * never destroyed, redo is simply the undo of an undo, and dropping an
   * agent's turn while keeping your own edits is a dependency check rather
   * than a stack pop.
   */
  undo(
    batchIds: string | readonly string[],
    options: ApplyOptions = {},
  ): ApplyResult<S> {
    const ids = typeof batchIds === "string" ? [batchIds] : batchIds;
    const check = this.canUndo(ids);
    if (!check.ok) throw new GraphError(check.message);

    const batch = options.batch ?? `undo:${++this.counter}`;
    const author = options.author ?? HUMAN;
    const rollback = this.graph.snapshot();
    const before = this.violations();
    const ops: Operation[] = [];

    for (const target of [...check.ops].sort((a, b) => b.seq - a.seq)) {
      const op: Operation = {
        id: this.nextId(),
        seq: this.log.length,
        batch,
        author,
        intent: options.intent ?? `Undo: ${target.intent}`,
        mutation: null,
        primitives: target.inverse,
        inverse: [...target.inverse].reverse().map(invert),
        reads: target.reads,
        writes: target.writes,
        at: this.now(),
        undoes: target.id,
      };
      this.graph.applyPrimitives(op.primitives);
      this.log.append(op);
      ops.push(op);
    }

    const after = this.violations();
    const beforeKeys = new Set(before.map(violationKey));
    const afterKeys = new Set(after.map(violationKey));

    return {
      batch,
      ops,
      diff: diffSnapshots(rollback, this.graph.snapshot()),
      primitives: ops.flatMap((op) => [...op.primitives]),
      reads: [...new Set(ops.flatMap((op) => [...op.reads]))],
      writes: [...new Set(ops.flatMap((op) => [...op.writes]))],
      intent: options.intent ?? ops.map((op) => op.intent).join("; "),
      introduces: after.filter((v) => !beforeKeys.has(violationKey(v))),
      resolves: before.filter((v) => !afterKeys.has(violationKey(v))),
      violationsAfter: after,
    };
  }

  /** Redo is the undo of an undo — no separate stack exists. */
  redo(undoBatchId: string, options: ApplyOptions = {}): ApplyResult<S> {
    return this.undo(undoBatchId, options);
  }

  subscribe(listener: (diff: GraphDiff<NodeOfSchema<S>>) => void): () => void {
    return this.graph.subscribe(listener);
  }

  snapshot(): GraphSnapshot<NodeOfSchema<S>> {
    return this.graph.snapshot();
  }
}

