import type { Author } from "../ops/types.js";

/**
 * How one node kind corresponds to one external resource.
 *
 * Declarative, the way a lens binds roles rather than field names: an app says
 * "a block IS an event, and its start is `dtstart`", and the engine does the
 * rest. No app writes per-field sync code, because per-field sync code is
 * where two-way sync goes wrong — it is written once per field, drifts once
 * per field, and fails silently once per field.
 */
export interface ResourceMapping {
  /** The node kind on our side. */
  readonly kind: string;
  /** What the remote calls this thing. */
  readonly resource: string;
  /**
   * Our field name → theirs. Only what is mapped is synced; anything else is
   * ours alone and is never sent, which is the difference between syncing and
   * replicating.
   */
  readonly fields: Readonly<Record<string, string>>;
  /**
   * Narrows which nodes of the kind participate. A household's shifts may
   * belong on a calendar while its naps do not.
   */
  readonly match?: (node: Record<string, unknown>) => boolean;
  /**
   * Fields we will send but never accept back. Useful where the remote
   * rewrites something on save — Google normalises a timezone — and echoing
   * that back as "someone changed it" would start a loop.
   */
  readonly ours?: readonly string[];
  /**
   * Where the two systems disagree about REPRESENTATION, not about names.
   *
   * A mapping is a rename, plus this. The household example stores a block's start as
   * minutes since midnight, and Google wants an RFC 3339 datetime; pretending
   * a rename is enough is how a sync layer ships a field full of nonsense and
   * finds out from a user. Keyed by OUR field name, both directions.
   *
   * `encode` also receives the node, because a conversion often needs a
   * sibling field — minutes are meaningless without a date.
   */
  readonly encode?: Readonly<
    Record<string, (value: unknown, node: Record<string, unknown>) => unknown>
  >;
  readonly decode?: Readonly<Record<string, (value: unknown) => unknown>>;
}

export interface SyncMapping {
  /** Names the system, and appears as the author of every inbound change. */
  readonly system: string;
  readonly resources: readonly ResourceMapping[];
}

/** One thing the remote says changed. */
export interface RemoteChange {
  readonly resource: string;
  /** The remote's own id. */
  readonly id: string;
  /**
   * The remote's version of this record — an etag, a sequence number, a
   * timestamp. This is what makes an echo recognisable, so a remote that has
   * none cannot be synced two-way safely and the engine says so.
   */
  readonly version: string;
  /** Absent when the record was deleted remotely. */
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly deleted?: boolean;
}

/** One thing we want the remote to do. */
export interface RemoteWrite {
  readonly resource: string;
  /** Absent when we are creating; the engine learns the id from the ack. */
  readonly id?: string;
  /** Our node id, so the ack can be matched back without guessing. */
  readonly localId: string;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly deleted?: boolean;
}

/** What the remote did with a write, and the version it produced. */
export interface RemoteAck {
  readonly localId: string;
  readonly id: string;
  readonly version: string;
  /** Set when the remote refused. The engine keeps the local state and says so. */
  readonly error?: string;
}

/**
 * The transport. Everything Google-specific, or Notion-specific, lives behind
 * these three methods.
 */
export interface RemoteSystem {
  readonly name: string;
  /**
   * Everything that changed since `cursor`, and a new cursor. A remote with
   * no incremental API returns everything and a constant cursor; the engine
   * still behaves, it just does more work.
   */
  pull(cursor?: string): Promise<{
    readonly changes: readonly RemoteChange[];
    readonly cursor: string;
  }>;
  push(writes: readonly RemoteWrite[]): Promise<readonly RemoteAck[]>;
}

/** What the engine remembers between runs. */
export interface SyncState {
  readonly cursor?: string;
  /** Local id → what the remote knows about it. */
  readonly links: Readonly<Record<string, RemoteLink>>;
  /** Writes that have not reached the remote yet. */
  readonly outbox: readonly RemoteWrite[];
}

export interface RemoteLink {
  readonly resource: string;
  readonly id: string;
  /**
   * The last version WE caused. An inbound change carrying this version is
   * our own write coming back, and re-applying it is how a naive two-way sync
   * starts a loop.
   */
  readonly version: string;
  /** The mapped values as of that version, so a genuine conflict is detectable. */
  readonly fields: Readonly<Record<string, unknown>>;
}

export const EMPTY_SYNC_STATE: SyncState = { links: {}, outbox: [] };

/** The author every inbound change is attributed to. */
export function systemAuthor(system: string): Author {
  return { kind: "system", id: system };
}
