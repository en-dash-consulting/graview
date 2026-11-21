import { isBindingAct, isTouchedField, mintPersonId, PERSON_SEAT, profileOf, seatPersonOf, type AnySchema, type Epoch, type GraviewApp, type LogArchive, type Operation, type PersistenceAdapter } from "@graview/core";
import type { StoredMeta } from "./meta.js";
import type { GraphSnapshot } from "./snapshot.js";

/**
 * A PROFILE'S PERSON, UNDER AN ID OF ITS OWN, IN WHAT A STORE KEEPS.
 *
 * A profile's person is made under an id of its own and tied to its seat by
 * the seat's mark (`PERSON_SEAT`). A store kept by an earlier version holds
 * them under ids it made. This gives each an id of its own and
 * the mark, everywhere the store keeps it: the graph, every link and field
 * that names it, every op (so history still says that person, and undo
 * still takes back what they did), each epoch and checkpoint, and what a
 * compaction archived. A store with none is left as it is, a store run
 * again is left as it is, and a run that stopped part way, run again,
 * finishes with the same ids.
 *
 * `profilePeopleCount` says what a run would change and writes nothing;
 * `migrateProfilePeople` runs it over an adapter; `openStore` runs it on
 * open. A field of another app that links one of these people is renamed
 * by running that app's store with `also`: what the first run says in
 * `linked`.
 */

/** What a store keeps, as a run reads and writes it. */
export interface StoredParts {
  readonly snapshot: GraphSnapshot | null;
  /** The log from its horizon on. */
  readonly log: readonly Operation[];
  readonly epochs: readonly Epoch[];
  /** What a compaction archived, where the adapter keeps one. */
  readonly archive?: LogArchive;
}

/** What a run changes in one store, counted. */
export interface ProfilePeopleCount {
  /** The people given an id of their own. */
  readonly records: number;
  /** The links of the graph with an end renamed. */
  readonly links: number;
  /** The records of the graph with a field that named one. */
  readonly fields: number;
  /** The ops of the log, and of its archive, that named one. */
  readonly ops: number;
  /** The epochs, archived ones among them, that named one. */
  readonly epochs: number;
}

/** A run, done or rehearsed: what it changed, counted, and what another app's links to these people are renamed by. */
export interface ProfilePeopleRun {
  readonly count: ProfilePeopleCount;
  /**
   * WHAT A LINK FROM ANOTHER APP KEEPS, BEFORE AND AFTER: `<kind>:<id>` for
   * each person renamed (`linkedValue`). Hand it as `also` to the run of a
   * store whose relations reach this app. The host's to keep: it is never
   * served to a seat.
   */
  readonly linked: ReadonlyMap<string, string>;
}

/** The fields of an op that name no record: who, when, which batch, the words. */
const NOT_RECORDS = new Set(["id", "seq", "batch", "author", "at", "undoes", "intent", "via"]);

/** An id as an earlier version made a profile's person under. */
const EARLIER = /^[^~]+~[\w-]{1,64}$/;

const NOTHING: ProfilePeopleCount = { records: 0, links: 0, fields: 0, ops: 0, epochs: 0 };

type Node = { readonly id: string; readonly kind: string };

const peopleKinds = (schema: AnySchema): ReadonlySet<string> => new Set(schema.definitions.filter((one) => (one as { readonly people?: boolean }).people).map((one) => one.kind as string));

function* epochNodes(epoch: Epoch): Generator<Node> {
  for (const node of (epoch.base as GraphSnapshot | undefined)?.nodes ?? []) yield node as Node;
  for (const past of epoch.published ?? []) yield* epochNodes(past);
}

/** The person a profile's first act made, as an earlier version made it: no act, one record added, by that profile. */
const madeEarlier = (op: Operation): string | undefined => {
  if (op.mutation !== null || op.primitives.length !== 1 || !profileOf(op.author)) return undefined;
  const [made] = op.primitives;
  return made!.op === "add-node" && made!.node.id === seatPersonOf(op.author) ? made!.node.id : undefined;
};

