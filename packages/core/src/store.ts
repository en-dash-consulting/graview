import { hidesFrom, readingOf, seatLens, seenBy, seesEveryRecord, seesId, type SeenOptions } from "./seen.js";
import { isoToday } from "./days.js";
import type { IntelligenceProviderDeclaration } from "./app.js";
import { Graph, GraphError, MissingRecordError } from "./graph/graph.js";
import { resolveModules, type ModuleMap, type ModuleProjection } from "./modules.js";
import { diffSnapshots, diffTouched, EMPTY_DIFF, isEmptyDiff, type GraphDiff } from "./graph/diff.js";
import { normalize, writesOf, type Primitive } from "./graph/primitives.js";
import { bareOp, inverseOf } from "./ops/inverse.js";
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
import { compileMutation } from "./mutations/define-mutation.js";
import { actSpelledAs, nearestAct } from "./mutations/act-spelling.js";
import { InvalidArguments } from "./mutations/invalid-arguments.js";
import { deriveMutations, derivedVia, removeVia } from "./mutations/derive-edits.js";
import { repeatingFields, repeatMakes } from "./mutations/derive-repeats.js";
import type { AnyMutationDefinition, MutationCall } from "./mutations/types.js";
import { namesMade, resolveMade } from "./mutations/made.js";
import { OperationLog, type Epoch, type LogArchive } from "./ops/log.js";
import type { Author, Batch, Operation, Via } from "./ops/types.js";
import { lineageOf, type Lineage } from "./ops/lineage.js";
import { KEEP_LINK, keepLinkMutation, keepLinkVia } from "./mutations/keep-link.js";
import { TYPE_TEXT, TYPING } from "./text/typing-hook.js";
import type { FieldRevision } from "./ops/revisions.js";
import { declinedIn, isAutomated, tidyingRefusal, type ActMeanings } from "./ops/tidying.js";
import { nameOfAuthor } from "./who.js";
import { actingAs, grantsTo, isSystem, permits, permittedMutations, subjectKinds, type PolicyWords } from "./permissions/policy.js";
import { namesUnseen, redact } from "./ops/withheld.js";
import { writersBehind } from "./ops/writers.js";
import { nounOf } from "./schema/define-node.js";
import { behind, fieldsJudged, partialSight, recordsOf } from "./permissions/sight.js";
import { PermissionDeniedError, type Policy, type Principal, type Refusal } from "./permissions/types.js";
import { checkUndo, UndoBlockedError, undoneInverses, undoPrimitives, type UndoCheck } from "./ops/undo.js";
import type { AnySchema, NodeOfSchema } from "./schema/schema.js";
import { validateGraph, type GraphFinding } from "./validate-graph.js";
import { tellTheWatchOfAStore, tellTheWatchOfAnAuthor, tellTheWatchOfARefusal, tellTheWatchOfAnInputRefusal } from "./watched.js";
import { capitalize } from "./capital.js";
import { dayOf, type Tick } from "./clock.js";
import { pluralOf } from "./schema/define-node.js";
import { linkedReaderOf } from "./schema/linked.js";
import { onPublish, PUBLISH, PUBLISHING, type Publishing } from "./publish.js";

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
   * THE APP'S TIME ZONE, `brand.timeZone` (Roadmap f-app-time-zone): the
   * day its rules, computed fields and templates read as today() is the
   * date there, and the day turns at its midnight (`tick`, `tickEachDay`).
   * Absent, the zone of the app the page draws (`sayIn`), else UTC.
   * `@graview/ship`'s `openStore` and `openRemote` pass the app's own.
   */
  readonly timeZone?: string;
  /**
   * Who may run what. Absent means permission is not a concern here.
   *
   * It lives on the STORE and nowhere else. The tool runtime calls the same
   * mutations a person does, so a check in a React component is not a
   * permission system — it is a suggestion, and the agent seat is the bypass.
   */
  readonly policy?: Policy;
  /**
   * WHEN EDITS REACH READERS (Roadmap f-publishing-lifecycle): absent or
   * `"live"`, as they are made; `"on-publish"`, when a publisher publishes
   * them, the `working` roles editing the head meanwhile. On the store, as
   * the policy is, so every surface that reads a seat's view is served it.
   */
  readonly publishing?: Publishing;
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
   * runtime honored it for proposals that went through the tool runtime; a
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
  /**
   * WHO ACTS WHEN A CHANGE NAMES NOBODY: the reader of this page, so what
   * they do is attributed to them in the log rather than to "a person".
   * An apply or an undo that names its author still says its own. Absent,
   * a person with no name.
   */
  readonly principal?: Author | Principal;
  /**
   * HOW OFTEN `pastOf` KEEPS A POINT TO FOLD FROM (Roadmap f-playback): every
   * this-many ops, in memory, as a seek passes it. Default 64.
   */
  readonly pastEvery?: number;
  /** A store of the past (`pastOf`, `@graview/core/past`): read, never changed. Set by `pastOf` itself. */
  readonly past?: PastPoint;
}

/**
 * WHERE A STORE OF THE PAST STANDS (Roadmap f-playback): the seq it was
 * folded to, when the last op before it was made, and the point it was
 * folded from — a kept checkpoint, an epoch or the horizon — with how many
 * ops that took.
 */
export interface PastPoint {
  /** The ops before this seq are in it; none after. */
  readonly seq: number;
  /** When the last op in it was made; absent at the very start. */
  readonly at?: string;
  /** The seq the fold began at. */
  readonly foldedFrom: number;
  /** How many ops it folded to get here. */
  readonly folded: number;
}

/**
 * THE DECLARATION A MOMENT WAS MADE UNDER, when a host knows it was another
 * one (Roadmap f-playback): what `pastOf` folds and judges the past with in
 * place of the store's own. Read only: a store of the past offers no act.
 */
export interface PastDeclaration {
  readonly schema: AnySchema;
  readonly invariants?: readonly InvariantDefinition<AnySchema>[];
  readonly policy?: Policy;
  readonly modules?: ModuleMap;
}

/** A change asked of a store of the past (Roadmap f-playback): the past is read, never changed. */
export class PastError extends GraphError {
  constructor(at: PastPoint) {
    super(`This is the app as it stood${at.at ? ` at ${at.at}` : " at the start"}: the past is read, never changed`);
    this.name = "PastError";
  }
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
   * WHAT THE CHANGE WAS BASED ON, AND HOW SURE ITS MAKER WAS (FR-172):
   * recorded on each op, checked first (`lineageOf`: a basis of 1–500
   * characters, a confidence from 0 to 1). A confidence below 1 from
   * anyone but a person makes what the change links provisional until a
   * person touches it.
   */
  readonly lineage?: Lineage;
  /**
   * A HOST'S LAST WORD, BY WHAT THE CHANGE WOULD DO. Asked once the calls
   * (or the undo) are compiled and applied, before anything is kept, with
   * the store's own plan of them: no second rehearsal on a copy. Whatever
   * it throws goes on up as it was thrown, and the graph, the log and the
   * subscribers are as if the change was never asked. Returning keeps it.
   */
  readonly admit?: (planned: PlannedChange) => void;
  /**
   * WHAT THE CALLER LAST READ (Roadmap f-collab-text): each field it writes,
   * at the revision it read it at, as a call over the wire says it. A whole
   * value written over a field typed together is merged three ways — what
   * the caller changed in the text it read, carried over what others typed
   * since — rather than written over theirs; a field it names no revision
   * of is diffed against its text now.
   */
  readonly base?: readonly FieldRevision[];
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
  /**
   * The id each call's act minted first, by the call's index — the one an
   * `id` argument names (Roadmap f-1-0-client-ids) — where it minted one:
   * what a client sends with the call, so the server makes the same record.
   */
  readonly minted?: readonly (string | undefined)[];
}

/**
 * WHAT `previewAll` TAKES (FR-56): everything `applyAll` takes — the author
 * it is judged as, the channel, the batch, the gesture's intent and the
 * host's `admit` — and the context the rules are judged in.
 */
export interface PreviewOptions extends ApplyOptions {
  readonly context?: InvariantContext;
}

/**
 * A BATCH AS IT WOULD BE KEPT, AND NOT KEPT (FR-56): `applyAll`'s answer,
 * rehearsed. Its ops are the ones the log would hold — author, channel,
 * sentence, primitives, the seq each would take — save their ids,
 * `preview:<n>`, which the store never mints; `batch` is the one given, or
 * `preview`. `kept` says so to whoever is handed it.
 */
