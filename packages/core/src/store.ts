import { hidesFrom, readingOf, seatLens, seenBy, seesId } from "./seen.js";
import type { IntelligenceProviderDeclaration } from "./app.js";
import { Graph, GraphError, MissingRecordError } from "./graph/graph.js";
import { resolveModules, type ModuleMap, type ModuleProjection } from "./modules.js";
import { diffSnapshots, EMPTY_DIFF, isEmptyDiff, type GraphDiff } from "./graph/diff.js";
import { invert, normalise, writesOf, type Primitive } from "./graph/primitives.js";
import { LabelIndex, refusalFor, type RefCandidate, type RefResolution } from "./labels.js";
import { nodeRefArgs, type NodeRefArg } from "./mutations/node-ref.js";
import type { GraphSnapshot } from "./graph/types.js";
import { verifyFold, type VerifyResult } from "./integrity.js";
import { evaluate } from "./invariants/engine.js";
import type {
  EvaluateOptions,
  InvariantContext,
  InvariantDefinition,
  Violation,
} from "./invariants/types.js";
import { compileMutation, READ_BEFORE_REFUSING } from "./mutations/define-mutation.js";
import { deriveMutations, derivedVia } from "./mutations/derive-edits.js";
import type { AnyMutationDefinition, MutationCall } from "./mutations/types.js";
import { OperationLog, type Epoch, type LogArchive } from "./ops/log.js";
import type { Author, Batch, Operation, Via } from "./ops/types.js";
import { actingAs, isSystem, permits, permittedMutations, type PolicyWords } from "./permissions/policy.js";
import { namesUnseen, redact } from "./ops/withheld.js";
import { nounOf } from "./schema/define-node.js";
import { creatorsBefore } from "./permissions/sight.js";
import { PermissionDeniedError, type Policy, type Principal, type Refusal } from "./permissions/types.js";
import { checkUndo, UndoBlockedError, undoPrimitives, type UndoCheck } from "./ops/undo.js";
import type { AnySchema, NodeOfSchema } from "./schema/schema.js";
import { validateGraph, type GraphFinding } from "./validate-graph.js";
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
   *
   * REOPENING ON A SNAPSHOT NEVER FOLDS THE LOG (FR-18). The snapshot is
   * judged by this declaration (held as stored, FR-28; `findings()` says
   * what no longer fits) and the log is only history, so a log that names
   * a kind this declaration dropped opens: its ops stay attributed and
   * listed, and their primitives are not applied again. What touches them
   * afterwards is the declaration change's epoch: a migration that dropped
   * the kind begins one (`epochs`, with `change`), `verify()` folds from
   * it rather than from ops in the old words, and undo does not reach back
   * across it. A log alone, with no snapshot, IS folded (from its last
   * epoch), and a record of a dropped kind it makes is held as written,
   * with `findings()` naming it `kind-unknown` until a repair removes it.
   */
  readonly log?: readonly Operation[];
  /**
   * The epochs `log` folds from (FR-27): a base graph and the seq it starts
   * at, one for each declaration version the log spans. `verify()` folds
   * from the last one, and undo does not cross one that changed the
   * declaration. A store opened on a snapshot alone takes the snapshot as
   * its first epoch.
   */
  readonly epochs?: readonly Epoch[];
  /**
   * The seq `log` begins at, when it was compacted behind an undo horizon
   * and its checkpoint is not among `epochs` (FR-23): a client hydrating on
   * a snapshot is handed the tail and the horizon, not the base. Absent,
   * the log begins at its checkpoint's seq, or at 0.
   */
  readonly horizon?: number;
  /** Defaults to a monotonic counter so tests stay deterministic. */
  readonly ids?: () => string;
  /**
   * Mints a batch id: `kind` is `batch` for a change and `undo` for a
   * take-back. Defaults to `<kind>:<this store's tag>:<n>`, the tag drawn
   * fresh for each store, so two stores opened from the same log, two
   * browsers on one roster, never mint the same batch id. A server that
   * mints them its own way says so here.
   */
  readonly batchIds?: (kind: "batch" | "undo") => string;
  /**
   * The clock each op is stamped by, as an ISO string. Defaults to the
   * current time (FR-18); a test or a replay that needs a fixed one says so.
   */
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
   * modules behaves exactly as before. It is the set the store starts
   * from: a log that says otherwise (an op `setEnabledModules` wrote) has
   * the last word, because turning a module off or on is history (FR-12).
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
  /**
   * What the gesture was for. Recorded beside each op's own sentence, as
   * `batchIntent`, and read as the batch's intent; it no longer replaces
   * the sentence each act's `describe()` gave (FR-18). For an act with no
   * `describe`, it is the op's sentence too.
   */
  readonly intent?: string;
  /** What the change came through — `web`, `mcp:<client>`, `view:<name>`, `api`, `cli` — recorded on each op (FR-06). */
  readonly via?: Via;
  /**
   * A HOST'S LAST WORD, BY WHAT THE CHANGE WOULD DO. Asked once the calls
   * (or the undo) are compiled and applied, before anything is kept, with
   * the store's own plan of them: no second rehearsal on a copy. Whatever
   * it throws goes on up as it was thrown, and the graph, the log and the
   * subscribers are as if the change was never asked. Returning keeps it.
   */
  readonly admit?: (planned: PlannedChange) => void;
}

/**
 * WHAT A CHANGE WOULD DO, before it is kept (`ApplyOptions.admit`): its
 * ops and their primitives, the records and links it adds, removes and
 * changes — a removed record's links counted among the links removed —
 * and how many the store would hold after it.
 */