/** A fresh id for a record of `kind`: fourteen random letters and digits, drawn again while anything holds it. */
function freshId(kind: string, held: ReadonlySet<string>): string {
  const random = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  for (;;) {
    const bytes = new Uint8Array(14);
    if (random?.getRandomValues) random.getRandomValues(bytes);
    else for (let at = 0; at < bytes.length; at++) bytes[at] = Math.floor(Math.random() * 256);
    const id = `${kind}:${[...bytes].map((byte) => (byte % 36).toString(36)).join("")}`;
    if (!held.has(id)) return id;
  }
}

/**
 * WHICH PEOPLE A STORE HOLDS UNDER IDS AN EARLIER VERSION MADE, each to
 * the id it takes and its kind: the one `given` says (a run that stopped
 * part way, or one done before), else a fresh one. A person is a record of
 * a people kind under such an id, or the record a profile's first act made
 * so.
 */
export function profilePeopleRenames(schema: AnySchema, parts: StoredParts, given: Readonly<Record<string, string>> = {}): ReadonlyMap<string, { readonly to: string; readonly kind: string }> {
  const kinds = peopleKinds(schema);
  const found = new Map<string, string>();
  const held = new Set<string>(Object.values(given));
  /* Each seat mark already written, and the record carrying it: a part a run that stopped part way wrote says the id it gave. */
  const marked = new Map<string, Set<string>>();
  /* The batch and profile of the op that made each person, where the log or its archive still holds it. */
  const madeIn = new Map<string, { readonly batch: string; readonly profile: string }>();
  const boundByAct = new Set<string>();
  const seen = (node: Node) => {
    held.add(node.id);
    const seat = (node as Record<string, unknown>)[PERSON_SEAT];
    if (typeof seat === "string") {
      if (seat !== node.id) marked.set(seat, (marked.get(seat) ?? new Set()).add(node.id));
      return;
    }
    if (EARLIER.test(node.id) && kinds.has(node.kind)) found.set(node.id, node.kind);
  };
  for (const node of parts.snapshot?.nodes ?? []) seen(node as Node);
  for (const epoch of [...(parts.archive?.epochs ?? []), ...parts.epochs]) for (const node of epochNodes(epoch)) seen(node);
  for (const op of [...(parts.archive?.ops ?? []), ...parts.log]) {
    const made = madeEarlier(op);
    if (made !== undefined) madeIn.set(made, { batch: op.batch, profile: profileOf(op.author)!.id });
    // The same op, as a run that stopped part way already wrote it: its record renamed and carrying the seat's mark.
    else if (op.mutation === null && op.primitives.length === 1 && profileOf(op.author) && op.primitives[0]!.op === "add-node" && (op.primitives[0]!.node as Record<string, unknown>)[PERSON_SEAT] === seatPersonOf(op.author)) madeIn.set(seatPersonOf(op.author)!, { batch: op.batch, profile: profileOf(op.author)!.id });
    for (const primitive of op.primitives) {
      // A record a binding (an invitation's) put a seat's mark on: never one this run gave.
      if (primitive.op === "patch-node" && Object.hasOwn(primitive.after, PERSON_SEAT)) boundByAct.add(primitive.id);
      if (primitive.op !== "add-node" && primitive.op !== "remove-node") continue;
      held.add(primitive.node.id);
      if (made === primitive.node.id && (primitive.node as Record<string, unknown>)[PERSON_SEAT] === undefined) found.set(made, primitive.node.kind);
      else seen(primitive.node);
    }
  }
  const renames = new Map<string, { to: string; kind: string }>();
  for (const [id, kind] of found) {
    /*
     * What the table kept; else the id this version would have made it
     * under — the one a run that stopped part way already wrote, where a
     * record carries it with this seat's mark, and never a record bound to
     * the seat otherwise (an invitation's) — else a fresh one.
     */
    const making = madeIn.get(id);
    // With no making op to mint from: the one record a stopped run marked for this seat, if no binding marked it; else a fresh id.
    const written = [...(marked.get(id) ?? [])].filter((one) => !boundByAct.has(one));
    const to = given[id] ?? (making ? mintPersonId(kind, making.batch, making.profile, (one) => held.has(one) && marked.get(id)?.has(one) !== true) : written.length === 1 ? written[0]! : freshId(kind, held));
    held.add(to);
    renames.set(id, { to, kind });
  }
  return renames;
}

