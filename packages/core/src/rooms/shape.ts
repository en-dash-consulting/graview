/**
 * ROOMS: WHERE THE PEOPLE IN AN APP TALK TO EACH OTHER (Graview HQ
 * feature:f-chat-rooms).
 *
 *   rooms: {
 *     household: { title: "Household" },
 *     "task-talk": { title: "Talk about it", about: "task", mentions: true },
 *   }
 *
 * A room is declared, as a workflow is: by its address word, with a title.
 * Without `about` it is one room for the whole app; with `about: "<kind>"`
 * it is a thread on each record of that kind, drawn beside the record's
 * page. `read` and `post` name the roles that may read it and post in it,
 * and default to whoever may see the app (or the record, for a thread);
 * `moderate` names the roles that may remove anybody's message, where
 * everybody else removes only their own. `mentions` (on unless false)
 * reads `@Name` in a message as a person of the app, who is told.
 *
 * What is said in a room is a record of the framework's own kind,
 * `message` (`MESSAGE_KIND`), made, changed and removed by three acts the
 * framework adds to an app that declares a room (`post-message`,
 * `edit-message`, `remove-message`) — so sight, roles, history and undo
 * hold of a message as of any record, and an agent's seat has the acts as
 * tools. The same shape in a document (`rooms`) and in
 * `defineApp({ rooms })`; `graview check` holds each to the declaration
 * (`room-*`); `@graview/core/rooms` reads them (`roomsOf`, `threadOf`,
 * `messagesIn`, `unreadFor`, `mentionsIn`).
 */

/** One room, by its address word in `rooms`. */
export interface RoomDeclaration {
  /** What the room is called, on its page and in the bar: "Household", "Talk about it". */
  readonly title: string;
  /** A sentence under the title: what the room is for. */
  readonly description?: string;
  /** A thread on each record of this kind, rather than one room for the whole app. */
  readonly about?: string;
  /** The roles that may read it. Unsaid, whoever may see the app (or the record, for a thread). */
  readonly read?: readonly string[];
  /** The roles that may post in it. Unsaid, whoever may read it. */
  readonly post?: readonly string[];
  /** The roles that may remove anybody's message in it. Everybody else removes only their own. */
  readonly moderate?: readonly string[];
  /** Whether `@Name` in a message tells that person. On unless false. */
  readonly mentions?: boolean;
}

/** An app's rooms, by address word. */
export type AppRooms = Readonly<Record<string, RoomDeclaration>>;

/** The framework's own kind every room's messages are records of. An app that declares rooms may not declare one of its own by this name (`room-kind-taken`). */
export const MESSAGE_KIND = "message";

/** The three acts an app with rooms is given. */
export const POST_MESSAGE = "post-message";
export const EDIT_MESSAGE = "edit-message";
export const REMOVE_MESSAGE = "remove-message";
export const ROOM_ACTS = [POST_MESSAGE, EDIT_MESSAGE, REMOVE_MESSAGE] as const;

/** The module a room's kind and acts are in, so a host may turn rooms off for an installation (`enabledModules`) as it turns off any module. */
export const ROOMS_MODULE = "rooms";

/** The most an app declares, and the longest a message is: a message is talk, not a document. */
export const MOST_ROOMS = 24;
export const LONGEST_MESSAGE = 4000;
export const LONGEST_ROOM_TITLE = 60;

/** The view name a person's "read up to" markers are kept under (`ViewerState`), one key a room or thread. */
export const ROOMS_READ_STATE = "graview:rooms";

/** A message's fields, as a record of the framework's kind holds them. */
export interface MessageRecord {
  readonly id: string;
  readonly kind: typeof MESSAGE_KIND;
  /** The room's address word. */
  readonly room: string;
  /** The record a thread is on; none in an app-wide room. */
  readonly about?: string;
  /** What was said, in markdown-lite: paragraphs, `*emphasis*`, `**strong**`, `code`, links. Empty once removed. */
  readonly body: string;
  /** Who said it: the acting seat's id (a person, or an agent posting as itself). */
  readonly author: string;
  /** The author's name as it was when they posted, for a reader who cannot look them up. */
  readonly authorName?: string;
  /** `human`, `agent`, `system`: who the author was. */
  readonly authorKind?: string;
  /** When it was said, an ISO instant. */
  readonly at: string;
  /** The message it answers, in the same room or thread. */
  readonly replyTo?: string;
  /** When it was last changed, if it was. */
  readonly editedAt?: string;
  /** Taken out: the body is gone and the message says so where it stood. */
  readonly removed?: boolean;
}

/** Where a room's messages are, said as one key: the room alone, or the room and the record a thread is on. */
export const roomKey = (room: string, about?: string): string => (about ? `${room}@${about}` : room);
