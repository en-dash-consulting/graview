/*
 * `@graview/core/rooms` — WHERE THE PEOPLE IN AN APP TALK TO EACH OTHER
 * (Graview HQ feature:f-chat-rooms).
 *
 * The declaration's `rooms`, read: each resolved with its defaults
 * (`roomsOf`), the thread a record has (`threadOf`), what was said in a
 * room or thread as a seat is served it (`messagesIn`), what a person has
 * not read (`unreadFor`) and whom a message mentions (`mentionsIn`); who may
 * read, post, edit and remove; and what the checker says of them
 * (`roomFindings`). What `defineApp` and a compiled document fold in — the
 * message kind and its three acts — is `withRooms`. An entry of its own,
 * fetched by a page that draws a room, a thread or an unread count. The
 * shapes (`AppRooms`, `RoomDeclaration`, `MessageRecord`) are on
 * `@graview/core`.
 */
export { EDIT_MESSAGE, LONGEST_MESSAGE, LONGEST_ROOM_TITLE, MESSAGE_KIND, MOST_ROOMS, POST_MESSAGE, REMOVE_MESSAGE, ROOM_ACTS, ROOMS_READ_STATE, roomKey } from "./rooms/shape.js";
export type { AppRooms, MessageRecord, RoomDeclaration } from "./rooms/shape.js";
export { isPlaceless, messageKind, roomActs, roomSights, isRoomsOwn, roomsFolded, roomsPolicy, ROOMS_GRANT, unfoldedApp, withoutTalk, withRooms, mentionsOnIn } from "./rooms/kind.js";
export { allMessages, appRooms, hasRooms, mayEdit, mayPostIn, mayReadRoom, mayRemove, mentionablesOf, mentionsIn, messagesIn, readUpToOf, roomsOf, threadOf, threadsOf, unreadFor } from "./rooms/read.js";
export type { Mentionable, ReadUpTo, ResolvedRoom, Unread } from "./rooms/read.js";
export { appRoomFindings, documentRoomFindings, roomFindings, roomWorldOfApp } from "./rooms/findings.js";
export type { RoomFinding, RoomFindingCode, RoomWorld } from "./rooms/findings.js";
export { supportContextOf, memorySupport, SUPPORT_CONTEXT_FRICTION } from "./rooms/support.js";
export type { MemorySupport, SupportContext, SupportDraft, SupportMessage, SupportReply, SupportTransport, SupportDeclaration } from "./rooms/support.js";