/** A value with every id renamed — exactly, or inside a key written as JSON (a decline's) — and the same value where nothing was. */
function renamer(renames: ReadonlyMap<string, string>): (input: unknown) => unknown {
  const quoted = [...renames].map(([from, to]) => [JSON.stringify(from), JSON.stringify(to)] as const);
  const word = (text: string): string => {
    const exact = renames.get(text);
    if (exact !== undefined) return exact;
    if (!text.startsWith("≈") && !text.startsWith("{") && !text.startsWith("[")) return text;
    let out = text;
    for (const [from, to] of quoted) if (out.includes(from)) out = out.split(from).join(to);
    return out;
  };
  const value = (input: unknown): unknown => {
    if (typeof input === "string") return word(input);
    if (Array.isArray(input)) {
      let changed = false;
      const out = input.map((one) => {
        const next = value(one);
        if (next !== one) changed = true;
        return next;
      });
      return changed ? out : input;
    }
    if (input !== null && typeof input === "object") {
      let changed = false;
      const out: Record<string, unknown> = {};
      for (const [key, one] of Object.entries(input)) {
        const name = word(key);
        // A seat is no record: its mark is the seat, kept as it is.
        const next = key === PERSON_SEAT ? one : value(one);
        if (name !== key || next !== one) changed = true;
        out[name] = next;
      }
      return changed ? out : input;
    }
    return input;
  };
  return value;
}

interface Renaming {
  /** Old id to new, the people's and `also`'s. */
  readonly ids: ReadonlyMap<string, string>;
  /** The people's own old ids: each record renamed is given its seat's mark. */
  readonly people: ReadonlySet<string>;
  readonly rename: (input: unknown) => unknown;
}

/** A record renamed, carrying its seat's mark where it is one of the people and has none. */
function renamedNode(node: Record<string, unknown>, at: Renaming): Record<string, unknown> {
  const out = at.rename(node) as Record<string, unknown>;
  const id = node["id"];
  if (typeof id !== "string" || !at.people.has(id) || Object.hasOwn(node, PERSON_SEAT)) return out;
  return { ...out, [PERSON_SEAT]: id };
}

function renamedSnapshot(snapshot: GraphSnapshot, at: Renaming, count?: { records: number; links: number; fields: number }): GraphSnapshot {
  let changed = false;
  const nodes = snapshot.nodes.map((node) => {
    const next = renamedNode(node as unknown as Record<string, unknown>, at);
    if (next === (node as unknown)) return node;
    changed = true;
    if (count) {
      if (at.people.has(node.id)) count.records++;
      // Who made or last touched it (`createdBy`, `updatedBy`) is renamed with the rest, and is no field a person wrote.
      if (Object.entries(node).some(([key, one]) => key !== "id" && !isTouchedField(key) && at.rename(one) !== one)) count.fields++;
    }
    return next as unknown as typeof node;
  });
  const edges = snapshot.edges.map((edge) => {
    const next = at.rename(edge) as typeof edge;
    if (next === edge) return edge;
    changed = true;
    if (count) count.links++;
    return next;
  });
  return changed ? { ...snapshot, nodes, edges } : snapshot;
}

function renamedOp(op: Operation, at: Renaming): Operation {
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [key, one] of Object.entries(op)) {
    let next: unknown = one;
    if (key === "primitives") {
      const primitives = (one as Operation["primitives"]).map((primitive) => {
        if (primitive.op !== "add-node" && primitive.op !== "remove-node") return at.rename(primitive) as typeof primitive;
        const node = renamedNode(primitive.node as unknown as Record<string, unknown>, at);
        return node === (primitive.node as unknown) ? primitive : ({ ...primitive, node } as unknown as typeof primitive);
      });
      if (primitives.some((primitive, index) => primitive !== (one as unknown[])[index])) next = primitives;
    } else if (key === "mutation" && isBindingAct((one as Operation["mutation"])?.name)) {
      // Binding names a seat beside its record: the record renamed, the seat kept as it is.
      const mutation = one as NonNullable<Operation["mutation"]>;
      const { seat, ...args } = mutation.args as Record<string, unknown>;
      const renamed = at.rename(args);
      if (renamed !== args) next = { ...mutation, args: { ...(renamed as object), ...(seat !== undefined ? { seat } : {}) } };
    } else if (!NOT_RECORDS.has(key)) next = at.rename(one);
    if (next !== one) changed = true;
    out[key] = next;
  }
  return changed ? (out as unknown as Operation) : op;
}

