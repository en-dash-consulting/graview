import type { ConnectionSpec } from "../document/connection-spec.js";
import { addressesOf, attendeesOf } from "./guests.js";
import type { GuestsKept, PassKept, SyncState } from "./types.js";

/*
 * WHAT A CONNECTION KEPT, READ BACK (Roadmap f-sync-guest-changes-in-history,
 * request:read-an-events-guests-back): pure functions over the state a host
 * keeps between passes (`engine.snapshot`) and the declaration, so a host —
 * an agent's tool, a Connections page — can say what a pass last did and
 * whom an event invites without running one. On `@graview/core/sync`, which
 * no page carries.
 */

/** One synced record's guests, as the connection last knew them. */
export interface RecordGuests {
  readonly localId: string;
  /** The remote's id of the record (an event's), once linked. */
  readonly remoteId?: string;
  /**
   * Every attendee address both sides last agreed the record has — at the
   * last pull or the last write that went — sorted: the people invited from
   * here, those added there, and the organizer the calendar adds.
   */
  readonly attendees: readonly string[];
  /** Of those, the addresses that match nobody here (no person holds them, or theirs has Invite me off), kept and sent back as they came. */
  readonly unmatched: readonly string[];
  /** The addresses the last write that reached the remote said, when it was sent, and whether the remote mailed them (false: quiet). */
  readonly sent?: GuestsKept["sent"];
  /** The last write with guests that did not go, and why, while it has not gone since. */
  readonly refused?: GuestsKept["refused"];
}

/** The field or relation a declaration keeps the guests in, or undefined when it keeps none. */
function guestsField(declaration: ConnectionSpec): string | undefined {
  if (declaration.system !== "google-calendar") return undefined;
  const guests = declaration.fields.guests;
  return guests === undefined ? undefined : typeof guests === "string" ? guests : guests.via;
}

/**
 * ONE RECORD'S GUESTS, AS THE CONNECTION KEPT THEM: the addresses agreed
 * with the calendar, those matching nobody here, what the last write sent
 * (and whether quietly), and the last refusal. Undefined when the
 * connection keeps no guests, or knows nothing of the record.
 */
export function guestsOf(state: SyncState, declaration: ConnectionSpec, localId: string): RecordGuests | undefined {
  const field = guestsField(declaration);
  if (field === undefined) return undefined;
  const link = state.links[localId];
  const kept = state.guests?.[localId];
  if (!link && !kept) return undefined;
  // A relation's value holds guest keys (a person's addresses joined with ","); a field's, addresses.
  const attendees = link ? attendeesOf(link.fields[field]).map((one) => one.email!) : [];
  return {
    localId,
    ...(link ? { remoteId: link.id } : {}),
    attendees,
    unmatched: addressesOf(state.unresolved?.[localId]?.[field] ?? []),
    ...(kept?.sent ? { sent: kept.sent } : {}),
    ...(kept?.refused ? { refused: kept.refused } : {}),
  };
}

/** A connection as a host reads it back: its last pass, what it holds, and every record's guests. */
export interface ConnectionStatus {
  /** When the last pass ran and what it did; absent before the first (or on a state kept before it was). */
  readonly lastPass?: PassKept;
  /** Records linked to the remote's. */
  readonly linked: number;
  /** Writes waiting for the remote to be reached. */
  readonly waiting: number;
  /** Fields held for somebody to choose. */
  readonly conflicts: number;
  /** Each record's guests, for a connection that keeps them; empty otherwise. */
  readonly guests: readonly RecordGuests[];
}

/** WHAT A CONNECTION LAST DID AND HOLDS, from its kept state alone. */
export function connectionStatus(state: SyncState, declaration: ConnectionSpec): ConnectionStatus {
  const ids = [...new Set([...Object.keys(state.links), ...Object.keys(state.guests ?? {})])].sort();
  return {
    ...(state.lastPass ? { lastPass: state.lastPass } : {}),
    linked: Object.keys(state.links).length,
    waiting: state.outbox.length,
    conflicts: state.conflicts?.length ?? 0,
    guests: guestsField(declaration) === undefined ? [] : ids.map((id) => guestsOf(state, declaration, id)).filter((one): one is RecordGuests => one !== undefined),
  };
}
