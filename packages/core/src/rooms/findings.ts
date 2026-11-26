import type { GraviewApp } from "../app.js";
import type { AnySchema } from "../schema/schema.js";
import { rolesOf } from "../permissions/policy.js";
import type { Policy } from "../permissions/types.js";
import { unfoldedApp } from "./kind.js";
import { LONGEST_ROOM_TITLE, MESSAGE_KIND, MOST_ROOMS, ROOM_ACTS, type AppRooms } from "./shape.js";

/*
 * AN APP'S ROOMS, JUDGED (Graview HQ feature:f-chat-rooms), in one
 * vocabulary for a document and a TypeScript app: each room has an address
 * word and a title of its own, a thread is on a kind the app has, the
 * roles it names are roles the policy knows, and the framework's kind and
 * acts are not taken by the app's own.
 *
 * Codes, each an error unless said: `room-id`, `room-title-missing`,
 * `room-title-taken`, `room-title-long` (a warning), `room-about-unknown`,
 * `room-role-unknown`, `room-post-not-read` (a warning: a role that may
 * post but not read posts blind), `room-kind-taken`, `room-act-taken`,
 * `rooms-too-many`, `room-mentions-nobody` (a note).
 */

export type RoomFindingCode =
  | "room-id"
  | "room-title-missing"
  | "room-title-taken"
  | "room-title-long"
  | "room-about-unknown"
  | "room-role-unknown"
  | "room-post-not-read"
  | "room-kind-taken"
  | "room-act-taken"
  | "rooms-too-many"
  | "room-mentions-nobody";

export interface RoomFinding {
  readonly code: RoomFindingCode;
  readonly severity: "error" | "warning" | "note";
  /** Which room, by its address word; none for what is wrong with them all. */
  readonly room?: string;
  /** Which of its keys. */
  readonly key?: "title" | "about" | "read" | "post" | "moderate" | "mentions";
  readonly message: string;
  readonly fix: string;
}

/** What rooms are judged against: the kinds the app declares itself, its roles, its acts, and the titles its places stand under. */
export interface RoomWorld {
  readonly kinds: readonly string[];
  /** The roles the policy knows; undefined where the app has no policy, and any role is one a seat may hold. */
  readonly roles?: readonly string[] | undefined;
  readonly acts: readonly string[];
  /** Whether a kind stands for the people, so a mention names somebody. */
  readonly people: boolean;
  /** The titles the app's own places stand under (its lists and named views), lowercased. */
  readonly titles?: readonly string[];
}

const ADDRESS = /^[a-z][a-z0-9-]*$/;
const quoted = (names: Iterable<string>): string => [...names].map((name) => `"${name}"`).join(", ") || "none";