function renamedEpoch(epoch: Epoch, at: Renaming): Epoch {
  const { base, published, ...rest } = epoch;
  const nextBase = renamedSnapshot(base as GraphSnapshot, at);
  const nextPublished = published?.map((past) => renamedEpoch(past, at));
  const nextRest = at.rename(rest) as typeof rest;
  const changed = nextBase !== (base as GraphSnapshot) || nextRest !== rest || (nextPublished ?? []).some((past, index) => past !== published![index]);
  return changed ? ({ ...nextRest, base: nextBase, ...(nextPublished ? { published: nextPublished } : {}) } as Epoch) : epoch;
}

/**
 * THE RUN OVER WHAT A STORE KEEPS, PURE: each person renamed as `renames`
 * says, each id `also` names renamed as it says (another app's people, as a
 * link here keeps them), and what changed, counted. Nothing is written.
 */
export function renameProfilePeople(
  parts: StoredParts,
  renames: ReadonlyMap<string, { readonly to: string; readonly kind: string }>,
  also: ReadonlyMap<string, string> = new Map(),
): ProfilePeopleRun & { readonly parts: StoredParts } {
  const linked = new Map([...renames].map(([from, { to, kind }]) => [`${kind}:${from}`, `${kind}:${to}`] as const));
  const ids = new Map<string, string>([...also, ...[...renames].map(([from, { to }]) => [from, to] as const)]);
  if (ids.size === 0) return { count: NOTHING, linked, parts };
  const at: Renaming = { ids, people: new Set(renames.keys()), rename: renamer(ids) };
  const graph = { records: 0, links: 0, fields: 0 };
  const snapshot = parts.snapshot && renamedSnapshot(parts.snapshot, at, graph);
  let ops = 0;
  let epochs = 0;
  const op = (one: Operation) => {
    const next = renamedOp(one, at);
    if (next !== one) ops++;
    return next;
  };
  const epoch = (one: Epoch) => {
    const next = renamedEpoch(one, at);
    if (next !== one) epochs++;
    return next;
  };
  const log = parts.log.map(op);
  const archive = parts.archive && { ops: parts.archive.ops.map(op), epochs: parts.archive.epochs.map(epoch) };
  const out: StoredParts = { snapshot, log, epochs: parts.epochs.map(epoch), ...(archive ? { archive } : {}) };
  return { count: { ...graph, ops, epochs }, linked, parts: out };
}

/**
 * WHAT A STORE'S META KEEPS OF A RUN, the host's alone: each person renamed
 * (old id to new), written before anything else so a run that stops part
 * way finishes with the same ids, and whether the run finished.
 */
export interface ProfilePeopleMeta {
  readonly profilePeople?: { readonly renamed: Readonly<Record<string, string>>; readonly done?: true };
}

export interface ProfilePeopleOptions<S extends AnySchema> {
  readonly app: GraviewApp<S>;
  readonly adapter: PersistenceAdapter<string> & {
    loadMeta?(scope: string): StoredMeta | null | Promise<StoredMeta | null>;
    saveMeta?(scope: string, meta: StoredMeta): void | Promise<void>;
  };
  /** The scope; the app's name when unsaid. */
  readonly scope?: string;
  /** Ids of other apps' people as links here keep them, old to new: another run's `linked`. */
  readonly also?: ReadonlyMap<string, string>;
}

