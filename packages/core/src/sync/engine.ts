import type { GraphReader } from "../graph/types.js";
import { PermissionDeniedError } from "../permissions/types.js";
import type { ApplyOptions, PlannedChange, Store } from "../store.js";
import type { AnySchema, NodeOfSchema } from "../schema/schema.js";
import type { MutationCall } from "../mutations/types.js";
import {
  EMPTY_SYNC_STATE,
  systemAuthor,
  type ConflictPolicy,
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
export interface SettledConflict extends SyncConflict {
  readonly took: "ours" | "theirs";
}

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
const heldKey = (localId: string, field: string) => `${localId}\u0000${field}`;

export interface SyncOptions<S extends AnySchema> {
  readonly store: Store<S>;
  readonly mapping: SyncMapping;
  readonly remote: RemoteSystem;
  /**
   * What a field both sides changed becomes. `report` (the default) holds
   * it — neither side is sent or taken until `resolve` says which stands;
   * `theirs` takes the remote's value through `applyInbound`, as any inbound
   * change lands; `ours` keeps ours and sends it in the same pass. The
   * report says each one it settled, and which side it took.
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
  /** Called for a remote record we have never seen. Return null to ignore it. */
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
    for (const [localId, { node, mapping }] of this.participants()) {
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
    return new Map((this.state.conflicts ?? []).map((conflict) => [heldKey(conflict.localId, conflict.field), conflict]));
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
    const writes: RemoteWrite[] = [];
    const seen = new Set<string>();
    const held = this.held();
    for (const [localId, { node, mapping }] of this.participants()) {
      seen.add(localId);
      if (mapping.readonly) continue;
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
    // remote owns is not deleted there from here: `run` refuses it, once.
    for (const [localId, link] of Object.entries(this.state.links)) {
      if (seen.has(localId) || this.mappingFor(link.resource)?.readonly) continue;
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
        if (!node) continue;
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
    const { conflicts: _before, ...kept } = this.state;
    this.state = { ...kept, links, ...this.heldState(held) };

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
    const outbox = [...this.state.outbox, ...this.pending()];
    // The last write for a node wins; sending three versions of the same edit
    // is how a remote's rate limit is discovered.
    const deduped = [...new Map(outbox.map((write) => [write.localId, write])).values()];
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
   * Accepts one side of a conflict, and agrees the base so it stops being one.
   *
   * `theirs` writes their value through the ordinary inbound mutation, so it
   * lands in the log like any other change. `ours` changes nothing locally and
   * re-bases on their value, which makes the next run push ours. Either way
   * the field is no longer held.
   */
  resolve(conflict: SyncConflict, take: "ours" | "theirs"): void {
    const link = this.state.links[conflict.localId];
    if (!link) return;
    const mapping = this.mappingFor(link.resource);
    if (!mapping) return;

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
        if (!mapping?.readonly || (mapping.match && !mapping.match(node))) continue;
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
    const own = Object.prototype.hasOwnProperty.call(store, "applyAll");
    const applyAll = store.applyAll;
    store.applyAll = (calls: readonly MutationCall[], options: ApplyOptions = {}) =>
      applyAll.call(store, calls, {
        ...options,
        admit: (planned) => {
          this.admit(planned);
          options.admit?.(planned);
        },
      });
    return () => {
      if (own) store.applyAll = applyAll;
      else delete (store as { applyAll?: unknown }).applyAll;
    };
  }
}
