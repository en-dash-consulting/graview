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
   * OUR RELATIONS kept as the remote's links: our edge's name → theirs. A
   * relation's value, on both sides, is the remote ids of the records it
   * reaches, sorted, `null` when it reaches none — so an edge is compared,
   * held in conflict, echoed and sent exactly as a field is. A record it
   * reaches is found by its remote id through the engine's `links`, which
   * may be every engine of the app; one not linked yet is held and linked
   * when it is (`SyncState.unresolved`). Inbound, a change lands through
   * `connectInbound` and `disconnectInbound`. `decode` and `encode` apply
   * by our edge's name too.
   */
  readonly edges?: Readonly<Record<string, string>>;
  /**
   * Narrows which nodes of the kind participate. A household's shifts may
   * belong on a calendar while its naps do not.
   */
  readonly match?: (node: Record<string, unknown>) => boolean;
  /**
   * Fields we will send but never accept back. Useful where the remote
   * rewrites something on save — Google normalizes a timezone — and echoing
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
  /**
   * WHAT PEOPLE TYPE IS LOOSER THAN WHAT BOTH SIDES AGREE ON. A field is
   * read through this before it is compared, sent or agreed — an address
   * with its case and its spaces, where the calendar keeps it lowercased —
   * so what comes back decoded is what went out, and a record nobody
   * changed is not sent on every pass. Keyed by OUR field name; the node
   * itself is untouched.
   */
  readonly normalize?: Readonly<Record<string, (value: unknown) => unknown>>;
  /**
   * THE REMOTE OWNS THESE. Inbound changes land; nothing here is ever sent,
   * and a local act that would write a record of the kind is refused with
   * `because` once the engine guards the store (`SyncEngine.guard`), and the
   * store's `permits` stops offering it — the
   * sentence a person reads, so it names who does own it ("sourcevision:
   * re-run the analysis to change the zones").
   */
  readonly readonly?: boolean;
  /** Why a read-only resource is not written from here, as a person reads it. */
  readonly because?: string;
  /**
   * OUR FIELD THAT HOLDS THE REMOTE'S VERSION of a record, when the graph
   * was made from the remote (a projection, an import, a seed). A node that
   * carries one and has no link is linked at it when the engine is made, so
   * the first run pushes nothing it did not have to and an unchanged pull
   * is an echo, not news.
   */
  readonly version?: string;
  /** Our field that holds the remote's id, for those links. Absent: the node's own id. */
  readonly remoteId?: string;
}

export interface SyncMapping {
  /** Names the system, and appears as the author of every inbound change. */
  readonly system: string;
  /** The system's name as a person reads it ("Google Calendar"), on what a connection says it sent; the system's id when absent. */
  readonly name?: string;
  readonly resources: readonly ResourceMapping[];
}

/** One thing the remote says changed. */
export interface RemoteChange {
  readonly resource: string;
  /** The remote's own id. */
  readonly id: string;
  /**
   * The remote's version of this record — an etag, a sequence number, a
   * timestamp. This is what makes an echo recognizable, so a remote that has
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
    /** What the transport did to the remote to keep these records, or found there, as sentences: properties it made in Notion, one of another type it left. */
    readonly said?: readonly string[];
  }>;
  push(writes: readonly RemoteWrite[]): Promise<readonly RemoteAck[]>;
}

/**
 * THE FORMAT A SYNC STATE IS WRITTEN IN. A host keeps a `SyncState` between
 * runs — a file, a row — so it is a stored format like a snapshot: stamped
 * with the format this build writes, and refused by a build that reads an
 * older one (`NewerFormatError`) rather than run on links it would misread.
 * A state without a stamp, written before it existed, is format 1.
 */
export const SYNC_STATE_FORMAT = 1;