async function storedOf<S extends AnySchema>(options: ProfilePeopleOptions<S>, scope: string): Promise<StoredParts> {
  const { adapter } = options;
  const [snapshot, log, epochs, archive] = await Promise.all([adapter.load(scope), adapter.loadLog?.(scope) ?? [], adapter.loadEpochs?.(scope) ?? [], adapter.loadArchive?.(scope)]);
  return { snapshot: snapshot as GraphSnapshot | null, log, epochs, ...(archive ? { archive } : {}) };
}

const metaOf = async <S extends AnySchema>(options: ProfilePeopleOptions<S>, scope: string) => ((await options.adapter.loadMeta?.(scope)) ?? null) as (StoredMeta & ProfilePeopleMeta) | null;

const changedIn = <T>(next: readonly T[], was: readonly T[]): boolean => next.length !== was.length || next.some((one, at) => one !== was[at]);

/**
 * What `linked` says of the people a store already holds renamed, read from
 * what it keeps — each record of a people kind carrying an earlier id as its
 * seat's mark — so it is there however long after the run, with no meta.
 */
function linkedOf(schema: AnySchema, parts: StoredParts, renamed: Readonly<Record<string, string>> = {}): ReadonlyMap<string, string> {
  const people = peopleKinds(schema);
  const linked = new Map<string, string>();
  // A profile's first act, renamed: its one record carries the seat's mark, and was made under the seat before. Never a record an invitation bound.
  for (const op of [...(parts.archive?.ops ?? []), ...parts.log]) {
    if (op.mutation !== null || op.primitives.length !== 1 || !profileOf(op.author)) continue;
    const [made] = op.primitives;
    if (made!.op !== "add-node" || !people.has(made!.node.kind)) continue;
    const was = (made!.node as Record<string, unknown>)[PERSON_SEAT];
    if (typeof was === "string" && was === seatPersonOf(op.author) && was !== made!.node.id && EARLIER.test(was)) linked.set(`${made!.node.kind}:${was}`, `${made!.node.kind}:${made!.node.id}`);
  }
  // And what the store's meta kept, for a person whose making the log no longer holds.
  const kindOf = new Map<string, string>((parts.snapshot?.nodes ?? []).map((node) => [node.id, node.kind] as const));
  for (const [from, to] of Object.entries(renamed)) {
    const kind = kindOf.get(to) ?? (people.size === 1 ? [...people][0] : undefined);
    if (kind !== undefined) linked.set(`${kind}:${from}`, `${kind}:${to}`);
  }
  return linked;
}

/**
 * WHAT A RUN WOULD CHANGE IN ONE STORE, WRITING NOTHING: the people it
 * would rename, and the links, fields, ops and epochs that name them, and
 * what another app's links to them would be renamed by. What a host runs
 * on a copy before it runs `migrateProfilePeople`.
 */
export async function profilePeopleCount<S extends AnySchema>(options: ProfilePeopleOptions<S>): Promise<ProfilePeopleRun> {
  const scope = options.scope ?? options.app.name;
  const meta = await metaOf(options, scope);
  const parts = await storedOf(options, scope);
  const run = renameProfilePeople(parts, profilePeopleRenames(options.app.schema, parts, meta?.profilePeople?.renamed), options.also);
  return { count: run.count, linked: new Map([...linkedOf(options.app.schema, parts, meta?.profilePeople?.renamed), ...run.linked]) };
}

/**
 * RUN IT OVER A STORE'S ADAPTER. What becomes what is kept in the store's
 * meta first; then what a compaction archived, the epochs, the log and the
 * graph are written; then the run is marked done. Run again, it renames
 * what is left to the same ids, and a store marked done is not read again
 * unless `also` asks it to be. Refused, writing nothing, by an adapter that
 * keeps a log or an archive it cannot replace (`replaceLog`,
 * `replaceArchive`). Not for a store that is open: run it before
 * `openStore`, which runs it itself.
 */
export async function migrateProfilePeople<S extends AnySchema>(options: ProfilePeopleOptions<S> & { readonly version?: number }): Promise<ProfilePeopleRun> {
  const scope = options.scope ?? options.app.name;
  const { run } = await profilePeopleOver(options, scope, await metaOf(options, scope));
  return run;
}

