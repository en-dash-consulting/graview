import { Graph, GraphError } from "./graph/graph.js";
import { resolveModules, type ModuleMap, type ModuleProjection } from "./modules.js";
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
import { permits, permittedMutations } from "./permissions/policy.js";
import { PermissionDeniedError, type Policy, type Principal } from "./permissions/types.js";
import { checkUndo, undoPrimitives, type UndoCheck } from "./ops/undo.js";
import type { AnySchema, NodeOfSchema } from "./schema/schema.js";

export interface StoreOptions<S extends AnySchema> {
  readonly schema: S;
  readonly mutations?: readonly AnyMutationDefinition<S>[];
  readonly invariants?: readonly InvariantDefinition<S>[];
  readonly snapshot?: GraphSnapshot<NodeOfSchema<S>>;
  /**
   * A stored history. Alone, the graph is FOLDED from it. Together with
   * `snapshot`, the snapshot is the graph and the log is the history that
   * led to it — the shape a persisted deployment reopens in, where the
   * seed was never an operation and folding the log alone would lose it.
   * Either way the log is live: what was done before is still attributed,
   * still in the activity, and still undoable.
   */
  readonly log?: readonly Operation[];
  /** Defaults to a monotonic counter so tests stay deterministic. */
  readonly ids?: () => string;
  readonly now?: () => string;
  readonly validate?: boolean;
  readonly invariantOptions?: EvaluateOptions<S>;
  /**
   * Who may run what. Absent means permission is not a concern here.
   *
   * It lives on the STORE and nowhere else. The tool runtime calls the same
   * mutations a person does, so a check in a React component is not a
   * permission system — it is a suggestion, and the agent seat is the bypass.
   */
  readonly policy?: Policy;
  /**
   * The app's declared modules, and which are on for THIS installation.
   *
   * `enabledModules` absent means everything — a store that never heard of
   * modules behaves exactly as before. The projection is fixed at
   * construction: a workspace toggle is an entitlement change, and the
   * honest response to one is building the store the new workspace gets.
   */
  readonly modules?: ModuleMap;
  readonly enabledModules?: readonly string[];
}

export interface ApplyOptions {
  /**
   * Who is acting. A principal is an author with roles, so the thing the log
   * blames is the thing the policy judged.
   */
  readonly author?: Author | Principal;
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
  readonly policy: Policy | undefined;
  /** What the enabled modules work out to; every surface reads this one answer. */
  readonly modules: ModuleProjection;
  private readonly nextId: () => string;
  private readonly now: () => string;
  private counter = 0;
  private readonly listeners = new Set<(diff: GraphDiff<NodeOfSchema<S>>, ops: readonly Operation[]) => void>();

