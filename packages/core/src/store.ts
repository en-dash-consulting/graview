import { seenBy } from "./seen.js";
import { sees, sightedKinds } from "./permissions/sight.js";
import type { IntelligenceProviderDeclaration } from "./app.js";
import { Graph, GraphError } from "./graph/graph.js";
import { resolveModules, type ModuleMap, type ModuleProjection } from "./modules.js";
import { diffSnapshots, type GraphDiff } from "./graph/diff.js";
import { invert, normalise, type Primitive } from "./graph/primitives.js";
import type { GraphSnapshot } from "./graph/types.js";
import { evaluate } from "./invariants/engine.js";
import type {
  EvaluateOptions,
  InvariantContext,
  InvariantDefinition,
  Violation,
} from "./invariants/types.js";
import { compileMutation } from "./mutations/define-mutation.js";
import { deriveMutations, derivedVia } from "./mutations/derive-edits.js";
import type { AnyMutationDefinition, MutationCall } from "./mutations/types.js";
import { OperationLog } from "./ops/log.js";
import type { Author, Batch, Operation } from "./ops/types.js";
import { permits, permittedMutations, type PolicyWords } from "./permissions/policy.js";
import { nounOf } from "./schema/define-node.js";
import { PermissionDeniedError, type Policy, type Principal, type Refusal } from "./permissions/types.js";
import { checkUndo, undoPrimitives, type UndoCheck } from "./ops/undo.js";
import type { AnySchema, NodeOfSchema } from "./schema/schema.js";
import { tellTheWatchItsNames, tellTheWatchOfAStore, tellTheWatchOfAnAuthor, tellTheWatchOfARefusal } from "./watched.js";

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
  /**
   * The app's declared intelligence providers, so an AGENT is held to the
   * allowlist it was declared with.
   *
   * `may` was a promise made in the declaration, verified by `graview check`
   * — every name in it is a real act — and enforced by nothing. The tool
   * runtime honoured it for proposals that went through the tool runtime; a
   * survey applied by the app's own code went through `store.apply`, where
   * there was no `may` at all, so an agent principal could run any act its
   * ROLES allowed whatever the declaration said it was for.
   *
   * The allowlist is a promise to the person who typed a key in — it may
   * describe the ground and may not touch the record — and a promise that
   * holds on one path and not another is not a promise. It lives on the
   * store for the same reason the policy does: every caller hits the same
   * wall in the same way, and an app should not have to remember.
   */
  readonly intelligence?: readonly IntelligenceProviderDeclaration[];
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