/** Every finding about an app's rooms, in the order they stand. */
export function roomFindings(rooms: AppRooms | undefined, world: RoomWorld): RoomFinding[] {
  const out: RoomFinding[] = [];
  const entries = Object.entries(rooms ?? {});
  if (entries.length === 0) return out;
  if (entries.length > MOST_ROOMS) out.push({ code: "rooms-too-many", severity: "error", message: `The app declares ${entries.length} rooms; it may declare ${MOST_ROOMS}.`, fix: "Keep the rooms people talk in; a thread on a kind is one room however many records it is on." });
  if (world.kinds.includes(MESSAGE_KIND)) out.push({ code: "room-kind-taken", severity: "error", message: `The app declares a kind "${MESSAGE_KIND}", the name of the framework's own kind a room's messages are records of.`, fix: `Give your kind another name, or drop it and keep what is said in a room.` });
  for (const act of ROOM_ACTS) if (world.acts.includes(act)) out.push({ code: "room-act-taken", severity: "error", message: `The app declares an act "${act}", which the framework gives every app with rooms.`, fix: "Give your act another name; the framework's posts, edits and removes a room's messages." });
  const titles = new Map<string, string>();
  const known = world.roles ? new Set(world.roles) : undefined;
  for (const [id, room] of entries) {
    const said = `The room "${id}"`;
    if (!ADDRESS.test(id)) out.push({ code: "room-id", severity: "error", room: id, message: `${said} is not an address word: lowercase letters, digits and hyphens, starting with a letter.`, fix: `Name it like "${id.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^[^a-z]+/, "") || "talk"}".` });
    const title = typeof room?.title === "string" ? room.title.trim() : "";
    if (!title) {
      out.push({ code: "room-title-missing", severity: "error", room: id, key: "title", message: `${said} has no title, so nobody could tell where they are talking.`, fix: `Give it a title: "title": "Household".` });
    } else {
      const lower = title.toLowerCase();
      const first = titles.get(lower);
      if (first !== undefined) out.push({ code: "room-title-taken", severity: "error", room: id, key: "title", message: `${said} is titled "${title}", as the room "${first}" is, so a reader could not tell them apart.`, fix: "Give one of them another title." });
      else if (world.titles?.includes(lower)) out.push({ code: "room-title-taken", severity: "error", room: id, key: "title", message: `${said} is titled "${title}", which one of the app's places is already called.`, fix: "Give the room a title that says it is where people talk." });
      else titles.set(lower, id);
      if (title.length > LONGEST_ROOM_TITLE) out.push({ code: "room-title-long", severity: "warning", room: id, key: "title", message: `${said} has a title of ${title.length} characters; a title past ${LONGEST_ROOM_TITLE} is cut on a phone's bar.`, fix: "Say it in fewer words, and the rest in its description." });
    }
    if (room?.about !== undefined && (!world.kinds.includes(room.about) || room.about === MESSAGE_KIND)) {
      out.push({ code: "room-about-unknown", severity: "error", room: id, key: "about", message: `${said} is a thread on each "${room.about}", which is not a kind of this app.`, fix: `Name one of its kinds: ${quoted(world.kinds.filter((kind) => kind !== MESSAGE_KIND))}, or drop "about" for one room for the whole app.` });
    }
    for (const key of ["read", "post", "moderate"] as const) {
      const roles = room?.[key];
      if (roles === undefined) continue;
      if (!Array.isArray(roles) || roles.length === 0) {
        out.push({ code: "room-role-unknown", severity: "error", room: id, key, message: `${said} says ${key} is ${JSON.stringify(roles)}, which names no role.`, fix: `List the roles, or drop "${key}" for ${key === "moderate" ? "nobody but each message's author" : "everybody who may see the app"}.` });
        continue;
      }
      const strangers = known ? roles.filter((role) => !known.has(role)) : [];
      if (strangers.length > 0) out.push({ code: "room-role-unknown", severity: "error", room: id, key, message: `${said} lets ${quoted(strangers)} ${key}, ${strangers.length === 1 ? "a role" : "roles"} the policy does not know.`, fix: `Name the policy's roles: ${quoted(known ?? [])}.` });
    }
    if (room?.post && room.read) {
      const blind = room.post.filter((role) => !room.read!.includes(role));
      if (blind.length > 0) out.push({ code: "room-post-not-read", severity: "warning", room: id, key: "post", message: `${said} lets ${quoted(blind)} post but not read, so they would post into a room they cannot see.`, fix: `Add ${quoted(blind)} to "read", or take them out of "post".` });
    }
    if (room?.mentions === true && !world.people) out.push({ code: "room-mentions-nobody", severity: "note", room: id, key: "mentions", message: `${said} reads mentions, but no kind stands for the app's people, so "@Name" tells nobody.`, fix: `Mark the kind people are with "people": true, or install the installation's people.` });
  }
  return out;
}

/** The world a TypeScript app's rooms are judged in. */
export function roomWorldOfApp(app: GraviewApp<AnySchema>): RoomWorld {
  const own = unfoldedApp(app);
  const policy = own.policy as Policy | undefined;
  return {
    kinds: own.schema.kinds as readonly string[],
    roles: policy ? rolesOf(policy) : undefined,
    acts: (own.mutations ?? []).map((mutation) => mutation.name),
    people: own.schema.definitions.some((definition) => (definition as { readonly people?: boolean }).people === true),
  };
}

/** Every finding about a TypeScript app's rooms. */
export const appRoomFindings = (app: GraviewApp<AnySchema>): RoomFinding[] => roomFindings(unfoldedApp(app).rooms, roomWorldOfApp(app));

/** Every finding about a document's rooms, judged against the document's own kinds, roles and acts. */
export function documentRoomFindings(document: { readonly rooms?: unknown; readonly kinds?: Readonly<Record<string, { readonly people?: boolean }>>; readonly acts?: Readonly<Record<string, unknown>>; readonly roles?: readonly string[]; readonly policy?: { readonly roles?: readonly string[]; readonly grants?: readonly { readonly roles: readonly string[] | "*" }[] } }): { readonly severity: "error" | "warning" | "note"; readonly code: string; readonly path: string; readonly message: string; readonly fix: string }[] {
  const rooms = document.rooms as AppRooms | undefined;
  if (!rooms || typeof rooms !== "object") return [];
  const policy = document.policy;
  const roles = document.roles ?? policy?.roles ?? (policy ? [...new Set((policy.grants ?? []).flatMap((grant) => (grant.roles === "*" ? [] : grant.roles)))] : undefined);
  const findings = roomFindings(rooms, {
    kinds: Object.keys(document.kinds ?? {}),
    roles,
    acts: Object.keys(document.acts ?? {}),
    people: Object.values(document.kinds ?? {}).some((kind) => kind?.people === true),
  });
  return findings.map((finding) => ({
    severity: finding.severity,
    code: finding.code,
    path: finding.room === undefined ? "rooms" : `rooms.${finding.room}${finding.key ? `.${finding.key}` : ""}`,
    message: finding.message,
    fix: finding.fix,
  }));
}
