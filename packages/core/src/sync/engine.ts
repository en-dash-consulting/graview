import type { GraphReader } from "../graph/types.js";
import { PermissionDeniedError } from "../permissions/types.js";
import type { ApplyOptions, PlannedChange, Store } from "../store.js";
import type { AnySchema, NodeOfSchema } from "../schema/schema.js";
import type { AnyMutationDefinition, MutationCall } from "../mutations/types.js";
import type { Principal } from "../permissions/types.js";
import { seesId } from "../seen.js";
import {
  EMPTY_SYNC_STATE,
  systemAuthor,
  type ConflictPolicy,
  type DeletedConflict,
  type RemoteAck,
  type RemoteLink,
  type RemoteSystem,
  type RemoteWrite,
  type ResourceMapping,
  type SyncConflict,
  type SyncMapping,
  type SyncState,
} from "./types.js";

/** A conflict the engine's policy settled, and the side it took. */
export type SettledConflict = SyncConflict & { readonly took: "ours" | "theirs" };

/**
 * What a run of the engine did, stated as facts rather than a count.
 *
 * Sync is the part of a system people trust least, usually correctly, and a
 * report saying "12 changes" tells you nothing about whether it did the right
 * thing with them.
 */
export interface SyncReport {
  readonly system: string;
  /** Inbound changes applied as ops with a system author. */
  readonly applied: readonly string[];
  /** Inbound changes that were our own write coming back. */
  readonly echoes: readonly string[];
  /**
   * Conflicts waiting for somebody to choose: every one held after this run,
   * not only the ones it found, so an invariant handed them keeps showing a
   * conflict a later pull did not mention again. Empty unless the policy is
   * `report`.
   */
  readonly conflicts: readonly SyncConflict[];
  /** Conflicts this run settled by the engine's policy, and which side it took. */
  readonly resolved: readonly SettledConflict[];
  /** Writes that reached the remote. */
  readonly pushed: readonly string[];
  /** Writes still waiting, because the remote could not be reached. */
  readonly queued: readonly string[];
  /**
   * The remote refused these, or the engine did for it (a record the remote
   * owns, deleted here), and the local state is unchanged. A refused delete
   * is said once: the link goes with it, so the next pass does not ask again.
   */
  readonly refused: readonly { readonly localId: string; readonly error: string }[];
  /** Records the remote deleted: removed here through `removeInbound`, or, without one, kept here and no longer synced. */
  readonly gone: readonly string[];
  readonly offline: boolean;
  readonly state: SyncState;
}

export type { SyncConflict } from "./types.js";

/** Reads a node's mapped values, in OUR field names. */
function mappedValues(
  node: Record<string, unknown>,
  mapping: ResourceMapping,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const ours of Object.keys(mapping.fields)) values[ours] = node[ours];
  return values;
}

/**
 * Turns a remote record into our field names AND our representation.
 *
 * Both halves matter. A mapping that only renames ships a field full of
 * nonsense the first time the two systems disagree about what a time is.
 * `all` reads back the fields we only send too: what a push of ours agreed.
 */
function ourFields(
  remote: Readonly<Record<string, unknown>>,
  mapping: ResourceMapping,
  all = false,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [ours, theirs] of Object.entries(mapping.fields)) {
    if (!all && mapping.ours?.includes(ours)) continue;
    if (!(theirs in remote)) continue;
    const decode = mapping.decode?.[ours];
    values[ours] = decode ? decode(remote[theirs]) : remote[theirs];
  }
  return values;
}

