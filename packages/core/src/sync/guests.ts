import type { LinkResolver } from "./types.js";

/*
 * THE GUESTS OF AN EVENT (Roadmap f-calendar-guests-mapping): the
 * arithmetic between a record's people and Google's `attendees`, in one
 * place. An address is kept lowercased and trimmed, once. A person is known
 * to the calendar by their GUEST KEY — every address of theirs, sorted and
 * joined with "," — so a person with two addresses is one guest who gets
 * two attendees, and an attendee whose address is one of a person's is
 * that person. A person is a guest only while their Invite me toggle is on:
 * without it, or without an address, they have no key, so they are never
 * sent and an attendee is never matched to them. An attendee matching
 * nobody keeps its address as its key, which is why nothing the calendar
 * says is ever dropped: the engine holds it (`SyncState.unresolved`) and
 * sends it back as it was.
 */

/** One of Google's attendees, as it sends them. */
export interface Attendee {
  readonly email?: string;
  readonly responseStatus?: string;
  readonly organizer?: boolean;
  readonly self?: boolean;
  readonly resource?: boolean;
}

/** One address as the calendar compares it: lowercased and trimmed; undefined when it is not one. */
export function address(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const one = value.trim().toLowerCase();
  return one.includes("@") ? one : undefined;
}

/** The addresses a value holds — a list of them, or one — lowercased, once each, sorted. */
export function addressesOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map(address).filter((one): one is string => one !== undefined))].sort();
}

/** A person's guest key from their addresses; undefined without one. */
export const guestKey = (addresses: readonly string[]): string | undefined => (addresses.length > 0 ? addresses.join(",") : undefined);

/** The addresses a key says — one address, or several joined with ",". */
export const addressesOfKey = (key: string): string[] => addressesOf(key.split(","));

/** Google's attendees from keys and addresses, a list or one: each address once, sorted. A key and a bare address holding the same address make one attendee. */
export function attendeesOf(value: unknown): Attendee[] {
  const keys = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  return addressesOf(keys.flatMap((key) => (typeof key === "string" ? key.split(",") : []))).map((email) => ({ email }));
}

/** The addresses Google's attendees carry, lowercased, once each, sorted. */
export function addressesOfAttendees(value: unknown): string[] {
  return Array.isArray(value) ? addressesOf(value.map((attendee) => (attendee as Attendee | null)?.email)) : [];
}

/** The graph a guest book reads: a record by id, and every record. */
export interface GuestGraph {
  getNode(id: string): unknown;
  allNodes(): readonly unknown[];
}

export interface GuestBookOptions {
  /** Where the people are read, live. Absent (a mapping read without a store), nobody is a guest and every attendee keeps its address. */
  readonly graph?: GuestGraph;
  /** The kinds the relation reaches: a person of another kind is not a guest. */
  readonly kinds: readonly string[];
  /** The reached kind's field holding a person's addresses: a list of them, or one email. */
  readonly emails: string;
  /** The reached kind's Invite me toggle; `false` when the app has none and every address is invited. */
  readonly invite: string | false;
}

/**
 * WHO MAY BE A GUEST, as the engine's `links` for the relation: a person's
 * remote id is their guest key, and a key (or one address) finds the person
 * who holds any address of it, with Invite me on. Read live, so a toggle
 * turned on links an attendee held since before it was.
 */
export function guestBook(options: GuestBookOptions): LinkResolver {
  const kinds = new Set(options.kinds);
  const invited = (node: Record<string, unknown>): boolean => kinds.has(String(node["kind"])) && (options.invite === false || node[options.invite] === true);
  const keyOf = (node: Record<string, unknown>): string | undefined => (invited(node) ? guestKey(addressesOf(node[options.emails])) : undefined);
  return {
    remoteId(localId) {
      const node = options.graph?.getNode(localId) as Record<string, unknown> | undefined;
      return node ? keyOf(node) : undefined;
    },
    localId(key) {
      const wanted = addressesOfKey(key);
      if (wanted.length === 0 || !options.graph) return undefined;
      for (const raw of options.graph.allNodes()) {
        const node = raw as Record<string, unknown>;
        if (!invited(node)) continue;
        const held = addressesOf(node[options.emails]);
        if (held.some((one) => wanted.includes(one))) return String(node["id"]);
      }
      return undefined;
    },
  };
}