  constructor(options: StoreOptions<S>) {
    this.schema = options.schema;
    this.invariants = options.invariants ?? [];
    this.invariantOptions = options.invariantOptions ?? {};
    this.policy = options.policy;
    this.modules = resolveModules(options.modules, options.enabledModules);
    let n = 0;
    this.nextId = options.ids ?? (() => `op${++n}`);
    this.now = options.now ?? (() => new Date(0).toISOString());

    for (const mutation of options.mutations ?? []) {
      if (this.mutations.has(mutation.name)) {
        throw new GraphError(`Duplicate mutation "${mutation.name}"`);
      }
      this.mutations.set(mutation.name, mutation);
    }

    if (options.log && options.snapshot) {
      // Hydrate: the graph as stored, the history as recorded.
      this.log = OperationLog.from(options.log);
      this.graph = Graph.from(options.schema, options.snapshot, {
        validate: options.validate ?? true,
      });
    } else if (options.log) {
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
    // A refusal is a result: the mutation exists, and this workspace has its
    // module off — which is a different sentence from "unknown".
    if (this.modules.disabledMutations.has(name)) {
      throw new GraphError(
        `Mutation "${name}" belongs to a module this workspace has turned off`,
        `Enabled modules: ${[...this.modules.enabled].join(", ") || "(none)"}`,
      );
    }
    return found;
  }

  allMutations(): AnyMutationDefinition<S>[] {
    return [...this.mutations.values()].filter(
      (mutation) => !this.modules.disabledMutations.has(mutation.name),
    );
  }

  allInvariants(): readonly InvariantDefinition<S>[] {
    return this.invariants.filter((invariant) => this.invariantEnabled(invariant));
  }

  /**
   * An invariant is off when its module is, and also when it is scoped to a
   * kind whose module is — a rule about vehicles has nothing to judge in a
   * workspace without them, and evaluating it anyway would resurrect the
   * kind through its violations.
   */
  private invariantEnabled(invariant: InvariantDefinition<S>): boolean {
    if (this.modules.disabledInvariants.has(invariant.name)) return false;
    if (invariant.scope !== "graph") {
      const kind = (invariant.scope as { kind: string }).kind;
      if (this.modules.disabledKinds.has(kind)) return false;
    }
    return true;
  }

  /**
   * Whether a principal may run a call, and — when not — who could.
   *
   * Public because an interface has to be able to ASK rather than guess: an
   * action withheld by permission is stated rather than hidden, and stating
   * it needs the same answer the enforcement uses. One source, two readings.
   */
  permits(
    call: MutationCall,
    principal: Principal = HUMAN,
  ): ReturnType<typeof permits> {
    return permits(this.policy, principal, call.name, this.subjectKindOf(call));
  }

  /**
   * The mutations a principal may run at all.
   *
   * This is what narrows an agent seat's generated tool schema. The seat
   * holds a principal; its tools are what that principal can do; there is no
   * second list to keep in step.
   */
  permittedMutations(principal: Principal = HUMAN): readonly AnyMutationDefinition<S>[] {
    return permittedMutations(this.policy, principal, this.allMutations());
  }

  /**
   * The kind a call acts on, read off the mutation's own subject binding.
   *
   * Undefined when the mutation declares no subject, or when the argument
   * names a node that is not there — an add, say. A grant restricted by kind
   * refuses that case rather than allowing it: the safe reading of "I could
   * not tell what this acts on" is no.
   */
  private subjectKindOf(call: MutationCall): string | undefined {
    const definition = this.mutations.get(call.name);
    const subject = definition?.subject;
    if (!subject) return undefined;
    const id = call.args[subject.arg];
    if (typeof id !== "string") return undefined;
    return this.graph.getNode(id)?.kind as string | undefined;
  }

  /** Current violations, evaluated fresh — nothing is cached or stale. */
  violations(context?: InvariantContext): Violation[] {
    return evaluate(this.graph, this.allInvariants(), {
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
    const after = evaluate(trial, this.allInvariants(), {
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

    /*
     * Permission is checked for the WHOLE gesture before any of it runs.
     *
     * A batch that applied three of five mutations and then refused the
     * fourth would leave the graph in a state nobody asked for, and the
     * rollback below is for errors rather than for policy. Refusing first is
     * also the honest answer to "may I do this": the answer must not depend
     * on how far through the list you got.
     */
    if (this.policy) {
      for (const call of calls) {
        const verdict = this.permits(call, author as Principal);
        if (!verdict.ok) throw new PermissionDeniedError(verdict.refusal);
      }
    }

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
    const diff = diffSnapshots(rollback, this.graph.snapshot());
    this.notify(diff, ops);

    return {
      batch,
      ops,
      diff,
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

    /*
     * Undo is a CHANGE, and it is judged like one.
     *
     * Without this, undo is the way around the policy: a principal who may
     * not reassign a run could take back somebody else's reassignment and
     * arrive at exactly the state they were refused. What you may undo is
     * what you may have done — the mutation each operation ran, judged
     * again now.
     */
    if (this.policy) {
      for (const target of check.ops) {
        if (!target.mutation) continue;
        const verdict = this.permits(target.mutation, author as Principal);
        if (!verdict.ok) {
          throw new PermissionDeniedError({
            ...verdict.refusal,
            message: `Not permitted to undo "${target.intent}": ${verdict.refusal.message}`,
          });
        }
      }
    }

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
    const diff = diffSnapshots(rollback, this.graph.snapshot());
    this.notify(diff, ops);

    return {
      batch,
      ops,
      diff,
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

  /**
   * Every applied change, with the operations that caused it.
   *
   * Notified AFTER the log is appended, not during the graph write: a
   * subscriber that reads the log to find out who made a change must not see
   * a log that has not caught up yet. Subscribing to the graph directly
   * gives the diff without that guarantee.
   */
  subscribe(
    listener: (diff: GraphDiff<NodeOfSchema<S>>, ops: readonly Operation[]) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(diff: GraphDiff<NodeOfSchema<S>>, ops: readonly Operation[]): void {
    if (ops.length === 0) return;
    for (const listener of this.listeners) listener(diff, ops);
  }

  snapshot(): GraphSnapshot<NodeOfSchema<S>> {
    return this.graph.snapshot();
  }
}