/**
 * The run over a store `openStore` has read: its graph, its log (with what a
 * journal put back) and its epochs, as handed, and its archive read only
 * where the run is not marked done. What comes out, and the mark every
 * later write of the store's meta carries (`profilePeople`). `version` is
 * the version a store with no meta stands at, for the meta written; with
 * neither, no meta is written.
 */
export async function profilePeopleOver<S extends AnySchema>(
  options: ProfilePeopleOptions<S> & { readonly version?: number },
  scope: string,
  meta: (StoredMeta & ProfilePeopleMeta) | null,
  loaded?: Omit<StoredParts, "archive">,
): Promise<{ readonly run: ProfilePeopleRun; readonly parts: StoredParts; readonly mark?: ProfilePeopleMeta["profilePeople"]; readonly renamed: (snapshot: GraphSnapshot) => GraphSnapshot }> {
  const { adapter } = options;
  const before = meta?.profilePeople;
  // Nobody to rename: a store whose app has no people, or one marked done, unless another app's links are asked of it.
  if ((before?.done || peopleKinds(options.app.schema).size === 0) && (options.also?.size ?? 0) === 0) {
    const parts = loaded ?? (await storedOf(options, scope));
    return { run: { count: NOTHING, linked: linkedOf(options.app.schema, parts, before?.renamed) }, parts, ...(before ? { mark: before } : {}), renamed: (snapshot) => snapshot };
  }
  const archived = loaded && adapter.loadArchive ? await adapter.loadArchive(scope) : undefined;
  const parts: StoredParts = loaded ? { ...loaded, ...(archived ? { archive: archived } : {}) } : await storedOf(options, scope);
  const renames = profilePeopleRenames(options.app.schema, parts, before?.renamed);
  const run = renameProfilePeople(parts, renames, options.also);
  const renamed = { ...(before?.renamed ?? {}), ...Object.fromEntries([...renames].map(([from, { to }]) => [from, to])) };
  const version = meta?.version ?? options.version;
  const kept = (done: boolean): StoredMeta | undefined => (version === undefined ? undefined : ({ ...(meta ?? {}), version, profilePeople: { renamed, ...(done ? { done: true as const } : {}) } } as StoredMeta));
  const log = changedIn(run.parts.log, parts.log);
  const archive = parts.archive !== undefined && (changedIn(run.parts.archive!.ops, parts.archive.ops) || changedIn(run.parts.archive!.epochs, parts.archive.epochs));
  const epochs = changedIn(run.parts.epochs, parts.epochs);
  const snapshot = run.parts.snapshot !== parts.snapshot;
  if (log && !adapter.replaceLog) throw new Error(`graview ship: the ${adapter.name} adapter cannot replace a log, so "${scope}" cannot be migrated here; nothing was written.`);
  if (archive && !adapter.replaceArchive) throw new Error(`graview ship: the ${adapter.name} adapter cannot replace an archive, so "${scope}" cannot be migrated here; nothing was written.`);
  if (log || archive || epochs || snapshot) {
    const pending = kept(false);
    if (pending) await adapter.saveMeta?.(scope, pending);
    if (archive) await adapter.replaceArchive!(scope, run.parts.archive!);
    if (epochs) await adapter.saveEpochs?.(scope, run.parts.epochs);
    if (log) await adapter.replaceLog!(scope, run.parts.log);
    if (snapshot && run.parts.snapshot) await adapter.save(scope, run.parts.snapshot);
  }
  // Marked done once something is stored: a store with nothing yet is read again when it has something.
  const stored = parts.snapshot !== null || parts.log.length > 0;
  const done = stored ? kept(true) : undefined;
  if (done) await adapter.saveMeta?.(scope, done);
  const linked = new Map([...linkedOf(options.app.schema, run.parts, renamed), ...run.linked]);
  const renamedOne = (snapshot: GraphSnapshot) => renameProfilePeople({ snapshot, log: [], epochs: [] }, renames, options.also).parts.snapshot!;
  return { run: { count: run.count, linked }, parts: run.parts, ...(done ? { mark: (done as ProfilePeopleMeta).profilePeople! } : {}), renamed: renamedOne };
}
