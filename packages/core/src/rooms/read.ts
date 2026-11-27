import type { GraviewApp } from "../app.js";
import { labelOf } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import { unfoldedApp } from "./kind.js";
import { MESSAGE_KIND, roomKey, type AppRooms, type MessageRecord, type RoomDeclaration } from "./shape.js";

/*
 * READING AN APP'S ROOMS (Graview HQ feature:f-chat-rooms): each with its
 * defaults, the thread a record has, what was said in a room as a seat is
 * served it, what a person has not read, and whom a message mentions. Pure:
 * every one reads the graph it is handed, so handed the seat's view
 * (`store.seenBy(principal).graph`) it says only what that seat may see.
 */

/** A room with what it leaves unsaid said: its address word, and whether it reads mentions. */
export interface ResolvedRoom extends RoomDeclaration {
  readonly id: string;
  readonly mentions: boolean;
}

/** Every room an app declares, in the order it declares them. */
export function roomsOf(app: Pick<GraviewApp<AnySchema>, "rooms">): readonly ResolvedRoom[] {
  return Object.entries(unfoldedApp(app).rooms ?? {}).map(([id, room]) => ({ ...room, id, mentions: room.mentions !== false }));
}

/** The app-wide rooms: about no one record, each a place of its own. */
export const appRooms = (app: Pick<GraviewApp<AnySchema>, "rooms">): readonly ResolvedRoom[] => roomsOf(app).filter((room) => !room.about);

/** The threads a record has: each room declared `about` its kind. */
export function threadsOf(app: Pick<GraviewApp<AnySchema>, "rooms">, record: { readonly kind: string } | undefined): readonly ResolvedRoom[] {
  return record ? roomsOf(app).filter((room) => room.about === record.kind) : [];
}

/** The thread a record has — the first room declared `about` its kind — or none. */
export const threadOf = (app: Pick<GraviewApp<AnySchema>, "rooms">, record: { readonly kind: string } | undefined): ResolvedRoom | undefined => threadsOf(app, record)[0];

/** Whether a seat holding these roles may read a room, by what the room says (its sight says it again, on the store). */
export const mayReadRoom = (room: RoomDeclaration, roles: readonly string[] | undefined): boolean => room.read === undefined || (roles ?? []).some((role) => room.read!.includes(role));

/** Whether a seat holding these roles may post in a room: its `post`, else its `read`, else anybody. */
export function mayPostIn(room: RoomDeclaration, roles: readonly string[] | undefined): boolean {
  const allowed = room.post ?? room.read;
  return allowed === undefined || (roles ?? []).some((role) => allowed.includes(role));
}

/** Whether a seat may remove a message: its own, or anybody's for a role the room lets moderate. */
export function mayRemove(room: RoomDeclaration | undefined, message: MessageRecord, seat: { readonly id?: string | undefined; readonly roles?: readonly string[] | undefined }): boolean {
  if (message.removed) return false;
  if (seat.id !== undefined && message.author === seat.id) return true;
  return room?.moderate !== undefined && (seat.roles ?? []).some((role) => room.moderate!.includes(role));
}

/** Whether a seat may edit a message: its own, and not removed. */
export const mayEdit = (message: MessageRecord, seat: { readonly id?: string | undefined }): boolean => !message.removed && seat.id !== undefined && message.author === seat.id;

/** The order messages are read in: when they were said, and by id where two were said at once. */
const inOrder = (a: MessageRecord, b: MessageRecord): number => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Every message a graph holds, in the order they were said. */
export function allMessages(graph: { nodesOfKind(kind: string): readonly unknown[] }): readonly MessageRecord[] {
  return (graph.nodesOfKind(MESSAGE_KIND) as unknown as MessageRecord[]).slice().sort(inOrder);
}

/** What was said in a room — or, with `about`, in the thread on that record — in the order it was said. */
export function messagesIn(graph: { nodesOfKind(kind: string): readonly unknown[] }, room: string, about?: string): readonly MessageRecord[] {
  return allMessages(graph).filter((message) => message.room === room && (message.about ?? undefined) === (about ?? undefined));
}

/** A person of the app, as a mention names them. */
export interface Mentionable {
  readonly id: string;
  readonly name: string;
}