/** A violation's identity across judgements: the rule, what it is about, and what it says. */
export function violationKey(v: Violation): string {
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
  /**
   * The intelligence the app declared, so a surface can read the DOORS.
   *
   * The store already held the allowlist to enforce it; a seat that wants to
   * offer "copy the prompt" or "send from here" according to what was
   * declared needs the declaration itself, and the store is what every
   * surface already has.
   */
  readonly intelligence: readonly IntelligenceProviderDeclaration[];
  /** What each declared agent may do, by provider name. */
  private readonly may = new Map<string, ReadonlySet<string>>();
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
    this.intelligence = options.intelligence ?? [];
    for (const provider of options.intelligence ?? []) {
      if (provider.may) this.may.set(provider.name, new Set(provider.may));
    }
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
    /*
     * THE DERIVED ACTS, registered like any other. A field you could set at
     * creation, you can change: each kind with settable fields nobody writes
     * gets `edit-<kind>`. What was made can be unmade: each kind gets
     * `remove-<kind>`. Both titled, logged, undoable, judged by the
     * invariants — and by the policy, through the acts that already write or
     * create the kind (see `permits`). Nothing an app declares is replaced.
     */
    for (const mutation of deriveMutations(options.schema, options.mutations ?? [])) {
      this.mutations.set(mutation.name, mutation);
    }
    tellTheWatchItsNames(options.schema, this.mutations.values(), options.policy);

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

    /*
     * A HYDRATED STORE COUNTS ON FROM WHERE THE LOG LEFT OFF.
     *
     * Both counters started at zero whatever history was handed in, so the
     * first change after a reload was minted `op1` in `batch:1` — ids the
     * log already held. `batches()` groups by batch id, so the new work was
     * filed under the FIRST turn ever taken: the activity rail went on
     * saying "Add a person" and never grew, undoing that turn would have
     * taken the new change with it, and `log.get(id)` answered with the
     * older op of the two. Every app that remembers anything did this on
     * its second visit.
     *
     * Only the DEFAULT generators are wound forward; an app that supplies
     * its own `ids` owns their uniqueness.
     */
    const trailing = (value: string): number => {
      const digits = /(\d+)$/.exec(value);
      return digits ? Number(digits[1]) : 0;
    };
    for (const op of this.log.all()) {
      this.counter = Math.max(this.counter, trailing(op.batch));
      n = Math.max(n, trailing(op.id));
    }
    tellTheWatchOfAStore(this);
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
    if (this.mutationDisabled(found)) {
      throw new GraphError(
        `Mutation "${name}" belongs to a module this workspace has turned off`,
        `Enabled modules: ${[...this.modules.enabled].join(", ") || "(none)"}`,
      );
    }
    return found;
  }

  /** Off by module, or a derived act of a kind the workspace has off. */
  private mutationDisabled(mutation: AnyMutationDefinition<S>): boolean {
    if (this.modules.disabledMutations.has(mutation.name)) return true;
    return mutation.derived !== undefined && this.modules.disabledKinds.has(mutation.derived.kind);
  }

  allMutations(): AnyMutationDefinition<S>[] {
    return [...this.mutations.values()].filter((mutation) => !this.mutationDisabled(mutation));
  }

  /** The declared acts a derived act resolves its permission through. */
  private viaOf(mutation: AnyMutationDefinition<S> | undefined): readonly string[] | undefined {
    if (!mutation?.derived) return undefined;
    return derivedVia(this.schema, [...this.mutations.values()], mutation);
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
    /*
     * The same answer `apply` would give. A declared agent's `may` narrows
     * it before the policy does; asked without it, the chat offered a
     * repair as the starter seat, which may only add, and the press met
     * "starter may not take-off here" (W-110).
     */
    const narrowed = this.refusesAgent(call, principal);
    if (narrowed) return { ok: false, refusal: narrowed } as ReturnType<typeof permits>;
    return permits(
      this.policy,
      principal,
      call.name,
      this.subjectKindOf(call),
      this.viaOf(this.mutations.get(call.name)),
      this.subjectIdOf(call),
      this.words,
    );
  }

  /** How the policy's refusals name an act and a kind: by title and noun, never by id. */
  private get words(): PolicyWords {
    return {
      act: (name) => this.mutations.get(name)?.title,
      noun: (kind) => nounOf(this.schema.tryDefinition(kind), kind),
    };
  }

  /**
   * Why a declared agent may not run this call, if it may not.
   *
   * Only ever narrows, and only for an agent: a human author has no
   * allowlist, and a provider that declared no `may` may do whatever its
   * roles allow, which is what "absent means all" has always meant.
   */
  private refusesAgent(call: MutationCall, author: Author | Principal): Refusal | undefined {
    if (author.kind !== "agent" || author.id === undefined) return undefined;
    const allowed = this.may.get(author.id);
    if (!allowed || allowed.has(call.name)) return undefined;
    const titled = (name: string) => `“${this.mutations.get(name)?.title ?? name}”`;
    const named = [...allowed].map(titled);
    return {
      mutation: call.name,
      message: `${author.id} may not ${titled(call.name)} here: it was declared able to ${
        named.length === 0 ? "do nothing else" : named.join(", ")
      }.`,
      wouldNeed: [],
    };
  }

  /**
   * Whether a principal may run ANY act of a module drawn only for those
   * who administer it. This is the one question the interface asks before
   * offering to show the installation's own districts; the answer comes
   * from the same policy that refuses the acts.
   */
  mayAdminister(module: string, principal: Principal = HUMAN): boolean {
    const declared = this.modules.administered.get(module);
    if (!declared) return false;
    return (declared.mutations ?? []).some((name) => {
      const mutation = this.mutations.get(name);
      if (!mutation) return false;
      const kinds =
        mutation.subject && mutation.subject.kinds !== "*"
          ? (mutation.subject.kinds as readonly string[])
          : [undefined];
      return kinds.some((kind) => permits(this.policy, principal, name, kind, this.viaOf(mutation)).ok);
    });
  }

  /**
   * The store as one principal may see it: its graph, log, history and
   * problems hold only what the policy's `sees` lets them see, and every
   * act still comes here. With no `sees`, this store itself (see `seen.ts`).
   */
  seenBy(principal: Principal): Store<S> {
    return seenBy(this, principal);
  }

  /** Whether a principal may see one record (the policy's `sees`). */
  sees(principal: Principal, id: string): boolean {
    const node = this.graph.getNode(id);
    return node !== undefined && sees(this.policy, principal, node as never, this.graph as never);
  }

  /** The kinds of administered modules this principal may not see at all. */
  kindsKeptFrom(principal: Principal = HUMAN): ReadonlySet<string> {
    const kept = new Set<string>();
    for (const [name, module] of this.modules.administered) {
      if (this.mayAdminister(name, principal)) continue;
      for (const kind of module.kinds ?? []) kept.add(kind);
    }
    /*
     * A KIND THE POLICY SAYS THIS SEAT SEES NONE OF, and may not begin: no
     * district, no tab, no "none yet". Somebody browsing a showroom has no
     * test drives to see and none to book, and a Test drives page that said
     * "none yet — waiting for shoppers" was a page about other people.
     */
    const sights = this.policy?.sees ?? [];
    if (sights.length > 0) {
      const creatable = new Set(this.permittedMutations(principal).flatMap((mutation) => mutation.creates ?? []));
      for (const kind of sightedKinds(this.policy)) {
        const seeing = sights.some((sight) => sight.kinds.includes(kind) && (sight.roles === "*" || (principal.roles ?? []).some((role) => (sight.roles as readonly string[]).includes(role))) && (!sight.own || principal.id !== undefined));
        if (!seeing && !creatable.has(kind)) kept.add(kind);
      }
    }
    return kept;
  }

  private subjectIdOf(call: MutationCall): string | undefined {
    const subject = this.mutations.get(call.name)?.subject;
    if (!subject) return undefined;
    const id = call.args[subject.arg];
    return typeof id === "string" ? id : undefined;
  }

  /**
   * The mutations a principal may run at all.
   *
   * This is what narrows an agent seat's generated tool schema. The seat
   * holds a principal; its tools are what that principal can do; there is no
   * second list to keep in step.
   */
  permittedMutations(principal: Principal = HUMAN): readonly AnyMutationDefinition<S>[] {
    const all = this.allMutations();
    const declared = permittedMutations(
      this.policy,
      principal,
      all.filter((mutation) => !mutation.derived),
    );
    // A derived act is offered when the kind's own acts it rides are.
    const derived = all.filter(
      (mutation) =>
        mutation.derived !== undefined &&
        permits(this.policy, principal, mutation.name, mutation.derived.kind, this.viaOf(mutation)).ok,
    );
    return [...declared, ...derived];
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
    /*
     * NOT CHOSEN YET — offered from the far end, the subject is still to be
     * asked for. Its kind is the act's to say when it names one: asked as
     * "no kind", a grant drawn by kind ("a reviewer, on talks") refused the
     * reviewer on every topic with "a chair or a reviewer can".
     */
    if (typeof id !== "string") return subject.kinds !== "*" && subject.kinds.length === 1 ? (subject.kinds[0] as string) : undefined;
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
  /**
   * Would this act change anything at all?
   *
   * Cheaper than `preview` — it compiles the mutation and counts what came
   * out, without snapshotting the graph or re-evaluating the rules — because
   * it is asked for every act on every selection. An act that compiles to no
   * primitives leaves the graph exactly as it was: "Close it" on something
   * already closed, an edge to a node that already has it, a guard inside
   * the act that decided to do nothing. That is not an act, and offering it
   * is a button that appears broken.
   */
  wouldChange(call: MutationCall): boolean {
    try {
      return compileMutation(this.graph, this.mutation(call.name), call.args).primitives.length > 0;
    } catch {
      // An act that cannot even compile is not one that changes nothing; let
      // whoever asked find out the honest way.
      return true;
    }
  }

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
        if (!verdict.ok) {
          tellTheWatchOfARefusal(verdict.refusal, author.id);
          throw new PermissionDeniedError(verdict.refusal);
        }
      }
    }
    /*
     * AND AN AGENT IS HELD TO WHAT IT WAS DECLARED ABLE TO DO.
     *
     * Checked here rather than only in the tool runtime, because the runtime
     * is one path and `store.apply` is the one everything else uses — an app
     * applying a model's plan itself went straight past the allowlist, and
     * every app would have had to remember to re-implement it. The roles a
     * seat holds say what it may do at all; `may` narrows what THIS provider
     * was brought in for, and the narrower of the two wins.
     */
    for (const call of calls) {
      const refusal = this.refusesAgent(call, author);
      if (refusal) {
        tellTheWatchOfARefusal(refusal, author.id);
        throw new PermissionDeniedError(refusal);
      }
    }
    tellTheWatchOfAnAuthor(author.id);

    try {
      for (const call of calls) {
        const definition = this.mutation(call.name);
        const compiled = compileMutation(this.graph, definition, call.args);
        /*
         * AN ACT THAT DID NOTHING DOES NOT GO IN THE HISTORY.
         *
         * A mutation whose body decided to do nothing — the guard against a
         * self-referential edge is the one every scaffolded app carries —
         * compiles to no primitives. Logged anyway, it put a line in the
         * activity rail saying a thing had happened, with an undo beside it
         * that undid nothing, and wrote a record that replays to nothing on
         * every future load. The call is still legal and still returns; it
         * simply leaves no trace, because it left no trace.
         */
        if (compiled.primitives.length === 0) continue;
        const op: Operation = {
          id: this.nextId(),
          seq: this.log.length,
          batch,
          author,
          intent: options.intent ?? compiled.intent,
          mutation: call,
          /*
           * NORMALISED on the way into the record: a patch that clears a
           * field says so with a value rather than with an absence, or the
           * instruction is lost the moment the op is written to JSON and the
           * inverse quietly does nothing. See `normalise` in primitives.ts.
           */
          primitives: compiled.primitives.map(normalise),
          inverse: [...compiled.primitives].reverse().map(normalise).map(invert),
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

  /**
   * OPERATIONS SOMEBODY ELSE ALREADY MADE, taken into this store.
   *
   * The one thing a store could not do, and the reason "where is my data"
   * could only ever be answered with "in your browser": an op that a server
   * has already judged and compiled has no business being judged and
   * compiled again. Re-running it through `apply` would ask the policy
   * about the wrong principal (whoever is at THIS keyboard, not whoever
   * made the change), recompile against a graph that has moved, and mint a
   * second op with a different id for the same event — so two browsers
   * would diverge rather than converge.
   *
   * So: the primitives land, the op is appended with its own id, author and
   * sequence intact, and the subscribers hear about it exactly as they hear
   * about a local change. Undo still works on it, because an op carries its
   * own inverse.
   *
   * Ops already in the log are skipped by id, so receiving the same batch
   * twice — a poll that overlaps, a reconnect — is not a second change.
   *
   * `seq` is the position in THIS log and is renumbered on the way in; the
   * op keeps everything that identifies it (its id, its author, its intent,
   * its primitives and its inverse). A log is contiguous by construction —
   * that is what makes undo and replay work — and an incoming op carries
   * the sender's numbering, which cannot be this one's the moment this
   * store has applied anything of its own. Whoever is tracking the sender's
   * sequence must keep it themselves; `openRemote` does.
   */
  receive(ops: readonly Operation[], options: { readonly applied?: boolean } = {}): readonly Operation[] {
    const known = new Set(this.log.all().map((op) => op.id));
    const fresh = ops.filter((op) => !known.has(op.id));
    if (fresh.length === 0) return [];
    const before = this.graph.snapshot();
    const landed: Operation[] = [];
    for (const op of fresh) {
      const here = { ...op, seq: this.log.all().length };
      /*
       * ALREADY IN EFFECT HERE. A client that applied a call provisionally
       * and is now handed the server's op for it has the graph the op
       * describes; applying the primitives again would add the node twice.
       * The op still joins the log — it is the one everybody else has — so
       * undo names it and the activity shows it, and the graph stays put.
       */
      if (!options.applied) this.graph.applyPrimitives(here.primitives);
      this.log.append(here);
      landed.push(here);
    }
    this.notify(diffSnapshots(before, this.graph.snapshot()), landed);
    return landed;
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
          const refusal = {
            ...verdict.refusal,
            message: `Not permitted to undo "${target.intent}": ${verdict.refusal.message}`,
          };
          tellTheWatchOfARefusal(refusal, author.id);
          throw new PermissionDeniedError(refusal);
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