export interface BatchPreview<S extends AnySchema> extends ApplyResult<S> {
  readonly kept: false;
}

/** The batch a preview's ops are under when it was given none: no store mints it. */
export const PREVIEW_BATCH = "preview";

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
  readonly reads?: readonly string[];
  /** Defaults to the ids the primitives write. */
  readonly writes?: readonly string[];
  readonly mutation?: MutationCall | null;
  /** Defaults to the store's clock. */
  readonly at?: string;
  readonly undoes?: string;
  readonly via?: Via;
  /** What it was based on (FR-172), checked as `ApplyOptions.lineage` is. */
  readonly lineage?: Lineage;
}

/** `{ [key]: value }` where the value is said, and nothing where it is not: an optional key left off rather than undefined. */
const given = <K extends string, V>(key: K, value: V | undefined) => (value === undefined ? {} : { [key]: value }) as { readonly [P in K]?: V };

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

/**
 * A violation's identity across judgments: the rule, what it is about, and
 * what it says. A rule that says its line breaks once per record, so with
 * a line it is the rule and the record: the values the line found, which
 * an act that leaves the rule broken may change, are not who it is (FR-159).
 * `shaped` names those rules for a judgment that has no lines yet — the
 * words not fetched, or one that could not be worked out — so a problem is
 * the same problem before the words arrive and after (`shapedRules`).
 */
export function violationKey(v: Violation, shaped?: ReadonlySet<string>): string {
  return `${v.invariant}|${v.subjectId ?? ""}|${v.line || shaped?.has(v.invariant) ? v.label : v.message}`;
}

/** Every rule, as `violationKey` reads its `shaped`: a problem known by its rule, its record and its name. */
/** The derived acts that take a record out or fold it away: riding the making of a kind, they reach only what the principal made (W-201). */
const UNMAKING: ReadonlySet<string> = new Set(["remove", "archive", "unarchive", "merge"]);
const EVERY_RULE = { has: () => true } as unknown as ReadonlySet<string>;

/** The rules that have a shape, by name: what `violationKey` keys by the rule and the record. */
export const shapedRules = (rules: readonly Pick<InvariantDefinition, "name" | "shape">[]): ReadonlySet<string> => new Set(rules.filter((rule) => rule.shape).map((rule) => rule.name));

/**
 * WHAT A CHANGE BROKE AND MENDED: the problems after it that were not
 * before, and those before that are not after, each known by its
 * `violationKey` — a problem judged before the words arrived is the same
 * problem after.
 */
export function problemsMoved(rules: readonly Pick<InvariantDefinition, "name" | "shape">[], before: readonly Violation[], after: readonly Violation[]) {
  const shaped = shapedRules(rules);
  const key = (v: Violation) => violationKey(v, shaped);
  const was = new Set(before.map(key));
  const is = new Set(after.map(key));
  const introduces = after.filter((v) => !was.has(key(v)));
  const resolves = before.filter((v) => !is.has(key(v)));
  if (introduces.length === 0 || resolves.length === 0) return { introduces, resolves };
  /*
   * REWORDED IS NOT MENDED (the ninth walk, W-191). A rule that is a
   * function says its count in its message — "not opened for 22 days" —
   * so the day turning, or an act that leaves it broken, rewords it. The
   * same rule about the same record under the same name, said differently,
   * is the problem it was: paired off one for one, it is neither made nor
   * mended.
   */
  // Who a problem is when its words are set aside: its rule, its record and its name, as a rule with a line is known.
  const who = (v: Violation) => v.subjectId && violationKey(v, EVERY_RULE);
  // Each mended problem's who, until a reworded one is paired off with it (null).
  const left: (string | undefined | null)[] = resolves.map(who);
  return {
    introduces: introduces.filter((v) => {
      const at = who(v) ? left.indexOf(who(v)) : -1;
      return at < 0 || ((left[at] = null), false);
    }),
    resolves: resolves.filter((_, at) => left[at] !== null),
  };
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
  /** The act the name most nearly says, when one does: what a refusal asks "did you mean …?" of. */
  readonly nearest: string | undefined;
  constructor(
    readonly mutation: string,
    registered: readonly string[],
  ) {
    const nearest = nearestAct(mutation, registered);
    super(`Unknown mutation "${mutation}"${nearest ? ` — did you mean "${nearest}"?` : ""}`, `Registered: ${registered.join(", ") || "(none)"}`);
    this.name = "UnknownMutationError";
    this.nearest = nearest;
  }
}

