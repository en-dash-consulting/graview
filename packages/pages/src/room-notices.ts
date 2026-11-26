import { excerpt, labelOf, recordPath, roomsOfSchema, type AnySchema, type Principal, type Store } from "@graview/core";
import { mentionablesOf, mentionsIn, messagesIn, roomsOf, unreadFor, mayReadRoom } from "@graview/core/rooms";

/*
 * WHAT IS NEW IN THE ROOMS, AS THE BELL SAYS IT (Graview HQ
 * feature:f-chat-rooms): one notice a room or thread with something this
 * person has not read — "2 new in Household", with the last thing said —
 * an Update with the bell's dot, and a notice that Needs you, counted on
 * the bell, where somebody named you. Fetched once the app has rooms.
 */

export interface RoomNotice {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly at?: string;
  /** Where it opens, on the routed face: `/~rooms/<room>`, or the record's own page. */
  readonly path: string;
  readonly read: false;
  readonly needs?: true;
}

export function roomNotices(store: Store<AnySchema>, principal: Principal, readUpTo: Readonly<Record<string, string>>): readonly RoomNotice[] {
  const declared = roomsOfSchema(store.schema);
  if (!declared) return [];
  const rooms = roomsOf({ rooms: declared }).filter((room) => mayReadRoom(room, principal.roles));
  const graph = store.graph as never;
  const people = mentionablesOf(graph, store.schema);
  const unread = unreadFor(principal.id, graph, readUpTo, people);
  const out: RoomNotice[] = [];
  for (const [key, count] of Object.entries(unread.byRoom)) {
    const at = key.indexOf("@");
    const roomId = at < 0 ? key : key.slice(0, at);
    const about = at < 0 ? undefined : key.slice(at + 1);
    const room = rooms.find((one) => one.id === roomId);
    if (!room) continue;
    const messages = messagesIn(graph, roomId, about).filter((one) => !one.removed);
    const last = messages.at(-1);
    const fresh = messages.filter((one) => one.author !== principal.id && (readUpTo[key] === undefined || one.at > readUpTo[key]!));
    const named = principal.id !== undefined && fresh.some((one) => mentionsIn(one.body, people).includes(principal.id!));
    const record = about ? store.graph.getNode(about) : undefined;
    if (about && !record) continue;
    const where = record ? `“${labelOf(store.schema.tryDefinition(record.kind as string) as never, record as never)}”` : room.title;
    const who = (author: string) => people.find((one) => one.id === author)?.name ?? messages.find((one) => one.author === author)?.authorName ?? "Someone";
    out.push({
      id: `room:${key}`,
      title: named ? `${who(fresh.find((one) => mentionsIn(one.body, people).includes(principal.id!))!.author)} mentioned you in ${where}` : `${count} new in ${where}`,
      ...(last ? { body: `${who(last.author)}: ${excerpt(last.body, 90)}`, at: last.at } : {}),
      path: record ? recordPath(store.schema, record.kind as string, record.id) : `/~rooms/${roomId}`,
      read: false,
      ...(named ? { needs: true as const } : {}),
    });
  }
  return out.sort((a, b) => (a.at ?? "") < (b.at ?? "") ? 1 : -1);
}