/** The people a mention may name: every record of a kind that stands for the people, by its name. */
export function mentionablesOf(graph: { nodesOfKind(kind: string): readonly unknown[] }, schema: AnySchema): readonly Mentionable[] {
  return schema.definitions.flatMap((definition) =>
    (definition as { readonly people?: boolean }).people
      ? (graph.nodesOfKind(definition.kind) as ({ id: string; kind: string } & Record<string, unknown>)[]).flatMap((node) => {
          const name = labelOf(definition as never, node as never).trim();
          return name && node["status"] !== "removed" ? [{ id: node.id, name }] : [];
        })
      : [],
  );
}

const WORD = /[\p{L}\p{N}_'-]/u;

/**
 * WHOM A MESSAGE MENTIONS: each person named after an `@` — their whole
 * name, or the first word of it where only one person's name begins so —
 * case aside, each once, in the order they are first named. A word that
 * names nobody, or two people at once, mentions nobody.
 */
export function mentionsIn(body: string, people: readonly Mentionable[]): readonly string[] {
  const found: string[] = [];
  const lower = body.toLowerCase();
  const firsts = new Map<string, string[]>();
  for (const person of people) {
    const first = person.name.split(/\s+/)[0]!.toLowerCase();
    firsts.set(first, [...(firsts.get(first) ?? []), person.id]);
  }
  for (let at = lower.indexOf("@"); at >= 0; at = lower.indexOf("@", at + 1)) {
    if (at > 0 && WORD.test(lower[at - 1]!)) continue;
    const rest = lower.slice(at + 1);
    // The longest whole name first, so "@Sam Rivera" is Sam Rivera before it is anybody called Sam.
    const whole = people
      .filter((person) => rest.startsWith(person.name.toLowerCase()) && !WORD.test(rest[person.name.length] ?? " "))
      .sort((a, b) => b.name.length - a.name.length)[0];
    const word = /^[\p{L}\p{N}_'-]+/u.exec(rest)?.[0];
    const id = whole?.id ?? (word && firsts.get(word)?.length === 1 ? firsts.get(word)![0] : undefined);
    if (id !== undefined && !found.includes(id)) found.push(id);
  }
  return found;
}

/** Where a person has read up to, by room (`roomKey`): the instant of the last message they have seen there. */
export type ReadUpTo = Readonly<Record<string, string>>;

/** What a person has not read: in all, by room or thread, and how many of those name them. */
export interface Unread {
  readonly total: number;
  readonly mentions: number;
  readonly byRoom: Readonly<Record<string, number>>;
}

/**
 * WHAT A PERSON HAS NOT READ: every message in a room or thread after
 * where they read up to there, said by somebody else and not removed —
 * counted in all, by room (`roomKey`), and those that mention them.
 * Handed the graph as they are served it, it counts only what they may
 * read. A room they never opened counts from its first message.
 */
export function unreadFor(person: string | undefined, graph: { nodesOfKind(kind: string): readonly unknown[] }, readUpTo: ReadUpTo, people: readonly Mentionable[] = []): Unread {
  const byRoom: Record<string, number> = {};
  let total = 0;
  let mentions = 0;
  for (const message of allMessages(graph)) {
    if (message.removed || (person !== undefined && message.author === person)) continue;
    const key = roomKey(message.room, message.about);
    const read = readUpTo[key];
    if (read !== undefined && message.at <= read) continue;
    byRoom[key] = (byRoom[key] ?? 0) + 1;
    total++;
    if (person !== undefined && mentionsIn(message.body, people).includes(person)) mentions++;
  }
  return { total, mentions, byRoom };
}

/** The read-up-to markers a host kept for a person (`ViewerState.read(ROOMS_READ_STATE)`), only the ones that read as instants. */
export function readUpToOf(kept: Readonly<Record<string, string>> | undefined): ReadUpTo {
  return Object.fromEntries(Object.entries(kept ?? {}).filter(([, at]) => typeof at === "string" && !Number.isNaN(Date.parse(at))));
}

/** Whether rooms are declared at all: the one question a page asks before it fetches any of this. */
export const hasRooms = (app: Pick<GraviewApp<AnySchema>, "rooms">): boolean => Object.keys(unfoldedApp(app).rooms ?? {}).length > 0;

export type { AppRooms };