function remoteFields(
  values: Record<string, unknown>,
  mapping: ResourceMapping,
  node: Record<string, unknown> = values,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [ours, theirs] of Object.entries(mapping.fields)) {
    if (!(ours in values)) continue;
    const encode = mapping.encode?.[ours];
    out[theirs] = encode ? encode(values[ours], node) : values[ours];
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** Where a conflict is held: by node and field, and a record deleted here by node alone. */
const heldKey = (localId: string, field = "") => `${localId}\u0000${field}`;
const keyOf = (conflict: SyncConflict) => heldKey(conflict.localId, conflict.field);

export interface SyncOptions<S extends AnySchema> {
  readonly store: Store<S>;
  readonly mapping: SyncMapping;
  readonly remote: RemoteSystem;
  /**
   * What a field both sides changed becomes. `report` (the default) holds
   * it — neither side is sent or taken until `resolve` says which stands;
   * `theirs` takes the remote's value through `applyInbound`, as any inbound
   * change lands; `ours` keeps ours and sends it in the same pass. A record
   * deleted here that the remote edited is one too: held under `report`,
   * made again under `theirs` (`createInbound`), deleted there under `ours`.
   * The report says each one it settled, and which side it took.
   */
  readonly conflicts?: ConflictPolicy;
  /**
   * The mutation that writes an inbound change. Required: an inbound change
   * must go through a mutation for the same reason a person's edit does — so
   * it lands in the log with an author, can be undone, and is judged by the
   * invariants. There is no second write path.
   */
  applyInbound(call: {
    readonly localId: string;
    readonly kind: string;
    readonly fields: Readonly<Record<string, unknown>>;
  }): { readonly name: string; readonly args: Record<string, unknown> };
  /**
   * The mutation that removes a record the remote deleted. Absent, the
   * record stays here and stops being synced — it is not sent back as new —
   * and the report says so (`gone`).
   */
  removeInbound?(call: { readonly localId: string; readonly kind: string }): { readonly name: string; readonly args: Record<string, unknown> } | null;
  /**
   * Called for a remote record we have never seen, and to make again one
   * deleted here when its conflict takes theirs. Return null to ignore it.
   */
  createInbound?(change: {
    readonly resource: string;
    readonly id: string;
    readonly fields: Readonly<Record<string, unknown>>;
  }): { readonly name: string; readonly args: Record<string, unknown> } | null;
}

/**
 * Two-way sync, on top of the op log rather than beside it.
 *
 * The log gives this a foundation most sync layers lack. Every op already
 * carries who did it and what it wrote, so an inbound change arrives as an
 * ordinary op authored by the system, appears in the activity list beside a
 * person's edits, and is undone like anything else. And because we remember
 * the version the remote produced for each of OUR writes, an echo of our own
 * write is distinguishable from somebody else's change — which is the loop
 * that breaks naive two-way sync.
 *
 * A field both sides changed since they last agreed is decided by the policy
 * the engine was given, and by default it is not decided at all: it is held
 * and reported, and neither value moves until somebody chooses — the same
 * instinct that makes an invariant name its repairs rather than silently
 * applying one.
 */
export class SyncEngine<S extends AnySchema> {
  private state: SyncState;
  private readonly options: SyncOptions<S>;

  constructor(options: SyncOptions<S>, state: SyncState = EMPTY_SYNC_STATE) {
    this.options = options;
    /*
     * LINKED AT THE VERSION THE GRAPH WAS MADE FROM. A graph projected from
     * the remote already holds what the remote holds; without a link, the
     * first run would send every record back as new.
     */
    this.state = { ...state, links: { ...this.seededLinks(), ...state.links } };
  }

  get snapshot(): SyncState {
    return this.state;
  }

  private get policy(): ConflictPolicy {
    return this.options.conflicts ?? "report";
  }

  private mappingFor(kindOrResource: string): ResourceMapping | undefined {
    return this.options.mapping.resources.find(
      (resource) =>
        resource.kind === kindOrResource || resource.resource === kindOrResource,
    );
  }

  /** The sentence a local act on a record the remote owns is refused with. */
  private because(mapping: ResourceMapping): string {
    return mapping.because ?? `${this.options.mapping.system} keeps these records; they are not changed here.`;
  }

  /**
   * Why a record of this kind is not written here, or undefined when it is.
   * The sentence a read-only resource declared, so a host can say it before
   * an act is even offered.
   */
  refuses(kind: string): string | undefined {
    const mapping = this.options.mapping.resources.find((resource) => resource.kind === kind);
    return mapping?.readonly ? this.because(mapping) : undefined;
  }

  /** Every node that participates in the sync, by our id. */
  private participants(): Map<string, { node: Record<string, unknown>; mapping: ResourceMapping }> {
    const graph = this.options.store.graph as GraphReader<NodeOfSchema<S>>;
    const found = new Map<string, { node: Record<string, unknown>; mapping: ResourceMapping }>();
    for (const node of graph.allNodes() as Record<string, unknown>[]) {
      const mapping = this.mappingFor(node["kind"] as string);
      if (!mapping || mapping.kind !== node["kind"]) continue;
      if (mapping.match && !mapping.match(node)) continue;
      found.set(node["id"] as string, { node, mapping });
    }
    return found;
  }

  /** A link for every participant whose mapping names its version field and that carries one. */
  private seededLinks(): Record<string, RemoteLink> {
    const links: Record<string, RemoteLink> = {};
    if (!this.options.mapping.resources.some((resource) => resource.version)) return links;
    /*
     * AS THE REMOTE MADE IT, not as it is now: a field somebody changed here
     * before the first run is agreed at the value it had before that change,
     * so the change is sent rather than taken for what the remote holds.
     */
    const before = new Map<string, Record<string, unknown>>();
    // And a record deleted here before then is linked as it was, so the delete is sent (or held against the remote's edit).
    const removed = new Map<string, Record<string, unknown>>();
    for (const op of this.options.store.log.all()) {
      if (op.author.kind === "system" && op.author.id === this.options.mapping.system) continue;
      for (const primitive of op.primitives) {
        if (primitive.op === "remove-node") {
          const node = primitive.node as unknown as Record<string, unknown>;
          if (!removed.has(node["id"] as string)) removed.set(node["id"] as string, node);
        }
        if (primitive.op !== "patch-node") continue;
        const was = before.get(primitive.id) ?? {};
        for (const [field, value] of Object.entries(primitive.before ?? {})) if (!Object.hasOwn(was, field)) was[field] = value;
        before.set(primitive.id, was);
      }
    }
    const graph = this.options.store.graph;
    const participants = this.participants();
    for (const [localId, node] of removed) {
      if (graph.getNode(localId)) continue;
      const mapping = this.mappingFor(node["kind"] as string);
      if (mapping && mapping.kind === node["kind"] && (!mapping.match || mapping.match(node))) participants.set(localId, { node, mapping });
    }
    for (const [localId, { node: now, mapping }] of participants) {
      const node = { ...now, ...before.get(localId) };
      const version = mapping.version ? node[mapping.version] : undefined;
      if ((typeof version !== "string" && typeof version !== "number") || version === "") continue;
      const remoteId = mapping.remoteId ? node[mapping.remoteId] : undefined;
      links[localId] = {
        resource: mapping.resource,
        id: typeof remoteId === "string" && remoteId !== "" ? remoteId : localId,
        version: String(version),
        fields: mappedValues(node, mapping),
      };
    }
    return links;
  }

  /** The fields held in conflict, by node and field. */
  private held(): Map<string, SyncConflict> {
    return new Map((this.state.conflicts ?? []).map((conflict) => [keyOf(conflict), conflict]));
  }

  /**
   * A HELD FIELD SETTLED HERE — somebody took their value by an ordinary act
   * (the conflict invariant's repair is one) — is not held any longer: the
   * value both sides hold is agreed, and nothing is sent for it.
   */
  private release(): void {
    const conflicts = this.state.conflicts ?? [];
    if (conflicts.length === 0) return;
    const graph = this.options.store.graph as GraphReader<NodeOfSchema<S>>;
    let links = this.state.links;
    let changed = false;
    const still = new Map<string, SyncConflict>();
    for (const conflict of conflicts) {
      const node = graph.getNode(conflict.localId) as Record<string, unknown> | undefined;
      const link = links[conflict.localId];
      const mapping = link ? this.mappingFor(link.resource) : undefined;
      if (!link || !mapping) {
        still.set(keyOf(conflict), conflict);
        continue;
      }
      if (!node && !conflict.deleted) {
        /*
         * A RECORD HELD IN CONFLICT, DELETED HERE, is a delete of a record
         * the remote edited: the delete is held too, not sent past the edit.
         */
        const key = heldKey(conflict.localId);
        const was = still.get(key) as DeletedConflict | undefined;
        still.set(key, { localId: conflict.localId, deleted: true, base: link.fields, theirs: { ...link.fields, ...was?.theirs, [conflict.field]: conflict.theirs } });
        changed = true;
        continue;
      }
      if (node && conflict.deleted) {
        /*
         * BACK HERE (the delete taken back): what it holds against what the
         * remote made of it is held field by field, never sent over the edit.
         */
        const ours = mappedValues(node, mapping);
        for (const [field, theirs] of Object.entries(conflict.theirs)) {
          if (same(ours[field], theirs)) links = { ...links, [conflict.localId]: { ...links[conflict.localId]!, fields: { ...links[conflict.localId]!.fields, [field]: theirs } } };
          else still.set(heldKey(conflict.localId, field), { localId: conflict.localId, field, ours: ours[field], theirs, base: conflict.base[field] });
        }
        changed = true;
        continue;
      }
      if (!node || conflict.deleted || !same(mappedValues(node, mapping)[conflict.field], conflict.theirs)) {
        still.set(keyOf(conflict), conflict);
        continue;
      }
      links = { ...links, [conflict.localId]: { ...link, fields: { ...link.fields, [conflict.field]: conflict.theirs } } };
      changed = true;
    }
    if (!changed) return;
    const { conflicts: _was, ...rest } = this.state;
    this.state = { ...rest, links, ...(still.size > 0 ? { conflicts: [...still.values()] } : {}) };
  }

  /**
   * The local changes the remote has not seen.
   *
   * Derived by comparing what a node holds NOW against what we last agreed it
   * held — not by watching for edits. A change nobody was listening for still
   * gets sent, which matters because the alternative is a subscription that
   * has to be correct forever. A field held in conflict is not sent, and a
   * record the remote owns never is.
   */
  pending(): readonly RemoteWrite[] {
    this.release();
    const writes: RemoteWrite[] = [];
    const seen = new Set<string>();
    const held = this.held();
    const gone = new Set(this.state.gone ?? []);
    for (const [localId, { node, mapping }] of this.participants()) {
      seen.add(localId);
      if (mapping.readonly || gone.has(localId)) continue;
      const link = this.state.links[localId];
      const values = mappedValues(node, mapping);
      if (!link) {
        writes.push({
          resource: mapping.resource,
          localId,
          fields: remoteFields(values, mapping, node),
        });
        continue;
      }
      const free = Object.fromEntries(Object.entries(values).filter(([field]) => !held.has(heldKey(localId, field))));
      const changed = Object.keys(free).filter((field) => !same(free[field], link.fields[field]));
      if (changed.length === 0) continue;
      writes.push({
        resource: mapping.resource,
        id: link.id,
        localId,
        fields: remoteFields(free, mapping, node),
      });
    }
    // Something we had linked and no longer have is a deletion, and saying so
    // is better than leaving an orphan on the remote forever. A record the
    // remote owns is not deleted there from here: `run` refuses it, once. A
    // delete held against the remote's edit waits for `resolve`.
    for (const [localId, link] of Object.entries(this.state.links)) {
      if (seen.has(localId) || this.mappingFor(link.resource)?.readonly || held.has(heldKey(localId))) continue;
      writes.push({ resource: link.resource, id: link.id, localId, deleted: true });
    }
    return writes;
  }

  /**
   * One pass: take what changed there, then send what changed here.
   *
   * Inbound first on purpose. Pushing first would send a value we are about to
   * be told is stale, and then the conflict we report would be one we caused.
   */
  async run(): Promise<SyncReport> {
    const applied: string[] = [];
    const echoes: string[] = [];
    const resolved: SettledConflict[] = [];
    const pushed: string[] = [];
    const refused: { localId: string; error: string }[] = [];
    const gone: string[] = [];
    this.release();
    const held = this.held();
    const policy = this.policy;
    let offline = false;

    let links: Record<string, RemoteLink> = { ...this.state.links };
    let cursor = this.state.cursor;

    // --------------------------------------------------------------- inbound
    try {
      const result = await this.options.remote.pull(cursor);
      cursor = result.cursor;
      const byRemoteId = new Map(
        Object.entries(links).map(([localId, link]) => [`${link.resource}:${link.id}`, localId]),
      );

      for (const change of result.changes) {
        const mapping = this.mappingFor(change.resource);
        if (!mapping) continue;
        const localId = byRemoteId.get(`${change.resource}:${change.id}`);

        /*
         * OUR OWN WRITE, COMING BACK.
         *
         * The remote told us what version our push produced; a change carrying
         * that version is that push arriving as news. Applying it would be
         * harmless once and a loop when two systems do it to each other.
         */
        if (localId && links[localId]!.version === change.version) {
          echoes.push(localId);
          continue;
        }

        if (!localId) {
          const created = this.options.createInbound?.({
            resource: change.resource,
            id: change.id,
            fields: change.fields ?? {},
          });
          if (!created) continue;
          const result2 = this.options.store.apply(created, {
            author: systemAuthor(this.options.mapping.system),
            intent: `${this.options.mapping.system}: new ${change.resource}`,
          });
          const madeId = String(created.args["id"] ?? result2.writes[0] ?? "");
          if (madeId) {
            applied.push(madeId);
            links[madeId] = {
              resource: change.resource,
              id: change.id,
              version: change.version,
              fields: ourFields(change.fields ?? {}, mapping),
            };
          }
          continue;
        }

        const link = links[localId]!;
        const node = this.options.store.graph.getNode(localId) as
          | Record<string, unknown>
          | undefined;

        /*
         * DELETED THERE. Removed here through the declared act when there is
         * one, as any inbound change lands; kept here otherwise, but no longer
         * linked or sent, so it is not made again there as new. Either way
         * its held fields are nobody's to choose between any more.
         */
        if (change.deleted) {
          const removal = node ? this.options.removeInbound?.({ localId, kind: mapping.kind }) : null;
          if (removal) {
            this.options.store.apply(removal, {
              author: systemAuthor(this.options.mapping.system),
              intent: `${this.options.mapping.system}: deleted ${change.resource}`,
            });
          }
          if (node) gone.push(localId);
          for (const key of [...held.keys()]) if (held.get(key)!.localId === localId) held.delete(key);
          const { [localId]: _deleted, ...rest } = links;
          links = rest;
          continue;
        }
        if (!node) {
          /*
           * DELETED HERE, EDITED THERE. A record the remote owns is refused
           * below; one whose news changes nothing we agreed lets the delete
           * go; otherwise the delete and the edit are a conflict like any
           * other, and go where the policy says.
           */
          const record = { ...link.fields, ...ourFields(change.fields ?? {}, mapping) };
          if (mapping.readonly) continue;
          links[localId] = { ...link, version: change.version };
          if (Object.keys(record).every((field) => same(record[field], link.fields[field]))) continue;
          for (const key of [...held.keys()]) if (held.get(key)!.localId === localId) held.delete(key);
          const conflict: DeletedConflict = { localId, deleted: true, theirs: record, base: link.fields };
          if (policy === "report") {
            held.set(heldKey(localId), conflict);
            continue;
          }
          resolved.push({ ...conflict, took: policy });
          if (policy === "theirs") {
            const made = this.restore(links, localId, record);
            links = made.links;
            if (made.id) applied.push(made.id);
          }
          continue;
        }
        const theirs = ourFields(change.fields ?? {}, mapping);
        const ours = mappedValues(node, mapping);

        /*
         * Field by field: what lands, what both sides now agree on, and what
         * is contested — both changed since the version we last agreed on,
         * to different values. Contested goes where the policy says, and by
         * default nowhere: picking a winner quietly would be the sync layer
         * making a domain decision on nobody's behalf.
         */
        const lands: Record<string, unknown> = {};
        const agreed: Record<string, unknown> = {};
        for (const [field, value] of Object.entries(theirs)) {
          const key = heldKey(localId, field);
          const base = link.fields[field];
          if (same(value, ours[field])) {
            agreed[field] = value;
            held.delete(key);
            continue;
          }
          if (same(value, base)) {
            // Only we changed it: ours goes out in this pass.
            held.delete(key);
            continue;
          }
          if (same(ours[field], base) || mapping.readonly) {
            lands[field] = agreed[field] = value;
            held.delete(key);
            continue;
          }
          const conflict: SyncConflict = { localId, field, ours: ours[field], theirs: value, base };
          if (policy === "report") {
            held.set(key, conflict);
            continue;
          }
          held.delete(key);
          resolved.push({ ...conflict, took: policy });
          // Theirs lands as any inbound change does; ours is agreed against
          // what they hold now, so the push below sends it.
          if (policy === "theirs") lands[field] = value;
          agreed[field] = value;
        }

        if (Object.keys(lands).length > 0) {
          this.options.store.apply(
            this.options.applyInbound({ localId, kind: mapping.kind, fields: lands }),
            {
              author: systemAuthor(this.options.mapping.system),
              intent: `${this.options.mapping.system}: ${Object.keys(lands).join(", ")}`,
            },
          );
          applied.push(localId);
        }
        links[localId] = {
          ...link,
          version: change.version,
          // What both sides hold is agreed now; a held field is not, so it
          // keeps its old base until somebody resolves it.
          fields: { ...link.fields, ...agreed },
        };
      }
    } catch {
      /*
       * OFFLINE degrades to local-only.
       *
       * Not an error: a household week that stops working on a train is worse
       * than one that syncs later. The cursor is untouched, so the next run
       * asks for the same window again.
       */
      offline = true;
    }

    // What the inbound pass decided is what the outbound pass sends from.
    const { conflicts: _before, gone: _gone, ...kept } = this.state;
    const unsynced = [...new Set([...(this.state.gone ?? []), ...gone])].filter((id) => this.options.store.graph.getNode(id));
    this.state = { ...kept, links, ...this.heldState(held), ...(unsynced.length > 0 ? { gone: unsynced } : {}) };

    /*
     * A RECORD THE REMOTE OWNS, DELETED HERE, is refused here and said once:
     * the link goes, so the next pass does not refuse it again, and the
     * remote's record comes back as new on a pull that carries it.
     */
    const participants = this.participants();
    for (const [localId, link] of Object.entries(links)) {
      const mapping = this.mappingFor(link.resource);
      if (participants.has(localId) || !mapping?.readonly) continue;
      refused.push({ localId, error: this.because(mapping) });
      const { [localId]: _gone, ...rest } = links;
      links = rest;
    }

    // -------------------------------------------------------------- outbound
    this.state = { ...this.state, links };
    /*
     * WHAT IS OWED IS WORKED OUT AGAIN, not replayed: a write queued while
     * offline is what `pending` says now, unless something since — a
     * conflict the pull just held, an edit taken back — says otherwise, and
     * then the queued one would send what nobody now holds. One write per
     * node: sending three versions of the same edit is how a remote's rate
     * limit is discovered.
     */
    const deduped = [...new Map(this.pending().map((write) => [write.localId, write])).values()];
    let queued: RemoteWrite[] = deduped;

    if (!offline && deduped.length > 0) {
      try {
        const acks = await this.options.remote.push(deduped);
        for (const ack of acks) {
          if (ack.error) {
            refused.push({ localId: ack.localId, error: ack.error });
            // A refused delete is said once: we stop asking, rather than
            // being refused again on every pass for as long as we run.
            if (deduped.find((write) => write.localId === ack.localId)?.deleted) {
              const { [ack.localId]: _gone, ...rest } = links;
              links = rest;
            }
            continue;
          }
          pushed.push(ack.localId);
          links = this.linkAfterPush(links, ack, deduped);
        }
        // Anything the remote did not acknowledge at all stays queued rather
        // than being assumed delivered.
        const acked = new Set(acks.map((ack) => ack.localId));
        queued = deduped.filter((write) => !acked.has(write.localId));
      } catch {
        offline = true;
      }
    }

    this.state = {
      ...(cursor === undefined ? {} : { cursor }),
      links,
      outbox: queued,
      ...this.heldState(held),
      ...(this.state.gone ? { gone: this.state.gone } : {}),
    };

    return {
      system: this.options.mapping.system,
      applied,
      echoes,
      conflicts: this.state.conflicts ?? [],
      resolved,
      pushed,
      queued: queued.map((write) => write.localId),
      refused,
      gone,
      offline,
      state: this.state,
    };
  }

  private heldState(held: Map<string, SyncConflict>): { conflicts?: readonly SyncConflict[] } {
    return held.size > 0 ? { conflicts: [...held.values()] } : {};
  }

  /** Records what the remote made of one of our writes. */
  private linkAfterPush(
    links: Record<string, RemoteLink>,
    ack: RemoteAck,
    writes: readonly RemoteWrite[],
  ): Record<string, RemoteLink> {
    const write = writes.find((candidate) => candidate.localId === ack.localId);
    if (!write) return links;
    if (write.deleted) {
      const { [ack.localId]: _gone, ...rest } = links;
      return rest;
    }
    const mapping = this.mappingFor(write.resource);
    if (!mapping) return links;
    return {
      ...links,
      [ack.localId]: {
        resource: write.resource,
        id: ack.id,
        // The version OUR write produced. This is the whole echo mechanism.
        version: ack.version,
        // Stored in OUR representation, because that is what the next run
        // compares against — comparing a decoded remote value with an encoded
        // local one reports a change on every single pass. A field the write
        // left out (held in conflict) keeps the base it had.
        fields: { ...links[ack.localId]?.fields, ...ourFields(write.fields ?? {}, mapping, true) },
      },
    };
  }

  /**
   * MAKES A RECORD DELETED HERE AGAIN with the remote's values, through
   * `createInbound` as any record new to us lands, and links what it made
   * where the old one was. Without `createInbound` the remote keeps its
   * record and this one stays deleted, unlinked: nothing is sent for it.
   */
  private restore(
    links: Record<string, RemoteLink>,
    localId: string,
    record: Readonly<Record<string, unknown>>,
  ): { links: Record<string, RemoteLink>; id?: string } {
    const { [localId]: link, ...rest } = links;
    const mapping = link ? this.mappingFor(link.resource) : undefined;
    if (!link || !mapping) return { links: rest };
    const created = this.options.createInbound?.({ resource: link.resource, id: link.id, fields: remoteFields(record, mapping) });
    if (!created) return { links: rest };
    const result = this.options.store.apply(created, {
      author: systemAuthor(this.options.mapping.system),
      intent: `${this.options.mapping.system}: restored ${link.resource}`,
    });
    const id = String(created.args["id"] ?? result.writes[0] ?? "");
    return id ? { links: { ...rest, [id]: { ...link, fields: record } }, id } : { links: rest };
  }

  /**
   * Accepts one side of a conflict, and agrees the base so it stops being one.
   *
   * `theirs` writes their value through the ordinary inbound mutation, so it
   * lands in the log like any other change. `ours` changes nothing locally and
   * re-bases on their value, which makes the next run push ours. Either way
   * the field is no longer held.
   */
  resolve(conflict: SyncConflict, take: "ours" | "theirs"): void {
    this.release();
    const link = this.state.links[conflict.localId];
    if (!link) return;
    // One a later pull already settled, or that holds another value since, is not this one to choose: choosing it would agree on a value neither side holds.
    if (!same(this.held().get(keyOf(conflict))?.theirs, conflict.theirs)) return;
    const mapping = this.mappingFor(link.resource);
    if (!mapping) return;

    if (conflict.deleted) {
      /*
       * A RECORD DELETED HERE AND EDITED THERE: `ours` lets the delete go on
       * the next run; `theirs` makes the record again with the remote's
       * values, linked at the version that edit made.
       */
      const held = this.held();
      held.delete(keyOf(conflict));
      const links = take === "theirs" ? this.restore(this.state.links, conflict.localId, conflict.theirs).links : this.state.links;
      const { conflicts: _was, ...rest } = this.state;
      this.state = { ...rest, ...this.heldState(held), links };
      return;
    }

    if (take === "theirs") {
      this.options.store.apply(
        this.options.applyInbound({
          localId: conflict.localId,
          kind: mapping.kind,
          fields: { [conflict.field]: conflict.theirs },
        }),
        {
          author: systemAuthor(this.options.mapping.system),
          intent: `${this.options.mapping.system}: took their "${conflict.field}"`,
        },
      );
    }
    const held = this.held();
    held.delete(heldKey(conflict.localId, conflict.field));
    const { conflicts: _was, ...rest } = this.state;
    this.state = {
      ...rest,
      ...this.heldState(held),
      links: {
        ...this.state.links,
        [conflict.localId]: {
          ...link,
          fields: { ...link.fields, [conflict.field]: conflict.theirs },
        },
      },
    };
  }

  /**
   * REFUSES A LOCAL ACT ON A RECORD THE REMOTE OWNS, with the sentence its
   * resource declared — as an `ApplyOptions.admit`, so the change is put
   * back before anything is kept. The engine's own inbound changes pass.
   */
  admit(planned: PlannedChange): void {
    const graph = this.options.store.graph as GraphReader<NodeOfSchema<S>>;
    for (const op of planned.ops) {
      if (op.author.kind === "system" && op.author.id === this.options.mapping.system) continue;
      for (const primitive of op.primitives) {
        const node = (
          primitive.op === "add-node" || primitive.op === "remove-node"
            ? primitive.node
            : primitive.op === "patch-node"
              ? graph.getNode(primitive.id)
              : undefined
        ) as Record<string, unknown> | undefined;
        if (!node) continue;
        const mapping = this.options.mapping.resources.find((resource) => resource.kind === node["kind"]);
        // Judged as it was and as it would be: a patch that moves a record out of what `match` reads is still a write to it.
        const was = primitive.op === "patch-node" ? { ...node, ...primitive.before } : node;
        if (!mapping?.readonly || (mapping.match && !mapping.match(node) && !mapping.match(was))) continue;
        throw new PermissionDeniedError({
          mutation: op.mutation?.name ?? "",
          kind: mapping.kind,
          message: this.because(mapping),
          wouldNeed: [],
        });
      }
    }
  }

  /**
   * HOLDS THE STORE TO THE MAPPING: every act applied on it from now on is
   * judged by `admit`, so a record the remote owns cannot be changed here
   * by a person, an agent or a view, whoever calls `apply`. Returns the way
   * back.
   */
  guard(): () => void {
    const store = this.options.store;
    const { applyAll, undo, permits, permittedMutations } = store;
    const held = store as unknown as Record<string, unknown>;
    const replaced = (["applyAll", "undo", "permits", "permittedMutations"] as const).map((name) => [name, held[name], Object.prototype.hasOwnProperty.call(store, name)] as const);
    const admitted = (options: ApplyOptions): ApplyOptions => ({
      ...options,
      admit: (planned) => {
        this.admit(planned);
        options.admit?.(planned);
      },
    });
    store.applyAll = (calls: readonly MutationCall[], options: ApplyOptions = {}) => applyAll.call(store, calls, admitted(options));
    // Taking back the remote's own change to a record it owns is a write to it too (redo goes through here).
    store.undo = (batchIds, options = {}) => undo.call(store, batchIds, admitted(options));
    /*
     * THE OFFER SAYS WHAT THE ACT WOULD MEET. The store's own answer is what
     * every surface asks before it offers an act (the actions strip, the
     * seat's tools, a lens's press), so a record the remote owns is refused
     * there with the sentence `admit` gives, rather than offered and then
     * put back.
     */
    store.permits = (call, principal) => {
      const verdict = permits.call(store, call, principal);
      const message = verdict.ok ? this.owned(call, principal) : undefined;
      return message === undefined ? verdict : ({ ok: false, refusal: { mutation: call.name, message, wouldNeed: [] } } as typeof verdict);
    };
    store.permittedMutations = (principal) =>
      permittedMutations.call(store, principal).filter((mutation) => this.ownedKindOf(mutation) === undefined);
    return () => {
      for (const [name, was, own] of replaced) {
        if (own) held[name] = was;
        else delete held[name];
      }
    };
  }

  /** The read-only mapping every record of this kind falls under, whatever its fields: one with no `match`. */
  private ownedMapping(kind: string): ResourceMapping | undefined {
    const mapping = this.options.mapping.resources.find((resource) => resource.kind === kind);
    return mapping?.readonly && !mapping.match ? mapping : undefined;
  }

  /**
   * THE KIND AN ACT CAN ONLY EVER WRITE when the remote owns every record of
   * it: the kind a derived edit rides, its subject's kinds, or every kind it
   * creates. Undefined when it could write something that is ours.
   */
  private ownedKindOf(mutation: AnyMutationDefinition): string | undefined {
    const subject = mutation.subject;
    const kinds: readonly string[] = mutation.derived
      ? [mutation.derived.kind]
      : subject
        ? subject.kinds === "*" ? [] : subject.kinds
        : mutation.creates ?? [];
    return kinds.length > 0 && kinds.every((kind) => this.ownedMapping(kind)) ? kinds[0] : undefined;
  }

  /** Why this call would be refused as a write to a record the remote owns — said only of a record the asker sees. */
  private owned(call: MutationCall, principal?: Principal): string | undefined {
    const store = this.options.store;
    let mutation: AnyMutationDefinition;
    try {
      mutation = store.mutation(call.name);
    } catch {
      return undefined;
    }
    const id = mutation.subject ? call.args[mutation.subject.arg] : undefined;
    if (typeof id === "string") {
      const node = store.graph.getNode(id) as Record<string, unknown> | undefined;
      if (!node || (principal && !seesId(store, principal)(id))) return undefined;
      const mapping = this.options.mapping.resources.find((resource) => resource.kind === node["kind"]);
      return mapping?.readonly && (!mapping.match || mapping.match(node)) ? this.because(mapping) : undefined;
    }
    const kind = this.ownedKindOf(mutation);
    return kind === undefined ? undefined : this.because(this.ownedMapping(kind) as ResourceMapping);
  }
}
