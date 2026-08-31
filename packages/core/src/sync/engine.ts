import type { GraphReader } from "../graph/types.js";
import type { Store } from "../store.js";
import type { AnySchema, NodeOfSchema } from "../schema/schema.js";
import {
  EMPTY_SYNC_STATE,
  systemAuthor,
  type RemoteAck,
  type RemoteChange,
  type RemoteLink,
  type RemoteSystem,
  type RemoteWrite,
  type ResourceMapping,
  type SyncMapping,
  type SyncState,
} from "./types.js";

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
  /** Both sides changed the same field since we last agreed. */
  readonly conflicts: readonly SyncConflict[];
  /** Writes that reached the remote. */
  readonly pushed: readonly string[];
  /** Writes still waiting, because the remote could not be reached. */
  readonly queued: readonly string[];
  /** The remote refused these, and the local state is unchanged. */
  readonly refused: readonly { readonly localId: string; readonly error: string }[];
  readonly offline: boolean;
  readonly state: SyncState;
}

/** One field, changed on both sides since the last time they agreed. */
export interface SyncConflict {
  readonly localId: string;
  readonly field: string;
  readonly ours: unknown;
  readonly theirs: unknown;
  /** What both sides last agreed it was. */
  readonly base: unknown;
}

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
 */
function ourFields(
  remote: Readonly<Record<string, unknown>>,
  mapping: ResourceMapping,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [ours, theirs] of Object.entries(mapping.fields)) {
    if (mapping.ours?.includes(ours)) continue;
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

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface SyncOptions<S extends AnySchema> {
  readonly store: Store<S>;
  readonly mapping: SyncMapping;
  readonly remote: RemoteSystem;
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
 * Nothing here resolves a conflict. A field both sides changed since they last
 * agreed is reported, and it is the app's business — the same instinct that
 * makes an invariant name its repairs rather than silently applying one.
 */
export class SyncEngine<S extends AnySchema> {
  private state: SyncState;
  private readonly options: SyncOptions<S>;

  constructor(options: SyncOptions<S>, state: SyncState = EMPTY_SYNC_STATE) {
    this.options = options;
    this.state = state;
  }

  get snapshot(): SyncState {
    return this.state;
  }

  private mappingFor(kindOrResource: string): ResourceMapping | undefined {
    return this.options.mapping.resources.find(
      (resource) =>
        resource.kind === kindOrResource || resource.resource === kindOrResource,
    );
  }

  /** Every node that participates in the sync, by our id. */
  private participants(): Map<string, { node: Record<string, unknown>; mapping: ResourceMapping }> {
    const graph = this.options.store.graph as GraphReader<NodeOfSchema<S>>;
    const found = new Map<string, { node: Record<string, unknown>; mapping: ResourceMapping }>();
    for (const node of graph.allNodes() as unknown as Record<string, unknown>[]) {
      const mapping = this.mappingFor(node["kind"] as string);
      if (!mapping || mapping.kind !== node["kind"]) continue;
      if (mapping.match && !mapping.match(node)) continue;
      found.set(node["id"] as string, { node, mapping });
    }
    return found;
  }

  /**
   * The local changes the remote has not seen.
   *
   * Derived by comparing what a node holds NOW against what we last agreed it
   * held — not by watching for edits. A change nobody was listening for still
   * gets sent, which matters because the alternative is a subscription that
   * has to be correct forever.
   */
  pending(): readonly RemoteWrite[] {
    const writes: RemoteWrite[] = [];
    const seen = new Set<string>();
    for (const [localId, { node, mapping }] of this.participants()) {
      seen.add(localId);
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
      const changed = Object.keys(values).filter((field) => !same(values[field], link.fields[field]));
      if (changed.length === 0) continue;
      writes.push({
        resource: mapping.resource,
        id: link.id,
        localId,
        fields: remoteFields(values, mapping, node),
      });
    }
    // Something we had linked and no longer have is a deletion, and saying so
    // is better than leaving an orphan on the remote forever.
    for (const [localId, link] of Object.entries(this.state.links)) {
      if (seen.has(localId)) continue;
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
    const conflicts: SyncConflict[] = [];
    const pushed: string[] = [];
    const refused: { localId: string; error: string }[] = [];
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
         * A GENUINE CONFLICT, reported rather than resolved.
         *
         * Both sides changed the same field since the version we last agreed
         * on. Picking a winner here would be the sync layer making a domain
         * decision on nobody's behalf, quietly, in a place nobody looks.
         */
        const contested = Object.keys(theirs).filter(
          (field) =>
            !same(theirs[field], link.fields[field]) && !same(ours[field], link.fields[field]),
        );
        const settled = Object.fromEntries(
          Object.entries(theirs).filter(([field]) => !contested.includes(field)),
        );
        for (const field of contested) {
          conflicts.push({
            localId,
            field,
            ours: ours[field],
            theirs: theirs[field],
            base: link.fields[field],
          });
        }

        if (Object.keys(settled).length > 0) {
          this.options.store.apply(
            this.options.applyInbound({ localId, kind: mapping.kind, fields: settled }),
            {
              author: systemAuthor(this.options.mapping.system),
              intent: `${this.options.mapping.system}: ${Object.keys(settled).join(", ")}`,
            },
          );
          applied.push(localId);
        }
        links[localId] = {
          ...link,
          version: change.version,
          // The uncontested fields are agreed now; the contested ones are not,
          // so they keep their old base until somebody resolves them.
          fields: { ...link.fields, ...settled },
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

    // -------------------------------------------------------------- outbound
    const outbox = [...this.state.outbox, ...this.pending()];
    // The last write for a node wins; sending three versions of the same edit
    // is how a remote's rate limit is discovered.
    const deduped = [...new Map(outbox.map((write) => [write.localId, write])).values()];
    let queued: RemoteWrite[] = deduped;

    if (!offline && deduped.length > 0) {
      try {
        const acks = await this.options.remote.push(deduped);
        queued = [];
        for (const ack of acks) {
          if (ack.error) {
            refused.push({ localId: ack.localId, error: ack.error });
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
    };

    return {
      system: this.options.mapping.system,
      applied,
      echoes,
      conflicts,
      pushed,
      queued: queued.map((write) => write.localId),
      refused,
      offline,
      state: this.state,
    };
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
        // local one reports a change on every single pass.
        fields: ourFields(write.fields ?? {}, mapping),
      },
    };
  }

  /**
   * Accepts one side of a conflict, and agrees the base so it stops being one.
   *
   * `theirs` writes their value through the ordinary inbound mutation, so it
   * lands in the log like any other change. `ours` changes nothing locally and
   * simply re-bases, which makes the next run push our value.
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
    this.state = {
      ...this.state,
      links: {
        ...this.state.links,
        [conflict.localId]: {
          ...link,
          fields: {
            ...link.fields,
            [conflict.field]: take === "theirs" ? conflict.theirs : conflict.base,
          },
        },
      },
    };
  }
}