/** The batch each op was in, by op id: what an undo replayed after them reads its targets' batches from. */
const batchesOf = (ops: readonly Operation[]): ReadonlyMap<string, string> => new Map(ops.map((op) => [op.id, op.batch]));

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
  /** The store's own "Keep this link" (FR-172), when the app declared none by that name. */
  private keeper: AnyMutationDefinition<S> | undefined;
  /** "Type text", when the store answers to its own (Roadmap f-collab-text). */
  private typer: AnyMutationDefinition<S> | undefined;
  private readonly invariants: readonly InvariantDefinition<S>[];
  private readonly invariantOptions: EvaluateOptions<S>;
  readonly policy: Policy | undefined;
  /** When edits reach readers (`StoreOptions.publishing`). */
  readonly publishing: Publishing | undefined;
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
  private readonly by: Author | Principal;
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
  /** True of a rehearsal (`previewAll`): what it does is told to nobody. */
  private rehearsing = false;
  /** True of a rehearsal for a suggestion: the actor is held to what a person said, not to the declaration's `tidying`, since a person decides it. */
  private suggesting = false;
  /**
   * The day a host last ticked this store to (FR-176), and the day the clock
   * read when it did: what its rules are judged on, where nothing pins one,
   * until the clock's day moves past the one it was ticked on — a timer
   * that slept through midnight never leaves the store on yesterday.
   */
  private ticked: { readonly day: string; readonly on: string } | undefined;
  /** The app's time zone (`StoreOptions.timeZone`): the day today() reads is the date there. */
  readonly timeZone: string | undefined;
  /** Where this store stands in the past, when it is one (`pastOf`): read, never changed. */
  readonly past: PastPoint | undefined;
  /** How often `pastOf` keeps a point to fold from, in ops (`StoreOptions.pastEvery`). */
  readonly pastEvery: number;
  private readonly listeners = new Set<(diff: GraphDiff<NodeOfSchema<S>>, ops: readonly Operation[]) => void>();

  constructor(options: StoreOptions<S>) {
    this.pastEvery = Math.max(1, options.pastEvery ?? 64);
    this.past = options.past;
    this.schema = options.schema;
    this.invariants = options.invariants ?? [];
    this.invariantOptions = options.invariantOptions ?? {};
    this.timeZone = options.timeZone;
    // A store that knows its app's zone begins on the day there, so the first turn of the day says what it moved.
    if (this.timeZone) this.ticked = { day: isoToday(this.timeZone), on: isoToday(this.timeZone) };
    this.policy = options.policy;
    this.publishing = options.publishing;
    this.by = options.principal ?? HUMAN;
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

    // A store of the past offers no act: not one declared, derived or kept (Roadmap f-playback).
    for (const mutation of options.past ? [] : (options.mutations ?? [])) {
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
    for (const mutation of options.past ? [] : deriveMutations(options.schema, options.mutations ?? [])) {
      this.mutations.set(mutation.name, mutation);
    }
    // "Keep this link" (FR-172): answered by every store, offered by no list. An app's own `keep-link` keeps its name.
    if (!options.past && !this.mutations.has(KEEP_LINK)) {
      this.keeper = keepLinkMutation(options.schema);
      this.mutations.set(KEEP_LINK, this.keeper);
    }

    const horizon = given("horizon", options.horizon);
    const validate = { validate: this.validate };
    if (options.log) {
      // Hydrate: the history as recorded, and the graph as stored — or, with none stored, folded from the history.
      this.log = OperationLog.from(options.log, options.epochs, horizon);
      const last = this.log.lastEpoch();
      this.graph = options.snapshot
        ? Graph.from(options.schema, options.snapshot, validate)
        : this.log.fold(options.schema, { ...validate, ...(last ? { from: last } : {}) });
    } else {
      this.log = OperationLog.from(
        [],
        options.epochs ?? (options.snapshot ? [{ seq: options.horizon ?? 0, base: options.snapshot }] : []),
        horizon,
      );
      this.graph = Graph.from(options.schema, options.snapshot ?? { nodes: [], edges: [] }, validate);
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
    if (options.past) return;
    this.countPastTheLog();
    tellTheWatchOfAStore(this);
  }

  /** Refuses any change to a store of the past (Roadmap f-playback). */
  private stillNow(): void {
    if (this.past) throw new PastError(this.past);
  }

  /** Winds the default op and batch counters past every id the log holds, and past the horizon (FR-23). */
  private countPastTheLog(): void {
    this.countPast(this.log.all());
  }

  /**
   * Winds the default op and batch counters past the ids of `ops`, and past
   * the horizon (FR-23). EVERY PATH THAT TAKES OPS CALLS IT (FR-204): the
   * constructor and `adopt` with the whole log, `receive`, `rebase` and
   * `append` with the ops they took. A store opened on part of a log that
   * received the rest went on minting from where the part ended, and named
   * its next change with an id the rest held: undoing one of the pair
   * undid both, a client dropped the second as already known, and a backup
   * holding both could not be imported.
   */
  private countPast(ops: readonly Operation[]): void {
    const trailing = (value: string): number => {
      const digits = /(\d+)$/.exec(value);
      return digits ? Number(digits[1]) : 0;
    };
    for (const op of ops) {
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
  /**
   * WHERE WHAT THIS STORE SERVES ENDS: the ops before this seq are in what
   * it reads, none after. A store's own is its head (`log.length`), a past
   * (`pastOf(store, seq)`) is `seq`, and a seat's view (`seenBy`) is the
   * seq that seat is served through — the head today. A seat's served state
   * may end before the head, chosen by policy (docs/stability.md, "Served
   * state and the head"), as narrowing; a write is always judged at the
   * head, whatever this says. Read-only: nothing sets it.
   */
  get servedSeq(): number {
    return this.log.length;
  }

  /**
   * HOW FAR READERS ARE SERVED (Roadmap f-publishing-lifecycle): the
   * `publishedThrough` of the last publish that stands, or `undefined`
   * when nothing was ever published. Read from the log, as the modules
   * are, and kept between reads while the log is the one it was read from.
   */
  get publishedSeq(): number | undefined {
    return PUBLISHING.seq?.(this);
  }

  /**
   * "PUBLISH" (Roadmap f-publishing-lifecycle): answered by every store of
   * an app whose readers are served what was published, and that declared
   * no act by the name, once `@graview/core/publishing` is loaded.
   */
  private get publisher(): AnyMutationDefinition<S> | undefined {
    return PUBLISHING.act?.(this, this.mutations) as AnyMutationDefinition<S> | undefined;
  }

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
    this.stillNow();
    const before = this.modules.enabled;
    const after = resolveModules(this.declaredModules, enabled).enabled;
    const off = [...before].filter((name) => !after.has(name));
    const on = [...after].filter((name) => !before.has(name));
    if (off.length === 0 && on.length === 0) return undefined;
    const named = (names: readonly string[]): string =>
      names
        .map((name) => {
          const kinds = this.declaredModules?.[name]?.kinds ?? [];
          return kinds.length > 0 ? kinds.map((kind) => pluralOf(this.schema, kind)).join(", ") : name;
        })
        .join(", ");
    const said = [off.length > 0 ? `Turn off ${named(off)}` : "", on.length > 0 ? `turn on ${named(on)}` : ""].filter(Boolean).join("; ");
    const op: Operation = {
      id: this.nextId(),
      seq: this.log.length,
      batch: options.batch ?? this.mintBatch("batch"),
      author: MODULES_AUTHOR,
      intent: capitalize(said),
      mutation: null,
      primitives: [],
      reads: [],
      writes: [],
      at: this.now(),
      ...given("via", options.via),
      enabledModules: [...after].sort(),
    };
    this.log.append(op);
    this.notify(EMPTY_DIFF as GraphDiff<NodeOfSchema<S>>, [op]);
    return op;
  }

  mutation(name: string): AnyMutationDefinition<S> {
    const found = this.mutations.get(this.spelled(name)) ?? (name === PUBLISH ? this.publisher : undefined);
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

  /**
   * The act a name says, however it spells it: `connect-threat-partOf` is
   * `connect-threat-part-of` (`act-spelling.ts`). A name no act says stays
   * as it was given, to be refused by that name.
   */
  private spelled(name: string): string {
    // "Type text" (Roadmap f-collab-text): answered by every store once `@graview/core/typing` is loaded, and offered by no list.
    if (name === TYPE_TEXT && !this.typer && TYPING.typeText && !this.past && !this.mutations.has(name)) this.mutations.set(name, (this.typer = TYPING.typeText(this)));
    return this.mutations.has(name) ? name : (actSpelledAs(name, this.mutations.keys()) ?? name);
  }

  /** A call with its act's name as the store spells it, so the log and every check read the one name. */
  private spelledCall(call: MutationCall): MutationCall {
    const name = this.spelled(call.name);
    return name === call.name ? call : { ...call, name };
  }

  /** Off by module, or a derived act of a kind the workspace has off. */
  private mutationDisabled(mutation: AnyMutationDefinition<S>): boolean {
    if (this.modules.disabledMutations.has(mutation.name)) return true;
    return mutation.derived !== undefined && this.modules.disabledKinds.has(mutation.derived.kind);
  }

  allMutations(): AnyMutationDefinition<S>[] {
    return [...this.mutations.values(), ...(this.publisher ? [this.publisher] : [])].filter((mutation) => mutation !== this.keeper && mutation !== this.typer && !this.mutationDisabled(mutation));
  }

  /** The declared acts a derived act resolves its permission through; keeping a link, those that make or break its relation. */
  private viaOf(mutation: AnyMutationDefinition<S> | undefined, call?: MutationCall, principal?: Principal): readonly string[] | undefined {
    if (mutation !== undefined && mutation === this.keeper) {
      const declared = keepLinkVia(this.mutations.values(), call?.args["kind"]);
      if (declared.length > 0) return declared;
      // A relation only its derived connect and disconnect make or break: kept by whoever those are permitted to.
      const all = [...this.mutations.values()];
      return [...new Set(all.filter((one) => one.derived?.relation === call?.args["kind"]).flatMap((one) => derivedVia(this.schema, all, one) ?? []))];
    }
    // Typing into a field: whoever may run an act that writes that field of that record.
    if (mutation !== undefined && mutation === this.typer) {
      // Through an act that could run on this record now: its module on, its own rule holding for the record as this principal is served it.
      const node = call?.args["node"];
      const served = principal === undefined || isSystem(principal) ? this.graph : seenBy(this, principal).graph;
      const allows = (writer: AnyMutationDefinition<S>) => !this.mutationDisabled(writer) && (writer.allowedOn === undefined || (typeof node === "string" && writer.allowedOn(served as never, node)));
      return TYPING.via!(this.schema, [...this.mutations.values()] as never, this.subjectKindOf(call!, principal), call?.args["field"], allows as never);
    }
    if (!mutation?.derived) return undefined;
    return derivedVia(this.schema, [...this.mutations.values()], mutation);
  }

  /** What a change broke and mended, by this store's rules (`problemsMoved`). */
  private moved(before: readonly Violation[], after: readonly Violation[]) {
    return problemsMoved(this.allInvariants(), before, after);
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
    call = this.spelledCall(call);
    /*
     * The same answer `apply` would give. A declared agent's `may` narrows
     * it before the policy does; asked without it, the chat offered a
     * repair as the starter seat, which may only add, and the press met
     * "starter may not take-off here" (W-110).
     */
    // The app as it was is read, never changed (Roadmap f-playback): a control asking says so rather than offering a press.
    if (this.past) return { ok: false, refusal: { mutation: call.name, wouldNeed: [], message: "Nothing changes while you look back." } } as ReturnType<typeof permits>;
    const narrowed = this.refusesAgent(call, principal) ?? this.namesTurnedOff(call, principal);
    if (narrowed) return { ok: false, refusal: narrowed } as ReturnType<typeof permits>;
    const mutation = this.mutations.get(call.name) ?? (call.name === PUBLISH ? this.publisher : undefined);
    // Publishing is the declaration's `publishers`, not a grant's.
    if (mutation && mutation === this.publisher) return PUBLISHING.verdict!(this, principal) as ReturnType<typeof permits>;
    /*
     * KEEPING A LINK ONLY THE DERIVED ACTS MAKE is judged as they are: on
     * the record it leaves, so riding everybody's grant it reaches only the
     * links of records this principal made (W-201). A link a declared act
     * makes or breaks is that act's, which carries no such rule.
     */
    const keeping = mutation !== undefined && mutation === this.keeper && keepLinkVia(this.mutations.values(), call.args["kind"]).length === 0;
    const id = keeping ? call.args["from"] : mutation?.subject && call.args[mutation.subject.arg];
    /*
     * An own-end grant holds the records the call names at the far end of
     * what it links, and every link the act would make or break: a connect
     * on a relation of one breaks the link that was there, which no argument
     * names. A call that cannot be compiled is refused by `apply`, in its
     * own words.
     */
    const kind = this.subjectKindOf(call, principal);
    const verdict = permits(
      this.policy,
      principal,
      call.name,
      kind,
      this.viaOf(mutation, call, principal),
      typeof id === "string" ? id : undefined,
      this.words,
      () => {
        const me = actingAs(principal).id;
        const far = this.namedIn(call, false);
        try {
          for (const one of compileMutation(this.graph, mutation!, call.args, this.sighted(principal)).primitives) if ("edge" in one && one.edge.from !== me && one.edge.to !== me) far.push(one.edge.to);
        } catch {
          // Refused by `apply`.
        }
        return far;
      },
      // Who made the record a derived act is about: riding only everybody's grant, it reaches what this principal made (W-201).
      mutation !== undefined && (mutation.derived !== undefined || mutation === this.typer || keeping) ? () => this.madeBy(mutation, call, id) : undefined,
      // Taking a record out, or folding it away, rides the making of the kind only over what this principal made (W-201).
      mutation?.derived !== undefined && UNMAKING.has(mutation.derived.act),
    );
    if (!verdict.ok || !mutation?.derived || !this.repeatMakes(mutation, call, id, principal)) return verdict;
    /*
     * AND A CHANGE TO ONE DAY THAT MAKES A RECORD ("change just this one",
     * "change from here" past the first day) rides the kind's edit for the
     * series, and the making of the kind for the record it makes: who may
     * retitle a shift has not been trusted with making one.
     */
    return permits(this.policy, principal, call.name, kind, removeVia([...this.mutations.values()], mutation.derived.kind), typeof id === "string" ? id : undefined, this.words);
  }

  /** Whether a call of a repeat act makes a record (`repeatMakes`), read off the series as this principal is served it. */
  private repeatMakes(mutation: AnyMutationDefinition<S>, call: MutationCall, id: unknown, principal: Principal): boolean {
    const act = mutation.derived!.act;
    if (act !== "detach" && act !== "split") return false;
    const definition = this.schema.tryDefinition(mutation.derived!.kind);
    if (!definition) return false;
    const node = typeof id === "string" ? (isSystem(principal) ? this.graph : seenBy(this, principal).graph).getNode(id) : undefined;
    return repeatMakes(act, call.args, node as Record<string, unknown> | undefined, repeatingFields(definition as never));
  }

  /**
   * WHO MADE WHAT A DERIVED ACT CHANGES (W-201): its subject — and, for a
   * merge, the record it folds into too, which takes every tie of the one
   * folded away. Both are to be one principal's for the merge to be theirs;
   * asked before that one is chosen, the subject alone.
   */
  private madeBy(mutation: AnyMutationDefinition<S>, call: MutationCall, id: unknown): string | undefined {
    const records = recordsOf(this.log);
    const by = records.creatorOf(id as string);
    const into = call.args["into"];
    if (mutation.derived?.act === "merge" && typeof into === "string" && records.creatorOf(into) !== by) return undefined;
    return by;
  }

  /** The ids a call names in its record arguments: its subject's too, unless `subject` is false (the far ends of what it links). */
  private namedIn(call: MutationCall, subject = true): string[] {
    const mutation = this.mutations.get(call.name);
    if (!mutation) return [];
    const at = mutation.subject?.arg;
    const values = [...(subject && at ? [call.args[at]] : []), ...nodeRefArgs(mutation.input).flatMap((ref) => (ref.name === at ? [] : [call.args[ref.name]]))];
    return values.flat().filter((value): value is string => typeof value === "string");
  }

  /** A refusal told to the watch — unless the store is rehearsing — and thrown. */
  private refuse(refusal: Refusal, by: string | undefined, told = !this.rehearsing): never {
    if (told) tellTheWatchOfARefusal(refusal, by);
    throw new PermissionDeniedError(refusal);
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
    if (!mutation || !this.namedIn(call).some((id) => off.has(this.graph.getNode(id)?.kind as string))) return undefined;
    return {
      mutation: call.name,
      message: `“${mutation.title ?? call.name}” names a record of a module this workspace has turned off.`,
      wouldNeed: [],
    };
  }

  /**
   * AN ACT RUNS UNDER ITS AUTHOR'S SIGHT (FR-55). Its body, its guard, its
   * refusal and its sentence read the store as the author is served it,
   * so a record the author may not see is to the act what one that does
   * not exist is: a condition that would count it does not, a refusal
   * that would quote it cannot, and a seat learns nothing from whether,
   * how or in what words its act ran. What it writes lands on the whole
   * store. A rule that must hold across what a seat may not see is an
   * invariant's to judge, not an act's. With nothing kept from the author,
   * the store's own graph.
   */
  private sighted(author: Principal | undefined): NonNullable<Parameters<typeof compileMutation<S>>[3]> {
    // Who `$me` is: the person, for an agent acting for one (Roadmap f-act-as-me).
    const me = { me: author && actingAs(author).id };
    if (author === undefined || !hidesFrom(this, author)) return me;
    // And a seat that writes a value naming what it may not see has written its own words, though the store held them already.
    const hidden = seesId(this, author);
    return { ...me, seen: seenBy(this, author).graph as never, keepUnchanged: (value: unknown) => namesUnseen(value, hidden), seesInFull: seesEveryRecord(this as never, author) };
  }

  /**
   * WHETHER ONE FIELD OF A RECORD IS TYPED TOGETHER (Roadmap f-collab-text),
   * read off the declaration of the record's kind, never off its value:
   * `isCollaborativeField`. False for a record that is not here.
   */
  collaborative(node: string, field: string): boolean {
    return TYPING.collaborative?.(this.schema, this.graph.getNode(node)?.kind as string | undefined, field) ?? false;
  }

  /** A whole value written over text typed together, as a splice, where `@graview/core/typing` is loaded; as written otherwise. */
  private asSplices(primitives: readonly Primitive[], base?: readonly FieldRevision[]): readonly Primitive[] {
    return TYPING.asSplices ? TYPING.asSplices(this, primitives, base) : primitives;
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
    call = this.spelledCall(call);
    const mutation = this.mutations.get(call.name);
    const named = new Set(this.namedIn(call));
    if (!mutation || named.size === 0) return undefined;
    // Served, not only in sight: a record withheld whole for a field it cannot do without is not there for this seat either.
    const seen = seenBy(this, principal).graph;
    for (const id of named) {
      if (seen.has(id)) continue;
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
      return !!mutation && subjectKinds(mutation).some((kind) => permits(this.policy, principal, name, kind, this.viaOf(mutation)).ok);
    });
  }

  /**
   * The app as this seat is served it: its graph, log, history and problems
   * hold only what the policy's `sees` lets the seat see, through the seq it
   * is served (`servedSeq`), and every act still comes here, judged at the
   * head. A reader of an `on-publish` app is served what was published; a
   * collaborator the head, or — `{ as: "published" }` — what readers are
   * served, to preview it. With no `sees` and nothing held back, this store
   * itself (see `seen.ts`). Nothing promises it is the head, nor that one
   * principal has one view.
   */
  seenBy(principal: Principal, options?: SeenOptions): Store<S> {
    return seenBy(this, principal, options);
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
    // A name is a live record's when one has it, and an archived one's only when none does (FR-173).
    const live = (ids: readonly string[]): readonly string[] => {
      const kept = ids.filter((id) => !this.graph.isArchived(id));
      return kept.length ? kept : ids;
    };
    const exact = live(found.exact.filter(visible));
    const exactly = exact.length > 0;
    const candidates: RefCandidate[] = (exactly ? exact : live(found.prefix.filter(visible)))
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
      // A sight that shows only some fields shows nothing until they can be judged, as `sees` says (Roadmap f-field-sight).
      const judged = fieldsJudged(this);
      // Every kind: once a policy says who sees what, a kind no sight names is seen by nobody.
      for (const kind of this.schema.kinds as readonly string[]) {
        const seeing = sights.some((sight) => sight.kinds.includes(kind) && grantsTo(sight, principal) && ((!sight.own && !sight.via) || principal.id !== undefined) && (judged || !partialSight(sight)));
        if (!seeing && !creatable.has(kind)) kept.add(kind);
      }
    }
    return kept;
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
      all.filter((mutation) => !mutation.derived && mutation !== this.publisher),
    );
    // Publishing is offered to the declaration's publishers (Roadmap f-publishing-lifecycle).
    const publishing = this.publisher && PUBLISHING.verdict!(this, principal).ok ? [this.publisher] : [];
    // A derived act is offered when the kind's own acts it rides are.
    const derived = all.filter(
      (mutation) =>
        mutation.derived !== undefined &&
        permits(this.policy, principal, mutation.name, mutation.derived.kind, this.viaOf(mutation), actingAs(principal).id).ok,
    );
    return [...declared, ...publishing, ...derived];
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
    /*
     * A record the principal is not served is judged as one that is not
     * there: its kind is not the policy's to read aloud (FR-55). Served,
     * not only in sight, as `missingFor` reads it: a record withheld whole
     * for a field it cannot do without answered a grant drawn by kind as
     * its kind, and an absent id as no kind, so the refusal told the two
     * apart.
     */
    if (!isSystem(principal) && !seenBy(this, principal).graph.has(id)) return undefined;
    return this.graph.getNode(id)?.kind as string | undefined;
  }

  /**
   * THE DAY THIS STORE'S RULES ARE JUDGED ON (YYYY-MM-DD): `invariantOptions`'
   * `today`, else its context's `today`, else the day a host ticked it to,
   * else the date in its `timeZone` when it knows the app's, else undefined
   * — the real clock. What a seat reads "this week" and "overdue" against,
   * so an app pinned to a day (a test, a demo, a replay) is asked about
   * that day, and an app in New York about New York's.
   */
  today(): string | undefined {
    return this.pinned() ?? (this.ticked && this.ticked.on === isoToday(this.timeZone) ? this.ticked.day : undefined) ?? (this.timeZone ? isoToday(this.timeZone) : undefined);
  }

  /** The day `invariantOptions` pins, if it pins one: a tick does not move it. */
  private pinned(): string | undefined {
    const context = this.invariantOptions.context as { readonly today?: unknown } | undefined;
    const pinned = this.invariantOptions.today ?? context?.today;
    return typeof pinned === "string" && /^\d{4}-\d{2}-\d{2}$/.test(pinned) ? pinned : undefined;
  }

  /** What every judgment is handed: the store's options, a call's context, and the day it judges on. */
  private judging(context?: InvariantContext): EvaluateOptions<S> {
    const today = this.today();
    // A rule that walks a link to another app reads it as the viewer this graph is read for (FR-171), unless the call hands its own reader.
    const linked = linkedReaderOf(this.graph);
    const given = context ?? this.invariantOptions.context;
    const linking = linked && !(given && "linked" in given) ? { ...given, linked } : context;
    // A rule written as a function reads the day from its context too, as `openStore` handed it (W-186): the app's, where the store knows its zone and the call hands no context of its own.
    const base = linking ?? given;
    const judged = this.timeZone && today !== undefined && context === undefined && !(base && "today" in base) ? { ...base, today } : linking;
    return { ...this.invariantOptions, ...(judged === undefined ? {} : { context: judged }), ...(today === undefined ? {} : { today }) };
  }

  /**
   * THE DAY TURNED (FR-176). Rules are judged on every change and once on
   * load; one that reads the clock — "overdue", "due this week" — is broken
   * or mended by the day turning with nothing changed, and a room that stays
   * open for weeks would go on saying the day it last heard a change. A host
   * calls this when the day turns (`tickEachDay` does, just after each
   * midnight by the clock `today()` reads; `@graview/ship`'s `openStore`
   * and `openRemote` start it): from now on the store's rules are judged on
   * `now`'s day (in the store's `timeZone`, else UTC, as `today()` reads
   * the clock; or a day given as
   * `YYYY-MM-DD`), and the answer is the problems that appeared and cleared
   * with it. Which rules those can be is the declaration's to say
   * (`clockReaders` on `@graview/core/check`, which `graview check` reads);
   * the store judges every rule on the day before and the day after, once
   * a day, and so needs no list. Every subscriber hears the day turn, with
   * an empty diff and no ops, so the bar, the problems page and a count
   * read again. Nothing is written or logged. A store whose day is pinned
   * (`invariantOptions.today`) is judged on that day still, and answers
   * that nothing moved.
   */
  tick(now: Date | string | number = new Date()): Tick {
    const pinned = this.pinned();
    if (pinned !== undefined) return { day: pinned, was: pinned, appeared: [], cleared: [] };
    const day = dayOf(now, this.timeZone);
    const on = isoToday(this.timeZone);
    // What stood is judged on the day the store was last ticked to, even when the clock has just left it: the turn at midnight says what it moved.
    if (this.ticked) this.ticked = { day: this.ticked.day, on };
    const was = this.today();
    const before = this.violations();
    this.ticked = { day, on };
    const moved = this.moved(before, this.violations());
    if (day !== was && !this.rehearsing && this.quiet === 0) for (const listener of this.listeners) listener(EMPTY_DIFF as GraphDiff<NodeOfSchema<S>>, []);
    return { day, ...(was === undefined ? {} : { was }), appeared: moved.introduces, cleared: moved.resolves };
  }

  /**
   * SOMETHING READ BESIDE THE GRAPH ANSWERED (FR-171): a record in another
   * app that a computed field, a rule or a label walks to has been read, or
   * read again. Nothing here changed, and nothing is written or logged;
   * every subscriber hears it, as they hear the day turn, with an empty
   * diff and no ops, so what reads through the link reads again.
   */
  reread(): void {
    if (this.rehearsing || this.quiet > 0) return;
    for (const listener of this.listeners) listener(EMPTY_DIFF as GraphDiff<NodeOfSchema<S>>, []);
  }

  /**
   * Current violations, evaluated fresh — nothing is cached or stale. `over`
   * judges them over another reading of this graph: a seat's (FR-55).
   */
  violations(context?: InvariantContext, over: Graph<S> = this.graph): Violation[] {
    return evaluate(over, this.allInvariants(), this.judging(context)).map((violation) => this.asking(violation));
  }

  /*
   * A REPAIR SAYS WHAT IT STILL ASKS FOR (the twelfth walk). A rule written
   * in code names an act and the arguments it knows, and need not list the
   * rest: what the act's input requires and the repair does not give is
   * `missing`, so no surface offers it as one press and meets the act's own
   * refusal on it. What a rule did say is kept.
   */
  private readonly required = new Map<string, readonly string[]>();
  private asking(violation: Violation): Violation {
    if (!violation.repairs.some((repair) => repair.missing === undefined)) return violation;
    let changed = false;
    const repairs = violation.repairs.map((repair) => {
      if (repair.missing !== undefined) return repair;
      const missing = this.requiredOf(repair.mutation).filter((name) => repair.args?.[name] === undefined);
      if (missing.length === 0) return repair;
      changed = true;
      return { ...repair, missing };
    });
    return changed ? { ...violation, repairs } : violation;
  }
  private requiredOf(name: string): readonly string[] {
    const known = this.required.get(name);
    if (known) return known;
    const shape = (this.mutations.get(name)?.input as { shape?: Record<string, { safeParse?(value: unknown): { success: boolean } }> } | undefined)?.shape ?? {};
    const required = Object.entries(shape)
      .filter(([, field]) => typeof field?.safeParse === "function" && !field.safeParse(undefined).success)
      .map(([key]) => key);
    this.required.set(name, required);
    return required;
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
  wouldChange(call: MutationCall, author?: Principal): boolean {
    try {
      return compileMutation(this.graph, this.mutation(call.name), call.args, this.sighted(author)).primitives.length > 0;
    } catch {
      // An act that cannot even compile is not one that changes nothing; let
      // whoever asked find out the honest way.
      return true;
    }
  }

  preview(call: MutationCall, context?: InvariantContext, options: { readonly author?: Principal } = {}): Preview<S> {
    call = this.spelledCall(call);
    const definition = this.mutation(call.name);
    const compiled = compileMutation(this.graph, definition, call.args, this.sighted(options.author));
    return this.previewPrimitives(this.asSplices(compiled.primitives), {
      reads: compiled.reads,
      writes: compiled.writes,
      intent: compiled.intent,
      context,
    });
  }

  /**
   * WHAT SEVERAL CALLS WOULD DO AS ONE GESTURE, JUDGED AS IT WOULD BE, WITHOUT
   * DOING ANY OF IT (FR-18, FR-56).
   *
   * Not a second path beside `applyAll` but `applyAll`'s own, run on a
   * rehearsal of this store — its graph and its log copied, nobody
   * listening — so it cannot drift from it: it refuses exactly when the
   * apply would, in the same words, for the same author, channel and batch
   * — the policy, the seat's sight (a record the batch made earlier is its
   * maker's for the calls after, read off the rehearsal's log as it goes),
   * a declared agent's `may`, an act's own guard, and whatever `admit`
   * throws, asked with the change as planned. Otherwise it answers what the
   * apply would: the ops as the log would hold them, marked not kept (ids
   * `preview:<n>`, `kept: false`), the net diff, and the problems after,
   * judged in `context`. Nothing is written, logged, told to a subscriber
   * of the store or its graph, or told to a watching harness; no id or
   * batch this store would mint next is spent.
   *
   * Why not `applyAll(calls, { dryRun: true })`: a host wraps `applyAll` —
   * `openRemote` sends every call down the wire — and a flag on it would
   * travel with the call; and an answer that says `kept: false` in its type
   * cannot be mistaken for one that was.
   */
  previewAll(calls: readonly MutationCall[], options: PreviewOptions = {}): BatchPreview<S> {
    const { context, ...applying } = options;
    const result = this.rehearsal().applying(calls, applying, context);
    return { ...result, kept: false };
  }

  /**
   * THIS STORE, TO REHEARSE ON (FR-56): its declaration, policy, modules and
   * clock as they are, its graph and log copied, and nobody listening. Its
   * op ids are `preview:<n>` and its batch `preview`, so nothing this store
   * would mint next is spent; it tells a watching harness nothing.
   */
  private rehearsal(): Store<S> {
    const twin = Object.assign(Object.create(Store.prototype) as Store<S>, this);
    let made = 0;
    Object.assign(twin as unknown as Record<string, unknown>, {
      graph: Graph.from(this.schema, this.graph.snapshot(), { validate: this.validate }),
      log: OperationLog.from(this.log.all(), this.log.epochs(), { horizon: this.log.horizon }),
      listeners: new Set(),
      labels: undefined,
      nextId: () => `${PREVIEW_BATCH}:${++made}`,
      mintBatch: () => PREVIEW_BATCH,
      rehearsing: true,
    });
    // Its own acts, so "Type text" reads the text back off the rehearsal's log, as the apply would off this one's.
    const typer = this.typer && TYPING.typeText!(twin);
    Object.assign(twin as unknown as Record<string, unknown>, { typer, mutations: typer ? new Map(this.mutations).set(TYPE_TEXT, typer) : new Map(this.mutations) });
    return twin;
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
    const after = evaluate(trial, this.allInvariants(), this.judging(meta.context));

    return {
      diff,
      primitives,
      reads: meta.reads,
      writes: meta.writes,
      intent: meta.intent,
      ...this.moved(before, after),
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
  private applying(asked: readonly MutationCall[], options: ApplyOptions, context?: InvariantContext): ApplyResult<S> {
    // Each act by the name the store gives it, however the call spelled it.
    const calls = asked.map((call) => this.spelledCall(call));
    this.stillNow();
    const batch = options.batch ?? this.mintBatch("batch");
    const author = options.author ?? this.by;
    const lineage = lineageOf(options.lineage);
    const ops: Operation[] = [];
    const allPrimitives: Primitive[] = [];
    const reads = new Set<string>();
    const writes = new Set<string>();
    const intents: string[] = [];

    const before = this.violations(context);
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
    const permitted = (call: MutationCall) => {
      const verdict = this.policy || (this.publisher && call.name === PUBLISH) ? this.permits(call, author as Principal) : undefined;
      if (verdict && !verdict.ok) this.refuse(verdict.refusal, author.id);
    };
    const declared = (call: MutationCall) => {
      const refusal = this.refusesAgent(call, author) ?? this.namesTurnedOff(call, author as Principal);
      if (refusal) this.refuse(refusal, author.id);
    };
    /* A call that names a record an earlier call makes (`{ $made: n }`, FR-193) is asked once that record is there to name. */
    const naming = calls.map(namesMade);
    calls.forEach((call, at) => naming[at] || permitted(call));
    calls.forEach((call, at) => naming[at] || declared(call));
    /*
     * THE APP'S OWN ACTOR IS HELD TO WHAT PEOPLE SAID: a change a person
     * declined is not made again, a record a person said to leave alone is
     * not changed, and what the declaration says is never tidied is not
     * tidied on its own (`@graview/core/tidying`). Each refused in a
     * sentence, and the whole gesture with it.
     */
    const automated = isAutomated(author);
    if (automated) this.refuseDeclined(calls, author);
    if (!this.rehearsing) tellTheWatchOfAnAuthor(author.id);

    /* The first record each call made, for a later call that names it (FR-193). */
    const madeIds: (string | undefined)[] = [];
    const minted: (string | undefined)[] = [];
    /*
     * A CLIENT'S OWN ID, A HINT (Roadmap f-1-0-client-ids). A call it applied
     * first says the id it minted there (`mintedHint`); the record is made
     * under it when it is free, and minted as ever when somebody holds it —
     * and a later call of this change naming the hint names the record made.
     */
    const renamed = new Map<string, string>();
    const rename = (value: unknown): unknown => (typeof value === "string" ? (renamed.get(value) ?? value) : Array.isArray(value) ? value.map(rename) : value);
    try {
      for (const [at, sent] of calls.entries()) {
        const { mintedHint: hint, ...plain } = sent;
        const asked = renamed.size ? { ...plain, args: Object.fromEntries(Object.entries(plain.args).map(([key, value]) => [key, rename(value)])) } : plain;
        const call = naming[at] ? resolveMade(asked, madeIds, at) : asked;
        if (naming[at]) (permitted(call), declared(call));
        const definition = this.mutation(call.name);
        if (definition === this.publisher) {
          const op = PUBLISHING.op!(this, { id: this.nextId(), at: this.now() }, call, batch, author as Principal, options);
          ops.push(op);
          intents.push(op.intent);
          continue;
        }
        const missing = this.missingFor(call, author as Principal);
        if (missing) throw missing;
        let compiled: ReturnType<typeof compileMutation>;
        try {
          compiled = compileMutation(this.graph, definition, call.args, { ...this.sighted(author as Principal), hint });
        } catch (error) {
          // A press the act's own input refused: the watch tells a form filled wrongly from an act offered whole.
          if (error instanceof InvalidArguments && !this.rehearsing) tellTheWatchOfAnInputRefusal(error, author.id);
          throw error;
        }
        if (hint !== undefined && compiled.firstMinted !== undefined && compiled.firstMinted !== hint) renamed.set(hint, compiled.firstMinted);
        if (automated) {
          const refused = tidyingRefusal(this.schema, this.graph, compiled.primitives, this.authorName(author), { declaration: !this.suggesting });
          if (refused) this.refuse({ mutation: call.name, message: refused, wouldNeed: [] }, author.id);
        }
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
        minted[at] = compiled.firstMinted;
        madeIds[at] =compiled.primitives.find((primitive): primitive is Extract<Primitive, { op: "add-node" }> => primitive.op === "add-node")?.node.id;
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
          ...given("batchIntent", options.intent),
          mutation: call,
          /*
           * NORMALIZED on the way into the record: a patch that clears a
           * field says so with a value rather than with an absence, or the
           * instruction is lost the moment the op is written to JSON and the
           * inverse quietly does nothing. See `normalize` in primitives.ts.
           */
          primitives: this.asSplices(compiled.primitives, options.base).map(normalize),
          reads: compiled.reads,
          writes: compiled.writes,
          // Which records its sentence read, so a reader who may not see one is not handed the sentence (FR-55).
          ...(definition.describe !== undefined && compiled.described && compiled.described.length > 0 ? { described: compiled.described } : {}),
          ...given("mergedInto", compiled.mergedInto),
          at: this.now(),
          ...given("via", options.via),
          ...given("lineage", lineage),
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
      throw error;
    }

    // What the act touched, never the whole graph again (W-205).
    const diff = diffTouched(rollback, this.graph.snapshot(), allPrimitives);
    this.admitted(options, ops, allPrimitives, diff, rollback, kept);
    const after = this.violations(context);
    this.notify(diff, ops);

    return {
      batch,
      ops,
      ...(minted.length > 0 ? { minted } : {}),
      diff,
      primitives: allPrimitives,
      reads: [...reads],
      writes: [...writes],
      intent: options.intent ?? intents.join("; "),
      ...this.moved(before, after),
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
   * about a local change. Undo still works on it, because an op's
   * primitives say what puts it back (`inverseOf`); one from a format-1
   * sender, inverse and all, lands as format 2.
   *
   * Ops already in the log are skipped by id, so receiving the same batch
   * twice — a poll that overlaps, a reconnect — is not a second change.
   *
   * `seq` is the position in THIS log and is renumbered on the way in; the
   * op keeps everything that identifies it (its id, its author, its intent
   * and its primitives). A log is contiguous by construction —
   * that is what makes undo and replay work — and an incoming op carries
   * the sender's numbering, which cannot be this one's the moment this
   * store has applied anything of its own. Whoever is tracking the sender's
   * sequence must keep it themselves; `openRemote` does.
   */
  receive(ops: readonly Operation[], options: { readonly applied?: boolean } = {}): readonly Operation[] {
    this.stillNow();
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
      const here = bareOp({ ...op, seq: seq + index });
      this.log.append(here);
      landed.push(here);
    }
    this.countPast(landed);
    this.notify(diffTouched(before, this.graph.snapshot(), fresh.flatMap((op) => op.primitives)), landed);
    return landed;
  }

  /**
   * OPS A HOST MADE, landed as ordinary history (FR-18): a template's
   * example content, a seeded beginning, a repair or an import the host
   * built itself. Unlike `receive`, which takes ops somebody else's store
   * already made and skips the ones it has, these are new here, so the
   * store fills in what the host left out the way it fills its own: the
   * seq, an id, one batch for the call (`options.batch`, else a fresh one),
   * the time, what they write, and no
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
    this.stillNow();
    if (ops.length === 0) return [];
    const taken = new Set(this.log.all().map((op) => op.id));
    let batch: string | undefined;
    const built: Operation[] = ops.map((made, index) => {
      const primitives = made.primitives.map(normalize);
      const op: Operation = {
        id: made.id ?? this.nextId(),
        seq: this.log.length + index,
        batch: made.batch ?? options.batch ?? (batch ??= this.mintBatch("batch")),
        author: made.author,
        intent: made.intent,
        ...given("batchIntent", made.batchIntent),
        mutation: made.mutation ?? null,
        primitives,
        reads: made.reads ?? [],
        writes: made.writes ?? [...new Set(primitives.flatMap(writesOf))],
        at: made.at ?? this.now(),
        ...given("undoes", made.undoes),
        ...given("via", made.via),
        ...given("lineage", lineageOf(made.lineage)),
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
    // An id or batch the host named is the log's now: the next one minted counts past it (FR-204).
    this.countPast(built);
    for (const op of built) tellTheWatchOfAnAuthor(op.author.id);
    this.notify(diffTouched(before, this.graph.snapshot(), built.flatMap((op) => op.primitives)), built);
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
    this.stillNow();
    const batch = options.batch ?? this.mintBatch("batch");
    const author = options.author ?? this.by;
    const before = this.violations();
    const rollback = this.graph.snapshot();
    const intent = options.intent ?? "Apply a change";
    const lineage = lineageOf(options.lineage);
    const recorded = this.asSplices(primitives, options.base).map(normalize);
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
        reads: [],
        writes: [...new Set(recorded.flatMap(writesOf))],
        at: this.now(),
        ...given("via", options.via),
        ...given("lineage", lineage),
      };
      this.graph.applyPrimitives(op.primitives);
      this.log.append(op);
      ops.push(op);
      tellTheWatchOfAnAuthor(author.id);
    }
    const after = this.violations();
    const diff = diffTouched(rollback, this.graph.snapshot(), recorded);
    this.notify(diff, ops);
    return {
      batch,
      ops,
      diff,
      primitives: recorded,
      reads: [],
      writes: ops[0]?.writes ?? [],
      intent,
      ...this.moved(before, after),
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
    const primitives = undoPrimitives(check.ops, this.log.all());
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
    this.stillNow();
    const ids = typeof batchIds === "string" ? [batchIds] : batchIds;
    const author = options.author ?? this.by;
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
    const lineage = lineageOf(options.lineage);

    /*
     * Undo is a CHANGE, and it is judged like one.
     *
     * Without this, undo is the way around the policy: a principal who may
     * not reassign a run could take back somebody else's reassignment and
     * arrive at exactly the state they were refused. What you may undo is
     * what you may have done — the mutation each operation ran, judged
     * again now.
     */
    if (this.policy || this.publisher) {
      for (const target of check.ops) {
        /*
         * AN UNDO OF AN UNDO PUTS BACK THE CHANGE IT TOOK BACK, and is judged
         * as that change — redo is one, and let through unasked it put back
         * an act its seat was refused. Undoing that again takes the change
         * back once more, judged as it again: however long the chain, the
         * change at its root.
         */
        const judged = this.rootOf(target);
        const by = actingAs(judged.author as Principal).id;
        if (!judged.mutation) {
          /*
           * A CHANGE NO ACT MADE — an import, a sync, a connection, a host's
           * repair (`applyPrimitives`) — has no act to judge it as, and its
           * author was its authority. It is taken back by the system, by
           * whoever made it, or by a seat the policy grants every act.
           */
          if (this.policy && !isSystem(author as Principal) && by !== actingAs(author as Principal).id && !this.grantsEveryAct(author as Principal)) {
            this.refuse({ mutation: "undo", wouldNeed: [], message: `Not permitted to undo "${target.intent}": no act made it, so only whoever did may take it back.` }, author.id, true);
          }
          continue;
        }
        /*
         * AND AN ACT DONE AS ITS AUTHOR (`$me`, `ctx.me`) IS THEIRS TO TAKE
         * BACK: it wrote their own record where its call never named it, so
         * the same call by another would have done something else. "Vote for
         * it" is everybody's to run, and undoing Ann's was taking back her vote.
         */
        const names = (value: unknown) => JSON.stringify(value).includes(JSON.stringify(by));
        const verdict =
          by !== undefined && by !== actingAs(author as Principal).id && !isSystem(author as Principal) && !names(judged.mutation.args) && names(judged.primitives)
            ? { ok: false as const, refusal: { mutation: judged.mutation.name, wouldNeed: [], message: "it was done as somebody else." } }
            : this.permits(judged.mutation, author as Principal);
        if (!verdict.ok) this.refuse({ ...verdict.refusal, message: `Not permitted to undo "${target.intent}": ${verdict.refusal.message}` }, author.id, true);
      }
    }

    const rollback = this.graph.snapshot();
    const before = this.violations();
    const ops: Operation[] = [];
    const kept = this.log.length;

    for (const { op: target, primitives } of undoneInverses(this.log.all(), check.ops)) {
      const op: Operation = {
        id: this.nextId(),
        seq: this.log.length,
        batch,
        author,
        intent: `Undo: ${target.intent}`,
        ...given("batchIntent", options.intent),
        mutation: null,
        primitives,
        reads: target.reads,
        writes: target.writes,
        at: this.now(),
        undoes: target.id,
        ...given("via", options.via),
        ...given("lineage", lineage),
        // What was declined, kept on the declining (FR-172): "do not make this again".
        ...given("undoneLineage", target.lineage),
      };
      this.graph.applyPrimitives(op.primitives, { restoring: putsBack(target) });
      this.log.append(op);
      ops.push(op);
    }

    const diff = diffTouched(rollback, this.graph.snapshot(), ops.flatMap((op) => [...op.primitives]));
    this.admitted(options, ops, ops.flatMap((op) => [...op.primitives]), diff, rollback, kept);
    const after = this.violations();
    this.notify(diff, ops);

    return {
      batch,
      ops,
      diff,
      primitives: ops.flatMap((op) => [...op.primitives]),
      reads: [...new Set(ops.flatMap((op) => [...op.reads]))],
      writes: [...new Set(ops.flatMap((op) => [...op.writes]))],
      intent: options.intent ?? ops.map((op) => op.intent).join("; "),
      ...this.moved(before, after),
      violationsAfter: after,
    };
  }

  /** The change an undo of an undo puts back: the op at the root of its chain, or the last undo the log still holds of it. */
  private rootOf(op: Operation): Operation {
    let at = op;
    for (let undone = at.undoes === undefined ? undefined : this.log.get(at.undoes); undone !== undefined; undone = at.undoes === undefined ? undefined : this.log.get(at.undoes)) at = undone;
    return at;
  }

  /** Whether the policy grants this principal every act, on every record: what taking back a change no act made asks of anybody but its author. */
  private grantsEveryAct(principal: Principal): boolean {
    const acting = actingAs(principal);
    return (this.policy?.grants ?? []).some((grant) => grantsTo(grant, acting) && grant.mutations === "*" && (grant.kinds === undefined || grant.kinds === "*") && !grant.self && !grant.ownEnd);
  }

  /** An author named as Activity names one, for a sentence that refuses them. */
  private authorName(author: Author | Principal): string {
    return nameOfAuthor(author, { graph: this.graph as never, schema: this.schema });
  }

  // What this app's acts mean, for a decline matched by meaning rather than spelling (`meaningKey`).
  private actMeanings(): ActMeanings {
    return { act: (name) => this.mutations.get(this.spelled(name)) as never, has: (id) => this.graph.has(id) };
  }

  /** A change a person declined is not made or suggested again: refused, in a sentence. */
  private refuseDeclined(calls: readonly MutationCall[], author: Author | Principal): void {
    const declined = declinedIn(this.log.all(), calls, this.actMeanings());
    if (declined) this.refuse({ mutation: calls[0]!.name, message: `${this.authorName(author)} may not make this again: a person declined it on ${declined.at.slice(0, 10)}.`, wouldNeed: [] }, author.id);
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
    this.stillNow();
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
      for (const op of [...tail].reverse()) this.graph.applyPrimitives(inverseOf(op), { restoring: true, inPlace: true });
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
        const here = bareOp({ ...op, seq: this.log.length });
        this.log.append(here);
        known.add(op.id);
        landed.push(here);
      }
      // What is pending is minted afresh below: past every id the server's ops just named (FR-204).
      this.countPast(landed);

      // 3. What is still pending, again, on top: its typing carried over what landed (`@graview/core/typing`).
      const typed = TYPING.carried?.(tail, landed, change.pending);
      const wasIn = batchesOf(tail);
      for (const batch of change.pending) {
        const ops = tail.filter((op) => op.batch === batch);
        if (ops.length === 0) continue;
        try {
          replayed.push(...this.replay(batch, ops, typed?.get(batch), wasIn));
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
    this.stillNow();
    const dropped = new Set(state.drop ?? []);
    const pending = (state.pending ?? []).filter((batch) => !dropped.has(batch));
    const held = this.log.all();
    const before = this.graph.snapshot();
    const was = { ops: [...held], epochs: [...this.log.epochs()], horizon: this.log.horizon };
    const known = new Set(held.map((op) => op.id));
    const tails = new Map(pending.map((batch) => [batch, held.filter((op) => op.batch === batch)]));

    // A log that is not intact is refused here, before the graph moves.
    if (state.log.length > 0) this.log.replace(state.log, state.epochs, given("horizon", state.horizon));
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
          replayed.push(...this.replay(batch, ops, undefined, batchesOf(held)));
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

  /** One pending batch, applied again as it was made: its calls (or the ones its typing is carried to), its undo, or its primitives. */
  private replay(batch: string, ops: readonly Operation[], calls?: readonly MutationCall[], wasIn: ReadonlyMap<string, string> = new Map()): readonly Operation[] {
    const head = ops[0]!;
    const options: ApplyOptions = {
      author: head.author,
      batch,
      ...given("intent", head.batchIntent),
      ...given("via", head.via),
      ...given("lineage", head.lineage),
    };
    if (head.undoes !== undefined) {
      /*
       * An undo of a batch that was pending too was applied again just
       * before it, under the same batch and new op ids: it is that batch
       * the undo takes back (Roadmap f-collab-text: ⌘Z on a run of typing
       * still on its way, carried over what landed meanwhile).
       */
      const targets = ops.map((op) => this.log.get(op.undoes ?? "")?.batch ?? wasIn.get(op.undoes ?? ""));
      const missing = ops.find((_op, index) => targets[index] === undefined || !this.log.all().some((one) => one.batch === targets[index]));
      if (missing) throw new GraphError(`What "${missing.intent}" took back is no longer in the log`);
      return this.undoing([...new Set(targets as string[])], options).ops;
    }
    if (calls) return this.applying(calls, options).ops;
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
   * The checkpoint keeps who made each record behind it (`creators`), the
   * kind of each record removed behind it (`removed`, FR-199) and who wrote
   * each field of its graph that names a record (`writers`), so a store
   * opened on it knows a record's maker, that a field names a record a seat
   * may not see, and a seat's own words, without the archived ops.
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
    // Never past a seq somebody is served at: a reader's past (`pastOf`) folds from the log, so the lowest pin is the furthest it goes.
    // And readers' own (Roadmap f-publishing-lifecycle): what was published — or, before the first publish, where the log begins.
    const readers = onPublish(this.publishing) ? [this.publishedSeq ?? 0] : [];
    const pinned = [...(options.pins ?? []), ...readers].filter((pin) => Number.isInteger(pin));
    if (pinned.length > 0) seq = Math.min(seq, ...pinned);
    seq = Math.min(Math.max(seq, this.log.horizon), this.log.length);
    // Never inside a gesture: back to where the batch it would split began.
    while (seq > this.log.horizon && seq < this.log.length && ops[seq - this.log.horizon]!.batch === ops[seq - 1 - this.log.horizon]!.batch) seq--;
    if (seq <= this.log.horizon) return undefined;
    const verified = this.verify();
    if (!verified.ok) throw new GraphError(`Cannot compact a store that does not verify: ${verified.reason}`);
    // What the store keeps of who made what and what was removed is written here, from the log, never carried over from an epoch.
    const { creators: _creators, removed: _removed, writers: _writers, ...checkpoint } = this.log.checkpointAt(this.schema, seq, { validate: this.validate });
    /*
     * Who made each record behind it, so a store opened on it still knows (an `own` sight reads the log for it);
     * what each record removed behind it was, so a field naming one is still judged as naming it; and who wrote
     * each field naming a record, so a seat is still served its own words past the horizon (FR-55, FR-199).
     */
    const base = new Set(checkpoint.base.nodes.map((node) => node.id));
    const { creators, removed } = behind(this.log, seq, (id) => base.has(id));
    const records = recordsOf(this.log);
    const writers = writersBehind(this.log, seq, checkpoint.base.nodes, (value) => namesUnseen(value, (id) => !base.has(id) && records.kindOf(id) === undefined));
    const kept = (map: object | undefined) => map && Object.keys(map).length > 0;
    return { ...checkpoint, ...(kept(creators) && { creators }), ...(removed && { removed }), ...(kept(writers) && { writers }) };
  }

  /**
   * MOVES THE UNDO HORIZON TO `checkpoint` (FR-23): the ops and epochs
   * before it leave the log, which begins at its seq from now on, and are
   * returned for an adapter to archive. The graph is unchanged and still
   * verifies; undo of anything behind the horizon is refused, naming it.
   * Ship's `opened.compact()` archives first and calls this after.
   */
  compact(checkpoint: Epoch): LogArchive {
    this.stillNow();
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
  /**
   * SEQS SOMEBODY IS SERVED AT, which the horizon never passes: a host
   * passes the seq it serves readers through (a published seq, say), and
   * the checkpoint stops at the lowest of them — `seq` and the days and
   * ops above are each held to it — so `pastOf(store, pin)` still folds
   * from the log. A pin at or behind the horizon leaves nothing to
   * compact; one past the head holds nothing back.
   */
  readonly pins?: readonly number[];
}