export interface PlannedChange {
  readonly ops: readonly Operation[];
  readonly primitives: readonly Primitive[];
  readonly added: { readonly nodes: number; readonly edges: number };
  readonly removed: { readonly nodes: number; readonly edges: number };
  readonly changed: { readonly nodes: number };
  readonly nodesAfter: number;
  readonly edgesAfter: number;
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

/**
 * An op a host built itself, for `Store.append` (FR-18): what it does, who
 * did it and why. Everything else is filled in as the store fills its own
 * ops, and kept when the host gave it. A whole `Operation` fits too; its
 * `seq` is renumbered to this log.
 */
export interface AppendOp {
  readonly primitives: readonly Primitive[];
  readonly author: Author;
  /** What was meant, in a sentence: what the activity and every undo say. */
  readonly intent: string;
  readonly id?: string;
  readonly batch?: string;
  readonly batchIntent?: string;
  /** Defaults to the primitives inverted, newest first. */
  readonly inverse?: readonly Primitive[];
  readonly reads?: readonly string[];
  /** Defaults to the ids the primitives write. */
  readonly writes?: readonly string[];
  readonly mutation?: MutationCall | null;
  /** Defaults to the store's clock. */
  readonly at?: string;
  readonly undoes?: string;
  readonly via?: Via;
}

const HUMAN: Author = { kind: "human" };
/** The host itself, which sees what it keeps: the principal a question is asked as when no seat is named. */
const SYSTEM: Principal = { kind: "system" };

/** Who turns a module off or on: the workspace itself, `system · modules` (FR-12). */
export const MODULES_AUTHOR: Author = { kind: "system", id: "modules", name: "Modules" };

/**
 * WHETHER UNDOING AN OP PUTS BACK EXACTLY WHAT IT TOOK (FR-28).
 *
 * An op that was not an act — a repair from `repairPlan`, a migration, a
 * host's own change through `applyPrimitives` — is undone by putting the
 * records back as they were, even a record that no longer fits: undoing a
 * repair means the misfit returns, and `validateGraph` says so again. The
 * undo of an ACT is itself a change within the declaration, and is held to
 * it like any write: one whose inverse the current declaration refuses is
 * refused, and says why.
 */
const putsBack = (op: Operation): boolean => op.mutation === null && op.undoes === undefined;

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
/**
 * An op a store could not take: its primitives do not fit the graph (a node
 * it patches is not there, an edge to nowhere, a field the schema refuses).
 * Nothing it was handed has landed — the store is as it was — and `op` says
 * which one, with the graph's own error as `cause`.
 */
export class ReceiveError extends Error {
  constructor(
    readonly op: Operation,
    cause: unknown,
  ) {
    super(`Op "${op.id}" (${op.intent}) could not be applied: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = "ReceiveError";
  }
}

/** What `Store.rebase` is handed. */
export interface Rebase {
  /** The server's ops, in its order, to land under whatever is pending. Ops the log already holds are skipped. */
  readonly confirmed: readonly Operation[];
  /** This store's batches still awaiting a verdict, oldest first: rolled back, then applied again on top. */
  readonly pending: readonly string[];
  /** This store's batches the server has answered or refused: rolled back and not applied again. */
  readonly drop?: readonly string[];
}

/** What a rebase did. */
export interface RebaseResult<S extends AnySchema> {
  /** The net change, as subscribers heard it. */
  readonly diff: GraphDiff<NodeOfSchema<S>>;
  /** The server's ops that landed, as this log numbers them. */
  readonly confirmed: readonly Operation[];
  /** The pending batches' ops, applied again. */
  readonly pending: readonly Operation[];
  /** Pending batches that no longer apply on top, and why; they are no longer in the log. */
  readonly refused: readonly { readonly batch: string; readonly error: unknown }[];
}

/**
 * What `Store.adopt` is handed (FR-53): the server's whole state, as
 * `GET /graview/state` answers it, and this store's own batches as `rebase`
 * names them.
 */
export interface Adopt<S extends AnySchema> {
  /** The server's graph: it becomes this store's graph, in the server's order. */
  readonly snapshot: GraphSnapshot<NodeOfSchema<S>>;
  /** The server's log, whole or from its undo horizon on: it becomes this store's log. */
  readonly log: readonly Operation[];
  /** The epochs the log folds from (FR-27), the checkpoint among them when it was compacted. */
  readonly epochs?: readonly Epoch[];
  /** The seq `log` begins at when it was compacted and its checkpoint is not among `epochs` (FR-23). */
  readonly horizon?: number;
  /** This store's batches still awaiting a verdict, oldest first: applied again on top. */
  readonly pending?: readonly string[];
  /** This store's batches the server has answered or refused: not applied again. */
  readonly drop?: readonly string[];
}

/** What an adoption did. */
export interface AdoptResult<S extends AnySchema> {
  /** The net change, as subscribers heard it. */
  readonly diff: GraphDiff<NodeOfSchema<S>>;
  /** The server's ops this store did not hold before, as its log numbers them. */
  readonly adopted: readonly Operation[];
  /** The pending batches' ops, applied again. */
  readonly pending: readonly Operation[];
  /** Pending batches that no longer apply on the server's graph, and why; they are not in the log. */
  readonly refused: readonly { readonly batch: string; readonly error: unknown }[];
}

/**
 * A CALL NAMES AN ACT THE APP DOES NOT HAVE. Its message lists every act
 * the store has, for the developer reading it; `mutation` is the name the
 * call gave, so a surface that tells a person can say only that (FR-46).
 */
export class UnknownMutationError extends GraphError {
  constructor(
    readonly mutation: string,
    registered: readonly string[],
  ) {
    super(`Unknown mutation "${mutation}"`, `Registered: ${registered.join(", ") || "(none)"}`);
    this.name = "UnknownMutationError";
  }
}

/**
 * A tag nobody else's store is using, for this store's batch ids. Drawn
 * from the platform's random source where there is one, which every page
 * and Node 22 has.
 */
function storeTag(): string {
  const random = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  const bytes = new Uint8Array(6);
  if (random?.getRandomValues) random.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((byte) => byte.toString(36).padStart(2, "0")).join("");
}

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
  private readonly declaredModules: ModuleMap | undefined;
  private readonly startingModules: readonly string[] | undefined;
  /** The projection, and the log it was read from: its length and its last op. */
  private projected: { readonly projection: ModuleProjection; readonly length: number; readonly last: string | undefined; readonly said: readonly string[] | undefined } | undefined;
  private readonly nextId: () => string;
  private readonly now: () => string;
  private readonly validate: boolean;
  private readonly mintBatch: (kind: "batch" | "undo") => string;
  /**
   * THE TAG THIS STORE MINTS ITS OWN BATCHES UNDER — `batch:<tag>:<n>` —
   * when it mints them its default way; undefined when `batchIds` says
   * otherwise. A server that takes batch ids from clients refuses this tag
   * from one, so nothing the store lands later joins a client's batch.
   */
  readonly batchTag: string | undefined;
  private counter = 0;
  /** The default op id generator's count. */
  private opCount = 0;
  /** Above zero while a rebase applies its pending calls again: they are told as one change at the end. */
  private quiet = 0;
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
    this.declaredModules = options.modules;
    this.startingModules = options.enabledModules;
    this.nextId = options.ids ?? (() => `op${++this.opCount}`);
    this.now = options.now ?? (() => new Date().toISOString());
    this.validate = options.validate ?? true;
    const tag = storeTag();
    this.batchTag = options.batchIds ? undefined : tag;
    this.mintBatch = options.batchIds ?? ((kind) => `${kind}:${tag}:${++this.counter}`);

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

    const horizon = options.horizon !== undefined ? { horizon: options.horizon } : {};
    if (options.log && options.snapshot) {
      // Hydrate: the graph as stored, the history as recorded.
      this.log = OperationLog.from(options.log, options.epochs, horizon);
      this.graph = Graph.from(options.schema, options.snapshot, {
        validate: options.validate ?? true,
      });
    } else if (options.log) {
      this.log = OperationLog.from(options.log, options.epochs, horizon);
      const last = this.log.lastEpoch();
      this.graph = this.log.fold(options.schema, { validate: options.validate ?? true, ...(last ? { from: last } : {}) });
    } else {
      this.log = OperationLog.from(
        [],
        options.epochs ?? (options.snapshot ? [{ seq: options.horizon ?? 0, base: options.snapshot }] : []),
        horizon,
      );
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
    this.countPastTheLog();
    tellTheWatchOfAStore(this);
  }

  /** Winds the default op and batch counters past every id the log holds, and past the horizon (FR-23). */
  private countPastTheLog(): void {
    const trailing = (value: string): number => {
      const digits = /(\d+)$/.exec(value);
      return digits ? Number(digits[1]) : 0;
    };
    for (const op of this.log.all()) {
      this.counter = Math.max(this.counter, trailing(op.batch));
      this.opCount = Math.max(this.opCount, trailing(op.id));
    }
    // Behind an undo horizon (FR-23) are ids the log no longer holds: count on past them all.
    if (this.log.horizon > 0) this.opCount = Math.max(this.opCount, this.log.length);
  }

  /**
   * What the enabled modules work out to; every surface reads this one answer.
   *
   * READ FROM THE LOG (FR-12): the set the last `system · modules` op says,
   * or the one the store was opened with when no op has said one. Kept
   * between reads and re-read only past what it has read — a log only ever
   * grows at its end, and a rebase that cut it is read again from the start.
   */
  get modules(): ModuleProjection {
    const all = this.log.all();
    const last = all.at(-1)?.id;
    const held = this.projected;
    if (held && held.length === all.length && held.last === last) return held.projection;
    let said: readonly string[] | undefined;
    let from = 0;
    if (held && held.length <= all.length && (held.length === 0 || all[held.length - 1]?.id === held.last)) {
      said = held.said;
      from = held.length;
    }
    for (let at = all.length - 1; at >= from; at--) {
      const stated = all[at]!.enabledModules;
      if (stated !== undefined) {
        said = stated;
        break;
      }
    }
    const projection =
      held && said === held.said ? held.projection : resolveModules(this.declaredModules, said ?? this.startingModules);
    this.projected = { projection, length: all.length, last, said };
    return projection;
  }

  /**
   * TURN MODULES OFF OR ON, AS AN OP (FR-12).
   *
   * The enabled set is a fact about the workspace — usually what it pays
   * for — and changing it is history: one op, authored `system · modules`,
   * saying the set it leaves (`enabledModules`) in a sentence a person can
   * read. It touches no record, so it folds to nothing and takes nothing
   * away: a module off is a horizon, and turning it on again brings every
   * record back as it was. Not undone: the set changes by turning a module
   * the other way. `undefined` is every declared module. Nothing is written
   * when the set is the one the store already has.
   */
  setEnabledModules(enabled: readonly string[] | undefined, options: { readonly via?: Via; readonly batch?: string } = {}): Operation | undefined {
    const before = this.modules.enabled;
    const after = resolveModules(this.declaredModules, enabled).enabled;
    const off = [...before].filter((name) => !after.has(name));
    const on = [...after].filter((name) => !before.has(name));
    if (off.length === 0 && on.length === 0) return undefined;
    const named = (names: readonly string[]): string =>
      names
        .map((name) => {
          const kinds = this.declaredModules?.[name]?.kinds ?? [];
          return kinds.length > 0 ? kinds.map((kind) => this.schema.tryDefinition(kind)?.plural ?? kind).join(", ") : name;
        })
        .join(", ");
    const said = [off.length > 0 ? `Turn off ${named(off)}` : "", on.length > 0 ? `turn on ${named(on)}` : ""].filter(Boolean).join("; ");
    const op: Operation = {
      id: this.nextId(),
      seq: this.log.length,
      batch: options.batch ?? this.mintBatch("batch"),
      author: MODULES_AUTHOR,
      intent: said.charAt(0).toUpperCase() + said.slice(1),
      mutation: null,
      primitives: [],
      inverse: [],
      reads: [],
      writes: [],
      at: this.now(),
      ...(options.via !== undefined ? { via: options.via } : {}),
      enabledModules: [...after].sort(),
    };
    this.log.append(op);
    this.notify(EMPTY_DIFF as GraphDiff<NodeOfSchema<S>>, [op]);
    return op;
  }

  mutation(name: string): AnyMutationDefinition<S> {
    const found = this.mutations.get(name);
    if (!found) {
      throw new UnknownMutationError(name, [...this.mutations.keys()]);
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
    const narrowed = this.refusesAgent(call, principal) ?? this.namesTurnedOff(call, principal);
    if (narrowed) return { ok: false, refusal: narrowed } as ReturnType<typeof permits>;
    return permits(
      this.policy,
      principal,
      call.name,
      this.subjectKindOf(call, principal),
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
   * A CALL THAT NAMES A RECORD OF A MODULE THAT IS OFF IS REFUSED (FR-12),
   * whoever makes it: the module's own acts are already off, and an act
   * the core owns — a rename that takes any kind — must not reach into a
   * district the workspace does not have. The sentence names the act.
   */
  private namesTurnedOff(call: MutationCall, principal: Principal = SYSTEM): Refusal | undefined {
    const off = this.modules.disabledKinds;
    if (off.size === 0) return undefined;
    // A seat the module's records are kept from is not told they are there: naming one is naming nothing (FR-55).
    if (!isSystem(principal)) return undefined;
    const mutation = this.mutations.get(call.name);
    if (!mutation) return undefined;
    const named: unknown[] = [];
    if (mutation.subject) named.push(call.args[mutation.subject.arg]);
    for (const ref of nodeRefArgs(mutation.input)) named.push(call.args[ref.name]);
    const ids = named.flatMap((value) => (typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((inner): inner is string => typeof inner === "string") : []));
    if (!ids.some((id) => off.has(this.graph.getNode(id)?.kind as string))) return undefined;
    return {
      mutation: call.name,
      message: `“${mutation.title ?? call.name}” names a record of a module this workspace has turned off.`,
      wouldNeed: [],
    };
  }

  /**
   * AN ACT'S SENTENCE IS WORDED FROM ITS AUTHOR'S VIEW (FR-55). `describe`
   * reads the graph to name what the act touched ("Point at Venue"); read
   * from the whole store, it named a record the author may not see by its
   * label, and so told the author whether a guessed id was real. Read from
   * the store as the author is served it, such a record is named only by
   * what the author wrote, as one that does not exist is. A reader who sees
   * more reads the author's sentence as the author would have. With nothing
   * kept from the author, the store's own graph.
   */
  private wordedFor(author: Principal | undefined): NonNullable<Parameters<typeof compileMutation<S>>[3]> {
    if (author === undefined || !hidesFrom(this, author)) return {};
    // And a seat that writes a value naming what it may not see has written its own words, though the store held them already.
    const hidden = seesId(this, author);
    return { describeWith: seenBy(this, author).graph as never, keepUnchanged: (value: unknown) => namesUnseen(value, hidden) };
  }

  /**
   * AN ACT'S OWN REFUSAL, AS ITS CALLER MAY READ IT (FR-55). An act's body
   * may refuse in its own words, worded from what it read — "Freya Davies
   * is already booked" — and what it read may be a record its caller may
   * not see. Such a refusal is said without its words: the act, and that it
   * could not be done. The store's own refusals already name nothing.
   */
  private refusalWordedFor(error: unknown, author: Principal, calls: readonly MutationCall[]): unknown {
    if (!hidesFrom(this, author) || error instanceof PermissionDeniedError || error instanceof MissingRecordError || error === null || typeof error !== "object") return error;
    const read = (error as { [READ_BEFORE_REFUSING]?: readonly string[] })[READ_BEFORE_REFUSING] ?? [];
    const visible = seesId(this, author);
    if (!read.some((id) => this.graph.has(id) && !visible(id))) return error;
    const title = calls.length === 1 ? (this.mutations.get(calls[0]!.name)?.title ?? calls[0]!.name) : undefined;
    return new GraphError(title ? `“${title}” could not be done as asked.` : "This change could not be done as asked.");
  }

  /**
   * A CALL THAT NAMES A RECORD THAT IS NOT THERE FOR ITS CALLER IS REFUSED
   * AS MISSING (FR-02, FR-55) — one that does not exist, and one the caller
   * may not see, alike: the same `MissingRecordError`, the same sentence,
   * reason `missing`. Ids are minted from labels, so a seat can guess one,
   * and a refusal that told a hidden record from an absent one would tell
   * it which guesses were real. An act on a record is also a way of reading
   * it — its preview, what its rules say after — so a hidden one is never
   * acted on by a seat that may not see it. Asked of each call as it is
   * about to run, so a record an earlier call in the same gesture made is
   * there. The sentence names the act, never the id: it says the same of a
   * hidden record and an absent one, and says back nothing the seat sent.
   */
  missingFor(call: MutationCall, principal: Principal = HUMAN): MissingRecordError | undefined {
    const mutation = this.mutations.get(call.name);
    if (!mutation) return undefined;
    const named = new Set<string>();
    const add = (value: unknown) => {
      if (typeof value === "string") named.add(value);
      else if (Array.isArray(value)) for (const inner of value) if (typeof inner === "string") named.add(inner);
    };
    if (mutation.subject) add(call.args[mutation.subject.arg]);
    for (const ref of nodeRefArgs(mutation.input)) add(call.args[ref.name]);
    if (named.size === 0) return undefined;
    const visible = seesId(this, principal);
    for (const id of named) {
      if (this.graph.has(id) && visible(id)) continue;
      return new MissingRecordError(id, `“${mutation.title ?? call.name}” names a record that is not there.`);
    }
    return undefined;
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
    return this.graph.has(id) && seesId(this, principal)(id);
  }

  private labels: LabelIndex<S> | undefined;

  /**
   * WHAT A NAME GIVEN FOR A NODE ARGUMENT MEANS, to this principal (FR-33).
   *
   * An id of a record the principal may see is that record, whatever it is
   * called. Otherwise a label, case and accents aside, among the records of
   * the kinds the argument accepts; failing that, the one label the name
   * starts. Only records the principal may see are ever candidates — a
   * name never tells a seat that something it may not see exists. Several
   * matches are refused with every candidate; none says so.
   */
  resolveRef(arg: Pick<NodeRefArg, "name" | "kinds">, given: string, principal: Principal = HUMAN): RefResolution {
    const sighted = (this.policy?.sees?.length ?? 0) > 0;
    const visible = (id: string): boolean => !sighted || this.sees(principal, id);
    const named = this.graph.getNode(given);
    this.labels ??= new LabelIndex(this.graph);
    if (named && visible(given)) return { ok: true, id: given, label: this.labels.labelOf(given) ?? given, by: "id" };
    const found = this.labels.lookup(arg.kinds, given);
    const exact = found.exact.filter(visible);
    const exactly = exact.length > 0;
    const candidates: RefCandidate[] = (exactly ? exact : found.prefix.filter(visible))
      .map((id) => ({ id, kind: this.graph.getNode(id)!.kind, label: this.labels!.labelOf(id) ?? id }))
      .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : a.id < b.id ? -1 : 1));
    if (candidates.length === 1) return { ok: true, id: candidates[0]!.id, label: candidates[0]!.label, by: exactly ? "label" : "prefix" };
    return refusalFor(this.schema, arg, given, candidates);
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
    if (sights.length > 0 && !isSystem(principal)) {
      const creatable = new Set(this.permittedMutations(principal).flatMap((mutation) => mutation.creates ?? []));
      // Every kind: once a policy says who sees what, a kind no sight names is seen by nobody.
      for (const kind of this.schema.kinds as readonly string[]) {
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
        permits(this.policy, principal, mutation.name, mutation.derived.kind, this.viaOf(mutation), actingAs(principal).id).ok,
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
  private subjectKindOf(call: MutationCall, principal: Principal = SYSTEM): string | undefined {
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
    // A record the principal may not see is judged as one that is not there: its kind is not the policy's to read aloud (FR-55).
    if (!isSystem(principal) && !seesId(this, principal)(id)) return undefined;
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

  preview(call: MutationCall, context?: InvariantContext, options: { readonly author?: Principal } = {}): Preview<S> {
    const definition = this.mutation(call.name);
    const compiled = compileMutation(this.graph, definition, call.args, this.wordedFor(options.author));
    return this.previewPrimitives(compiled.primitives, {
      reads: compiled.reads,
      writes: compiled.writes,
      intent: compiled.intent,
      context,
    });
  }

  /**
   * What several calls would do as one gesture, without doing any of it
   * (FR-18): each compiles on the graph the one before it left, as
   * `applyAll` would run them, on a copy. The diff is the net of them all,
   * and `introduces` and `resolves` judge the end state against today's.
   * A call that cannot compile throws, as it would on applying; nothing is
   * written, logged or heard either way.
   */
  previewAll(calls: readonly MutationCall[], context?: InvariantContext): Preview<S> {
    const before = this.violations(context);
    const start = this.graph.snapshot();
    const trial = Graph.from(this.schema, start, { validate: this.validate });
    const primitives: Primitive[] = [];
    const reads = new Set<string>();
    const writes = new Set<string>();
    const intents: string[] = [];
    for (const call of calls) {
      const compiled = compileMutation(trial, this.mutation(call.name), call.args);
      // An act that does nothing leaves no trace when applied, nor here.
      if (compiled.primitives.length === 0) continue;
      const recorded = compiled.primitives.map(normalise);
      trial.applyPrimitives(recorded);
      primitives.push(...recorded);
      for (const id of compiled.reads) reads.add(id);
      for (const id of compiled.writes) writes.add(id);
      intents.push(compiled.intent);
    }
    const after = evaluate(trial, this.allInvariants(), {
      ...this.invariantOptions,
      ...(context === undefined ? {} : { context }),
    });
    const beforeKeys = new Set(before.map(violationKey));
    const afterKeys = new Set(after.map(violationKey));
    return {
      diff: diffSnapshots(start, trial.snapshot()),
      primitives,
      reads: [...reads],
      writes: [...writes],
      intent: intents.join("; "),
      introduces: after.filter((v) => !beforeKeys.has(violationKey(v))),
      resolves: before.filter((v) => !afterKeys.has(violationKey(v))),
      violationsAfter: after,
    };
  }

  private previewPrimitives(
    primitives: readonly Primitive[],
    meta: {
      reads: readonly string[];
      writes: readonly string[];
      intent: string;
      context?: InvariantContext;
      /** An undo: what it puts back is held as it was (FR-28). */
      restoring?: boolean;
    },
  ): Preview<S> {
    const before = this.violations(meta.context);
    const trial = Graph.from(this.schema, this.graph.snapshot());
    const diff = trial.applyPrimitives(primitives, { restoring: meta.restoring === true });
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
    return this.applying(calls, options);
  }

  /**
   * `applyAll` itself. Kept apart so a rebase applies pending calls again
   * through the store's own path, whatever a host has wrapped `applyAll` in
   * (`openRemote` sends each one down the wire).
   */
  private applying(calls: readonly MutationCall[], options: ApplyOptions): ApplyResult<S> {
    const batch = options.batch ?? this.mintBatch("batch");
    const author = options.author ?? HUMAN;
    const ops: Operation[] = [];
    const allPrimitives: Primitive[] = [];
    const reads = new Set<string>();
    const writes = new Set<string>();
    const intents: string[] = [];

    const before = this.violations();
    const rollback = this.graph.snapshot();
    const kept = this.log.length;

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
      const refusal = this.refusesAgent(call, author) ?? this.namesTurnedOff(call, author as Principal);
      if (refusal) {
        tellTheWatchOfARefusal(refusal, author.id);
        throw new PermissionDeniedError(refusal);
      }
    }
    tellTheWatchOfAnAuthor(author.id);

    try {
      for (const call of calls) {
        const definition = this.mutation(call.name);
        const missing = this.missingFor(call, author as Principal);
        if (missing) throw missing;
        const compiled = compileMutation(this.graph, definition, call.args, this.wordedFor(author as Principal));
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
          /*
           * THE ACT'S OWN SENTENCE, kept; what the gesture was for goes
           * beside it (FR-18). An act with no `describe` has no sentence of
           * its own, only `close-item(id="deposit")`, and there the caller's
           * words ("Close it", the button's) are the better one.
           */
          intent: definition.describe !== undefined ? compiled.intent : (options.intent ?? compiled.intent),
          ...(options.intent !== undefined ? { batchIntent: options.intent } : {}),
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
          // Which records its sentence read, so a reader who may not see one is not handed the sentence (FR-55).
          ...(definition.describe !== undefined && compiled.described && compiled.described.length > 0 ? { described: compiled.described } : {}),
          at: this.now(),
          ...(options.via !== undefined ? { via: options.via } : {}),
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
      // A batch refused part way keeps none of it: the graph, and the ops it had logged before the refusal.
      this.putBack(rollback, kept);
      throw this.refusalWordedFor(error, author as Principal, calls);
    }

    const diff = diffSnapshots(rollback, this.graph.snapshot());
    this.admitted(options, ops, allPrimitives, diff, rollback, kept);
    const after = this.violations();
    const beforeKeys = new Set(before.map(violationKey));
    const afterKeys = new Set(after.map(violationKey));
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
    /*
     * ALL OR NOTHING, ACROSS THE OPS TOO (FR-26). Every op's primitives go
     * on first; one that fails puts the graph back as it was — `load`, so a
     * listener that heard the ops before it hears them reversed — and
     * throws a ReceiveError naming that op, before any of them joins the
     * log. A store handed a bad op is the store it was.
     *
     * ALREADY IN EFFECT HERE (`applied`). A client that applied a call
     * provisionally and is now handed the server's op for it has the graph
     * the op describes; applying the primitives again would add the node
     * twice. The op still joins the log — it is the one everybody else has
     * — so undo names it and the activity shows it, and the graph stays put.
     */
    if (!options.applied) {
      for (const op of fresh) {
        try {
          // Somebody's undo puts back what was there, here as there (FR-28).
          this.graph.applyPrimitives(op.primitives, { restoring: op.undoes !== undefined });
        } catch (error) {
          this.graph.load(before);
          throw new ReceiveError(op, error);
        }
      }
    }
    const seq = this.log.length;
    for (const [index, op] of fresh.entries()) {
      const here = { ...op, seq: seq + index };
      this.log.append(here);
      landed.push(here);
    }
    this.notify(diffSnapshots(before, this.graph.snapshot()), landed);
    return landed;
  }

  /**
   * OPS A HOST MADE, landed as ordinary history (FR-18): a template's
   * example content, a seeded beginning, a repair or an import the host
   * built itself. Unlike `receive`, which takes ops somebody else's store
   * already made and skips the ones it has, these are new here, so the
   * store fills in what the host left out the way it fills its own: the
   * seq, an id, one batch for the call (`options.batch`, else a fresh one),
   * the time, the inverse (from the primitives), what they write, and no
   * mutation. What the host did say is kept.
   *
   * Each op lands as a write (a default is filled in on the way in, as a
   * fold would), or, when it `undoes` another, as a putting-back. No policy
   * is asked: there is no act to judge, and whoever calls this is the
   * authority, as with `applyPrimitives`. All or nothing: an op that does
   * not fit puts the store back as it was and throws a `ReceiveError`
   * naming it, and an id the log already holds is refused before anything
   * lands. Subscribers hear one change, and every op undoes like any other.
   */
  append(ops: readonly AppendOp[], options: { readonly batch?: string } = {}): readonly Operation[] {
    if (ops.length === 0) return [];
    const taken = new Set(this.log.all().map((op) => op.id));
    let batch: string | undefined;
    const built: Operation[] = ops.map((made, index) => {
      const primitives = made.primitives.map(normalise);
      const op: Operation = {
        id: made.id ?? this.nextId(),
        seq: this.log.length + index,
        batch: made.batch ?? options.batch ?? (batch ??= this.mintBatch("batch")),
        author: made.author,
        intent: made.intent,
        ...(made.batchIntent !== undefined ? { batchIntent: made.batchIntent } : {}),
        mutation: made.mutation ?? null,
        primitives,
        inverse: made.inverse ?? [...primitives].reverse().map(invert),
        reads: made.reads ?? [],
        writes: made.writes ?? [...new Set(primitives.flatMap(writesOf))],
        at: made.at ?? this.now(),
        ...(made.undoes !== undefined ? { undoes: made.undoes } : {}),
        ...(made.via !== undefined ? { via: made.via } : {}),
      };
      if (taken.has(op.id)) throw new GraphError(`Op "${op.id}" (${op.intent}) is already in the log`, "A host-made op needs an id of its own; leave `id` out and the store mints one.");
      taken.add(op.id);
      return op;
    });
    const before = this.graph.snapshot();
    for (const op of built) {
      try {
        this.graph.applyPrimitives(op.primitives, { restoring: op.undoes !== undefined });
      } catch (error) {
        this.graph.load(before);
        throw new ReceiveError(op, error);
      }
    }
    for (const op of built) this.log.append(op);
    for (const op of built) tellTheWatchOfAnAuthor(op.author.id);
    this.notify(diffSnapshots(before, this.graph.snapshot()), built);
    return built;
  }

  /**
   * PRIMITIVES AS AN ORDINARY CHANGE (FR-21): one batch, one op, logged,
   * attributed to `author` and undoable like any act. For changes that are
   * not a declared mutation — a repair from `repairPlan`, a host's own fix —
   * so they land in the history rather than beside it.
   *
   * No policy is asked: there is no act to judge, so whoever calls this is
   * the authority, the way a migration engine is. All or nothing (FR-26): a
   * primitive that does not fit leaves the store as it was and throws.
   */
  applyPrimitives(primitives: readonly Primitive[], options: ApplyOptions = {}): ApplyResult<S> {
    const batch = options.batch ?? this.mintBatch("batch");
    const author = options.author ?? HUMAN;
    const before = this.violations();
    const rollback = this.graph.snapshot();
    const intent = options.intent ?? "Apply a change";
    const recorded = primitives.map(normalise);
    const ops: Operation[] = [];
    if (recorded.length > 0) {
      const op: Operation = {
        id: this.nextId(),
        seq: this.log.length,
        batch,
        author,
        intent,
        mutation: null,
        primitives: recorded,
        inverse: [...recorded].reverse().map(invert),
        reads: [],
        writes: [...new Set(recorded.flatMap(writesOf))],
        at: this.now(),
        ...(options.via !== undefined ? { via: options.via } : {}),
      };
      this.graph.applyPrimitives(op.primitives);
      this.log.append(op);
      ops.push(op);
      tellTheWatchOfAnAuthor(author.id);
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
      primitives: recorded,
      reads: [],
      writes: ops[0]?.writes ?? [],
      intent,
      introduces: after.filter((v) => !beforeKeys.has(violationKey(v))),
      resolves: before.filter((v) => !afterKeys.has(violationKey(v))),
      violationsAfter: after,
    };
  }

  /**
   * What in this store no longer fits its declaration (FR-21): the graph
   * as held, judged by `validateGraph` against the schema and the rules
   * this workspace has on. A clean store has none.
   */
  findings(): GraphFinding[] {
    return validateGraph({ schema: this.schema, invariants: this.allInvariants() }, this.graph.snapshot(), {
      invariantOptions: this.invariantOptions,
    });
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
        restoring: check.ops.every(putsBack),
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
    return this.undoing(batchIds, options);
  }

  /** `undo` itself, kept apart for the same reason as `applying`. */
  private undoing(batchIds: string | readonly string[], options: ApplyOptions): ApplyResult<S> {
    const ids = typeof batchIds === "string" ? [batchIds] : batchIds;
    const author = options.author ?? HUMAN;
    /*
     * JUDGED FIRST AS THIS SEAT SEES THE LOG (FR-16, FR-02). A change it
     * may not see is not its to take back, and when one stands in the way
     * the refusal says a change you cannot see does — the full check's
     * sentence would quote it. The two agree on what blocks: a withheld op
     * keeps the ids this seat sees, and those are all it can overlap.
     */
    const sighted = (this.policy?.sees?.length ?? 0) > 0 && !isSystem(author as Principal);
    if (sighted) {
      const seen = checkUndo(readingOf(redact(this.log.all(), seatLens(this, author as Principal)), () => this.log.epochs()), ids);
      if (!seen.ok) throw new UndoBlockedError(seen);
    }
    const check = this.canUndo(ids);
    if (!check.ok) {
      throw new UndoBlockedError(
        sighted
          ? { ok: false, ops: [], blockedBy: [], includeBatches: [], message: "Cannot undo on its own — a later change you cannot see depends on it, which only somebody who can see it can take back." }
          : check,
      );
    }

    const batch = options.batch ?? this.mintBatch("undo");

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
    const kept = this.log.length;

    for (const target of [...check.ops].sort((a, b) => b.seq - a.seq)) {
      const op: Operation = {
        id: this.nextId(),
        seq: this.log.length,
        batch,
        author,
        intent: `Undo: ${target.intent}`,
        ...(options.intent !== undefined ? { batchIntent: options.intent } : {}),
        mutation: null,
        primitives: target.inverse,
        inverse: [...target.inverse].reverse().map(invert),
        reads: target.reads,
        writes: target.writes,
        at: this.now(),
        undoes: target.id,
        ...(options.via !== undefined ? { via: options.via } : {}),
      };
      this.graph.applyPrimitives(op.primitives, { restoring: putsBack(target) });
      this.log.append(op);
      ops.push(op);
    }

    const diff = diffSnapshots(rollback, this.graph.snapshot());
    this.admitted(options, ops, ops.flatMap((op) => [...op.primitives]), diff, rollback, kept);
    const after = this.violations();
    const beforeKeys = new Set(before.map(violationKey));
    const afterKeys = new Set(after.map(violationKey));
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

  /** A change not kept: the graph as it was, and the log cut back to where it stood. */
  private putBack(rollback: GraphSnapshot<NodeOfSchema<S>>, kept: number): void {
    this.graph.load(rollback);
    if (this.log.length > kept) this.log.truncate(kept);
  }

  /** Asks the host's `admit`, when there is one, with the change as planned; one it refuses is put back, and its word goes on up. */
  private admitted(options: ApplyOptions, ops: readonly Operation[], primitives: readonly Primitive[], diff: GraphDiff<NodeOfSchema<S>>, rollback: GraphSnapshot<NodeOfSchema<S>>, kept: number): void {
    if (!options.admit || ops.length === 0) return;
    const size = this.graph.size;
    try {
      options.admit({
        ops,
        primitives,
        added: { nodes: diff.addedNodes.length, edges: diff.addedEdges.length },
        removed: { nodes: diff.removedNodes.length, edges: diff.removedEdges.length },
        changed: { nodes: diff.changedNodes.length },
        nodesAfter: size.nodes,
        edgesAfter: size.edges,
      });
    } catch (error) {
      this.putBack(rollback, kept);
      throw error;
    }
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

  /**
   * TELLS EVERY SUBSCRIBER OF A CHANGE: the diff, and the ops that made it.
   * The store calls this for each change it makes; it is public for a host
   * that changes the graph some other way and owes its subscribers the same
   * news (the rebase item of FR-05). A change with no ops and an empty diff
   * is nothing to tell.
   */
  notify(diff: GraphDiff<NodeOfSchema<S>>, ops: readonly Operation[]): void {
    if (this.quiet > 0) return;
    if (ops.length === 0 && isEmptyDiff(diff as GraphDiff<never>)) return;
    for (const listener of this.listeners) listener(diff, ops);
  }

  /**
   * AN OPTIMISTIC CLIENT'S ROLLBACK (the rebase item of FR-05).
   *
   * A client applies a press at once and sends it; the server's op is the
   * one that stays. When anything arrives from the server — somebody else's
   * ops, or the verdict on one of this client's — the client's log must
   * read `[confirmed…, pending…]` again. So, in one step:
   *
   * 1. every op of the `pending` and `drop` batches is rolled back, newest
   *    first, and cut from the log (they must be its tail: an op after
   *    them that is neither is refused, before anything moves);
   * 2. the `confirmed` ops land in the server's order, skipped by id when
   *    the log already holds them, all or nothing (`ReceiveError`);
   * 3. the `pending` batches are applied again on top, in the order given,
   *    under the same batch ids, author, intent and channel: each call
   *    judged and compiled afresh against the graph the server's ops left.
   *    One that no longer applies there is left off and said in `refused`;
   *    the server's verdict on it will say the rest.
   *
   * `drop` is the batches the server has answered (its own op for them is
   * among `confirmed`) or refused. Subscribers hear ONE change, the net
   * diff, with the confirmed ops and the re-applied ones, so an interface
   * never flickers through the states in between.
   */
  rebase(change: Rebase): RebaseResult<S> {
    const settling = new Set([...change.pending, ...(change.drop ?? [])]);
    const all = this.log.all();
    const first = all.findIndex((op) => settling.has(op.batch));
    const tail = all.slice(first < 0 ? all.length : first);
    // The seq the log is cut back to: indexes into `all()` count from the horizon (FR-23).
    const cut = this.log.horizon + (first < 0 ? all.length : first);
    const stray = tail.find((op) => !settling.has(op.batch));
    if (stray) {
      throw new GraphError(
        `Cannot rebase: op "${stray.id}" (${stray.intent}) comes after a pending batch and is neither pending nor dropped`,
        "While anything is pending, land the server's ops through rebase, so the log stays confirmed ops then pending ones.",
      );
    }
    const epoch = this.log.lastEpoch();
    if (epoch && epoch.seq > cut) throw new GraphError(`Cannot rebase across an epoch: one begins at seq ${epoch.seq}, after pending op "${tail[0]!.id}"`);

    const before = this.graph.snapshot();
    const landed: Operation[] = [];
    const replayed: Operation[] = [];
    const refused: { batch: string; error: unknown }[] = [];
    this.quiet++;
    try {
      // 1. Back to the confirmed prefix, putting back exactly what each op took.
      // In place: what a pending op took out goes back where it stood, or this copy and the server's disagree on order.
      for (const op of [...tail].reverse()) this.graph.applyPrimitives(op.inverse, { restoring: true, inPlace: true });
      this.log.truncate(cut);

      // 2. What the server says, in its order.
      const known = new Set(this.log.all().map((op) => op.id));
      for (const op of change.confirmed) {
        if (known.has(op.id)) continue;
        try {
          this.graph.applyPrimitives(op.primitives, { restoring: op.undoes !== undefined });
        } catch (error) {
          throw new ReceiveError(op, error);
        }
        const here = { ...op, seq: this.log.length };
        this.log.append(here);
        known.add(op.id);
        landed.push(here);
      }

      // 3. What is still pending, again, on top.
      for (const batch of change.pending) {
        const ops = tail.filter((op) => op.batch === batch);
        if (ops.length === 0) continue;
        try {
          replayed.push(...this.replay(batch, ops));
        } catch (error) {
          refused.push({ batch, error });
        }
      }
    } catch (error) {
      // A store handed a bad op is the store it was.
      this.log.truncate(cut);
      for (const op of tail) this.log.append(op);
      this.graph.load(before);
      throw error;
    } finally {
      this.quiet--;
    }

    const diff = diffSnapshots(before, this.graph.snapshot());
    const ops = [...landed, ...replayed];
    this.notify(diff, ops);
    return { diff, confirmed: landed, pending: replayed, refused };
  }

  /**
   * A CLIENT THAT RESYNCED TAKES THE SERVER'S WHOLE STATE (FR-53).
   *
   * `rebase` lands the server's ops on the confirmed prefix this store
   * holds. When that prefix cannot be trusted — this copy drifted, and an
   * op of the server's no longer fits it, or the server compacted past
   * where this client left off, so `/graview/since` cannot bring the ops in
   * between — the client takes the server's graph and log as they are:
   *
   * 1. the ops of the `pending` batches are read off the log as it stands;
   * 2. the log becomes `log` (with its `epochs` and `horizon`, checked as
   *    `OperationLog.from` checks them; one that is not intact is refused
   *    before anything moves) and the graph becomes `snapshot`, in the
   *    server's order — not put back op by op, as `rebase` puts it;
   * 3. the `pending` batches are applied again on top, in the order given,
   *    exactly as `rebase` applies them: under the same batch ids, judged
   *    and compiled afresh. One that no longer applies is said in `refused`.
   *
   * `drop` names the batches the server has answered or refused: they are
   * not applied again (nor is any batch left unnamed: the log is the
   * server's). Subscribers hear ONE change, the net diff, with the ops this
   * store did not hold before and the re-applied ones.
   */
  adopt(state: Adopt<S>): AdoptResult<S> {
    const dropped = new Set(state.drop ?? []);
    const pending = (state.pending ?? []).filter((batch) => !dropped.has(batch));
    const held = this.log.all();
    const before = this.graph.snapshot();
    const was = { ops: [...held], epochs: [...this.log.epochs()], horizon: this.log.horizon };
    const known = new Set(held.map((op) => op.id));
    const tails = new Map(pending.map((batch) => [batch, held.filter((op) => op.batch === batch)]));

    // A log that is not intact is refused here, before the graph moves.
    if (state.log.length > 0) this.log.replace(state.log, state.epochs, state.horizon !== undefined ? { horizon: state.horizon } : {});
    else {
      const at = state.horizon ?? 0;
      this.log.replace([], state.epochs ?? [{ seq: at, base: state.snapshot }], { horizon: at });
    }

    const replayed: Operation[] = [];
    const refused: { batch: string; error: unknown }[] = [];
    this.quiet++;
    try {
      this.graph.load(state.snapshot);
      this.projected = undefined;
      this.countPastTheLog();
      for (const batch of pending) {
        const ops = tails.get(batch) ?? [];
        if (ops.length === 0) continue;
        try {
          replayed.push(...this.replay(batch, ops));
        } catch (error) {
          refused.push({ batch, error });
        }
      }
    } catch (error) {
      // A store that could not adopt is the store it was.
      this.log.replace(was.ops, was.epochs, { horizon: was.horizon });
      this.graph.load(before);
      this.projected = undefined;
      throw error;
    } finally {
      this.quiet--;
    }

    const adopted = this.log.all().filter((op) => !known.has(op.id) && !replayed.includes(op));
    const diff = diffSnapshots(before, this.graph.snapshot());
    this.notify(diff, [...adopted, ...replayed]);
    return { diff, adopted, pending: replayed, refused };
  }

  /** One pending batch, applied again as it was made: its calls, its undo, or its primitives. */
  private replay(batch: string, ops: readonly Operation[]): readonly Operation[] {
    const head = ops[0]!;
    const options: ApplyOptions = {
      author: head.author,
      batch,
      ...(head.batchIntent !== undefined ? { intent: head.batchIntent } : {}),
      ...(head.via !== undefined ? { via: head.via } : {}),
    };
    if (head.undoes !== undefined) {
      const targets = ops.map((op) => this.log.get(op.undoes ?? ""));
      const missing = ops.find((_op, index) => targets[index] === undefined);
      if (missing) throw new GraphError(`What "${missing.intent}" took back is no longer in the log`);
      return this.undoing([...new Set(targets.map((op) => op!.batch))], options).ops;
    }
    if (ops.every((op) => op.mutation !== null)) {
      return this.applying(ops.map((op) => op.mutation!), options).ops;
    }
    return this.append(ops.map(({ seq: _seq, ...op }) => op));
  }

  snapshot(): GraphSnapshot<NodeOfSchema<S>> {
    return this.graph.snapshot();
  }

  /**
   * WHETHER THE GRAPH IS WHAT ITS LOG SAYS (FR-20).
   *
   * Refolds the log from its last epoch (FR-27), or from empty when it has
   * none, and compares the result with the graph held, by `snapshotHash`. Agreement returns the hash; disagreement returns both
   * hashes and the op after which they part, so a host that finds a store
   * drifted knows where to look rather than only that it should.
   */
  verify(): VerifyResult {
    const from = this.log.lastEpoch();
    return verifyFold(this.schema, this.log.opsFrom(from?.seq ?? 0), this.graph.snapshot(), {
      validate: this.validate,
      ...(from ? { base: from.base } : {}),
    });
  }

  /**
   * THE CHECKPOINT A COMPACTION WOULD MAKE (FR-23), or `undefined` when
   * nothing is old enough to archive. The horizon is `seq` when given, or
   * else whichever of two keeps more: the ops made in the last `keepDays`
   * days before `now` (default 90), or the last `keepOps` ops (default
   * 1000). It is moved back to the start of the gesture it would split, so
   * a batch is never half behind it.
   *
   * The checkpoint keeps who made each record behind it (`creators`), so a
   * store opened on it knows a record's maker without the archived ops.
   *
   * Nothing moves until `compact` is handed the checkpoint, so a host can
   * archive what is behind it first. A store whose graph does not verify
   * against its log is not compacted: the checkpoint would vouch for a
   * history that does not lead to the graph held.
   */
  checkpoint(options: CompactOptions = {}): Epoch | undefined {
    const ops = this.log.all();
    let seq: number;
    if (options.seq !== undefined) seq = options.seq;
    else {
      const byOps = this.log.length - (options.keepOps ?? 1000);
      const now = Date.parse(options.now ?? this.now());
      const cutoff = now - (options.keepDays ?? 90) * 86_400_000;
      const kept = ops.find((op) => Date.parse(op.at) > cutoff);
      const byDays = kept ? kept.seq : this.log.length;
      seq = Math.min(byOps, byDays);
    }
    seq = Math.min(Math.max(seq, this.log.horizon), this.log.length);
    // Never inside a gesture: back to where the batch it would split began.
    while (seq > this.log.horizon && seq < this.log.length && ops[seq - this.log.horizon]!.batch === ops[seq - 1 - this.log.horizon]!.batch) seq--;
    if (seq <= this.log.horizon) return undefined;
    const verified = this.verify();
    if (!verified.ok) throw new GraphError(`Cannot compact a store that does not verify: ${verified.reason}`);
    const checkpoint = this.log.checkpointAt(this.schema, seq, { validate: this.validate });
    // Who made each record behind it, so a store opened on it still knows (an `own` sight reads the log for it).
    const creators = creatorsBefore(this.log, seq);
    return Object.keys(creators).length > 0 ? { ...checkpoint, creators } : checkpoint;
  }

  /**
   * MOVES THE UNDO HORIZON TO `checkpoint` (FR-23): the ops and epochs
   * before it leave the log, which begins at its seq from now on, and are
   * returned for an adapter to archive. The graph is unchanged and still
   * verifies; undo of anything behind the horizon is refused, naming it.
   * Ship's `opened.compact()` archives first and calls this after.
   */
  compact(checkpoint: Epoch): LogArchive {
    return this.log.compact(checkpoint);
  }
}

/** Where `store.checkpoint` puts the undo horizon (FR-23). */
export interface CompactOptions {
  /** The seq to put it at. Absent, it follows from `keepDays` and `keepOps`. */
  readonly seq?: number;
  /** Keep every op made in the last this-many days before `now`; one exactly that old is archived. Default 90. */
  readonly keepDays?: number;
  /** Keep at least this many of the latest ops. Default 1000. */
  readonly keepOps?: number;
  /** The time the days count back from, as an ISO string. Defaults to the store's clock. */
  readonly now?: string;
}