/** What the engine remembers between runs. */
export interface SyncState {
  /** The format it was written in (`SYNC_STATE_FORMAT`); absent on a state written before stamps, which is format 1. */
  readonly format?: number;
  readonly cursor?: string;
  /** Local id → what the remote knows about it. */
  readonly links: Readonly<Record<string, RemoteLink>>;
  /** Writes that have not reached the remote yet. */
  readonly outbox: readonly RemoteWrite[];
  /**
   * Conflicts waiting for somebody to choose (the `report` policy). A field
   * held here is not sent until `resolve` says which side stands.
   */
  readonly conflicts?: readonly SyncConflict[];
  /** Records the remote deleted that were kept here: no longer linked, and not sent again as new. */
  readonly gone?: readonly string[];
  /**
   * LINKS NOT MADE YET: by our id and edge, the remote ids a relation there
   * reaches that no engine has linked to a record here yet (their table not
   * read yet). They count as part of the relation's value, so nothing is
   * sent to take them away, and each is linked here once its record is.
   */
  readonly unresolved?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  /**
   * RECORDS THERE THAT COULD NOT BECOME ONE HERE: by `<resource>:<id>`, the
   * version this store refused to make a record of (a blank row in Notion,
   * with no name and no date). Said once, in `refused`, and not tried again
   * until the remote's version of it changes.
   */
  readonly skipped?: Readonly<Record<string, string>>;
  /**
   * WHAT THE CONNECTION LAST DID WITH EACH RECORD'S GUESTS (Roadmap
   * f-sync-guest-changes-in-history), by our id: the addresses its last
   * write that reached the remote said, and the last write with guests the
   * remote refused or the connection held (a record over `max`) — kept so
   * a refusal is said once in the history, and read back by `guestsOf`.
   */
  readonly guests?: Readonly<Record<string, GuestsKept>>;
  /** The last pass, as `connectionStatus` reads it: when, and what it did. */
  readonly lastPass?: PassKept;
}

/** What a connection last did with one record's guests. */
export interface GuestsKept {
  /** The addresses the last write that reached the remote invited, sorted; when, and whether the remote mailed them (`notify`). */
  readonly sent?: { readonly addresses: readonly string[]; readonly notified: boolean; readonly at: string };
  /** The last write with guests that did not go: the addresses it would have sent, why, and when. Gone once one goes. */
  readonly refused?: { readonly addresses: readonly string[]; readonly error: string; readonly at: string };
}

/** One pass, kept: when it ran, whether it reached the remote, and how many of each thing it did. */
export interface PassKept {
  readonly at: string;
  readonly offline: boolean;
  /** What the remote said when it could not be reached. */
  readonly problem?: string;
  readonly applied: number;
  readonly pushed: number;
  readonly queued: number;
  readonly conflicts: number;
  /** What did not land, and why, as the report said it. */
  readonly refused: readonly { readonly localId: string; readonly error: string }[];
  /** Guests invited and taken off, counted across records. */
  readonly invited: number;
  readonly removed: number;
}

/**
 * WHERE A RECORD IS, BY EITHER ID, across every engine of an app: what a
 * relation kept in step resolves through, since the records it reaches may
 * be another connection's. An engine given none resolves through its own
 * links alone.
 */
export interface LinkResolver {
  /** The remote's id of our record, if some engine linked it. */
  remoteId(localId: string): string | undefined;
  /** Our id of the remote's record, if some engine linked it. */
  localId(remoteId: string): string | undefined;
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

/**
 * WHAT A CONFLICT BECOMES, decided once for the engine: `report` holds both
 * sides and sends neither until somebody chooses (`resolve`); `theirs` takes
 * the remote's value through the ordinary inbound act; `ours` keeps ours and
 * sends it. Every one of them is said in the report.
 */
export type ConflictPolicy = "report" | "theirs" | "ours";

/** One field, changed on both sides since the last time they agreed. */
export interface FieldConflict {
  readonly localId: string;
  readonly field: string;
  readonly ours: unknown;
  readonly theirs: unknown;
  /** What both sides last agreed it was. */
  readonly base: unknown;
  readonly deleted?: undefined;
}

/**
 * A RECORD DELETED HERE THAT THE REMOTE EDITED since they last agreed.
 * Neither the delete nor the edit is the engine's to drop: taking theirs
 * restores the record with the remote's values (through `createInbound`),
 * taking ours sends the delete.
 */
export interface DeletedConflict {
  readonly localId: string;
  readonly deleted: true;
  /** The remote's record now, in our field names. */
  readonly theirs: Readonly<Record<string, unknown>>;
  /** What both sides last agreed the record held. */
  readonly base: Readonly<Record<string, unknown>>;
  readonly field?: undefined;
  readonly ours?: undefined;
}

/** What both sides changed since they last agreed: one field, or a record deleted here and edited there. */
export type SyncConflict = FieldConflict | DeletedConflict;
