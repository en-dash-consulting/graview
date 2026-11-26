import * as z from "../schema/zod.js";
// The type defineMutation reads an input by; the runtime is zod/mini.
import type { ZodType as ClassicType } from "zod";
import type { GraviewApp } from "../app.js";
import { defineMutation } from "../mutations/define-mutation.js";
import { refTo } from "../mutations/node-ref.js";
import type { ActingSeat, AnyMutationDefinition, MutationContext } from "../mutations/types.js";
import { rolesSaid } from "../permissions/policy.js";
import type { Grant, Policy, Sight } from "../permissions/types.js";
import { ActRefusal } from "../refused.js";
import { createSchema, type AnySchema } from "../schema/schema.js";
import { defineNode, labelOf, withArticle } from "../schema/define-node.js";
import type { AnyNodeDefinition } from "../schema/types.js";
import { excerpt } from "../excerpt.js";
import { EDIT_MESSAGE, LONGEST_MESSAGE, MESSAGE_KIND, POST_MESSAGE, REMOVE_MESSAGE, ROOM_ACTS, type AppRooms, type MessageRecord, type RoomDeclaration } from "./shape.js";

/*
 * AN APP WITH ROOMS IS GIVEN WHAT THEY NEED, from the declaration alone
 * (Graview HQ feature:f-chat-rooms): the framework's `message` kind, the
 * three acts that make, change and take out a message, a grant that lets
 * whoever a room admits run them, and — where the app says who sees what —
 * a sight for each room's messages. `defineApp` folds them in, and so does
 * a compiled document, so every host that opens the app opens it with
 * them; `toDocument` gives the declaration back without them.
 */

/** The framework's own kinds, by definition: they stand on no page, list, district or export of the app's (`isPlaceless`). */
const PLACELESS = new WeakSet<object>();

/** Whether a kind's definition is the framework's own, that stands on no page of the app: a room's messages are read in their room. */
export const isPlaceless = (definition: unknown): boolean => typeof definition === "object" && definition !== null && PLACELESS.has(definition);

/** The app as its author declared it, before its rooms were folded in: what `toDocument` writes. */
const UNFOLDED = new WeakMap<object, GraviewApp<AnySchema>>();

/** The framework's own acts, grant and sights, by object: what an app copied after it was folded is told apart by. */
const FRAMEWORK = new WeakSet<object>();

/** Whether an act, a grant or a sight is one `withRooms` folded in. */
export const isRoomsOwn = (part: unknown): boolean => typeof part === "object" && part !== null && FRAMEWORK.has(part);

/**
 * THE APP BEFORE `withRooms`: the one it was folded from, or — for a copy
 * of a folded app (`{ ...app, lenses }`) — the copy without the message
 * kind, the three acts, their grant and their sights. Any other app is
 * itself.
 */
export function unfoldedApp<A extends object>(app: A): A {
  const held = UNFOLDED.get(app) as A | undefined;
  if (held) return held;
  const folded = app as unknown as GraviewApp<AnySchema>;
  if (!folded.rooms || !folded.schema?.definitions?.some(isPlaceless)) return app;
  const schema = createSchema(folded.schema.definitions.filter((definition) => !isPlaceless(definition)) as never, (folded.schema as { readonly computed?: never }).computed);
  const policy = folded.policy && { ...folded.policy, grants: folded.policy.grants.filter((grant) => !FRAMEWORK.has(grant)), ...(folded.policy.sees ? { sees: folded.policy.sees.filter((sight) => !FRAMEWORK.has(sight)) } : {}) };
  const own = { ...folded, schema, mutations: (folded.mutations ?? []).filter((act) => !FRAMEWORK.has(act)), ...(policy ? { policy: policy.sees?.length === 0 ? (({ sees: _, ...rest }) => rest)(policy) : policy } : {}) };
  UNFOLDED.set(app, own as never);
  return own as unknown as A;
}

/** Whether an app had its rooms folded in. */
export const roomsFolded = (app: object): boolean => UNFOLDED.has(app);

/** The kinds a room's thread is on, each once. */
const threadKinds = (rooms: AppRooms): string[] => [...new Set(Object.values(rooms).flatMap((room) => (room.about ? [room.about] : [])))];

/** The rooms a message kind was made for, by its definition. */
const ROOMS_OF_KIND = new WeakMap<object, AppRooms>();

/** Whether a room of the app reads `@Name` as a mention: unless it says `mentions: false`. A room the kind was not made for reads none. */
export function mentionsOnIn(schema: AnySchema, room: unknown): boolean {
  const rooms = ROOMS_OF_KIND.get(schema.tryDefinition(MESSAGE_KIND) ?? {});
  const declared = typeof room === "string" ? rooms?.[room] : undefined;
  return declared !== undefined && declared.mentions !== false;
}

/** The rooms an app's schema was given its message kind for: what a page reads them from when it holds only the store. */
export const roomsOfSchema = (schema: AnySchema): AppRooms | undefined => {
  const definition = schema.tryDefinition(MESSAGE_KIND);
  return definition ? ROOMS_OF_KIND.get(definition) : undefined;
};

/** The framework's message kind, for these rooms. */
export function messageKind(rooms: AppRooms): AnyNodeDefinition {
  const ids = Object.keys(rooms) as [string, ...string[]];
  const definition = defineNode(MESSAGE_KIND, {
    description: "Something somebody said in one of the app's rooms, or in the thread on one of its records.",
    // In zod/mini, as a compiled document's kinds are: a page that draws a room carries no classic zod.
    fields: z.object({
      room: ids.length > 0 ? z.enum(ids) : z.string(),
      about: z.optional(z.string()),
      body: z.string().check(z.maxLength(LONGEST_MESSAGE)),
      author: z.string().check(z.minLength(1)),
      authorName: z.optional(z.string()),
      authorKind: z.optional(z.string()),
      at: z.string().check(z.minLength(1)),
      replyTo: z.optional(z.string()),
      editedAt: z.optional(z.string()),
      removed: z.optional(z.boolean()),
    }) as never,
    plural: "Messages",
    display: { glance: ["body", "authorName", "at"] },
    label: (node: MessageRecord) => (node.removed ? "A removed message" : excerpt(node.body, 60) || "A message"),
    // A message is talk: kept, changed by its author, taken out by its tombstone — never archived, merged or tidied.
    archives: false,
    tidying: "never",
    fixed: { room: "A message stays in the room it was said in.", about: "A message stays on the record it was said about.", author: "A message is its author's.", authorName: "Said as they were named when they posted.", authorKind: "Said as who they were when they posted.", at: "When it was said.", replyTo: "What it answers stays what it answered." },
  });
  PLACELESS.add(definition);
  ROOMS_OF_KIND.set(definition, rooms);
  return definition as unknown as AnyNodeDefinition;
}

/** Whether a seat holding these roles is one a list of roles admits: unsaid, everybody. The system's own seat is always admitted. */
const admits = (allowed: readonly string[] | undefined, by: ActingSeat | undefined): boolean =>
  allowed === undefined || by?.kind === "system" || (by?.roles ?? []).some((role) => allowed.includes(role));

/** The room a message names, or a refusal that says which rooms there are. */
function roomNamed(rooms: AppRooms, id: string): RoomDeclaration {
  const room = rooms[id];
  if (!room) throw new ActRefusal(`There is no room "${id}" here. The rooms are: ${Object.keys(rooms).join(", ") || "none"}.`, "missing");
  return room;
}

/** The message an act names, as the seat sees it. */
function messageNamed(ctx: MutationContext<AnySchema>, id: string): MessageRecord {
  const node = ctx.graph.getNode(id) as unknown as MessageRecord | undefined;
  if (!node || node.kind !== MESSAGE_KIND) throw new ActRefusal(`There is no message "${id}" here.`, "missing");
  return node;
}

/** Whether a message is the acting seat's own: its author is the seat, or the person the seat acts as. */
const ownMessage = (ctx: MutationContext<AnySchema>, message: MessageRecord): boolean =>
  (ctx.by?.id !== undefined && message.author === ctx.by.id) || (ctx.me !== undefined && message.author === ctx.me);

/** A body as it is kept: trimmed at its ends, never empty, never longer than a message is. */
function bodyOf(body: string): string {
  const said = body.replace(/\r\n?/g, "\n").trim();
  if (said === "") throw new ActRefusal("Write something to say first.", "invalid");
  if (said.length > LONGEST_MESSAGE) throw new ActRefusal(`A message holds ${LONGEST_MESSAGE} characters; this one has ${said.length}.`, "invalid");
  return said;
}

/** The three acts of an app's rooms: post, edit your own, remove your own (or anybody's, for a role a room lets moderate). */
export function roomActs(rooms: AppRooms, schema?: AnySchema): AnyMutationDefinition<AnySchema>[] {
  const ids = Object.keys(rooms) as [string, ...string[]];
  const threads = threadKinds(rooms);
  const post = defineMutation(POST_MESSAGE, {
    title: "Post a message",
    description: "Say something in one of the app's rooms, or in the thread on a record.",
    creates: [MESSAGE_KIND],
    input: z.object({
      room: ids.length > 0 ? z.enum(ids) : z.string(),
      ...(threads.length > 0 ? { about: z.optional(refTo(threads)) } : {}),
      body: z.string().check(z.minLength(1), z.maxLength(LONGEST_MESSAGE)),
      replyTo: z.optional(refTo([MESSAGE_KIND])),
    }) as unknown as ClassicType<{ room: string; about?: string; body: string; replyTo?: string }>,
    describe: (args, graph) => {
      const room = rooms[args.room];
      const about = "about" in args && typeof args.about === "string" ? graph.getNode(args.about) : undefined;
      // The record's name as its kind says it, never its id.
      const named = about ? labelOf(schema?.tryDefinition(String((about as { kind: unknown }).kind)) as never, about as never) : undefined;
      return `Post in ${room?.title ?? args.room}${named && named !== (about as { id?: string }).id ? ` about ${named}` : ""}: ${excerpt(args.body, 60)}`;
    },
    apply(ctx, args) {
      const room = roomNamed(rooms, args.room);
      const about = "about" in args && typeof args.about === "string" && args.about !== "" ? args.about : undefined;
      if (room.about && about === undefined) throw new ActRefusal(`${room.title} is a thread on each ${room.about}: say which one this is about.`, "invalid");
      if (!room.about && about !== undefined) throw new ActRefusal(`${room.title} is one room for the whole app, about no one record.`, "invalid");
      if (about !== undefined) {
        const record = ctx.graph.getNode(about);
        if (!record || record.kind !== room.about) throw new ActRefusal(`There is no ${room.about} "${about}" here to talk about.`, "missing");
      }
      const allowed = room.post ?? room.read;
      if (!admits(allowed, ctx.by)) throw new ActRefusal(`Only ${rolesSaid(allowed!)} may post in ${room.title}.`, "forbidden");
      if (args.replyTo !== undefined) {
        const answered = messageNamed(ctx as never, args.replyTo);
        if (answered.room !== args.room || (answered.about ?? undefined) !== about) throw new ActRefusal("A reply answers a message in the same room, or the same thread.", "invalid");
      }
      const by = ctx.by;
      const author = by?.id ?? ctx.me ?? by?.kind ?? "someone";
      ctx.addNode({
        id: ctx.freshId(args.room, MESSAGE_KIND),
        kind: MESSAGE_KIND,
        room: args.room,
        ...(about !== undefined ? { about } : {}),
        body: bodyOf(args.body),
        author,
        ...(by?.name ? { authorName: by.name } : {}),
        ...(by?.kind ? { authorKind: by.kind } : {}),
        at: ctx.now ?? new Date().toISOString(),
        ...(args.replyTo !== undefined ? { replyTo: args.replyTo } : {}),
      } as never);
    },
  });
  const edit = defineMutation(EDIT_MESSAGE, {
    title: "Edit the message",
    description: "Change what you said. Only its author may.",
    subject: { kinds: [MESSAGE_KIND], arg: "id" },
    writes: ["body", "editedAt"],
    idempotent: true,
    input: z.object({ id: refTo([MESSAGE_KIND]), body: z.string().check(z.minLength(1), z.maxLength(LONGEST_MESSAGE)) }) as unknown as ClassicType<{ id: string; body: string }>,
    describe: (args) => `Edit a message: ${excerpt(args.body, 60)}`,
    apply(ctx, args) {
      const message = messageNamed(ctx as never, args.id);
      if (message.removed) throw new ActRefusal("That message was removed; there is nothing to edit.", "invalid");
      if (!ownMessage(ctx as never, message)) throw new ActRefusal("Only whoever said it may edit a message.", "forbidden");
      const body = bodyOf(args.body);
      if (body === message.body) return;
      ctx.patchNode(args.id, { body, editedAt: ctx.now ?? new Date().toISOString() });
    },
  });
  const remove = defineMutation(REMOVE_MESSAGE, {
    title: "Remove the message",
    description: "Take a message out. It says it was removed where it stood; undo puts it back.",
    subject: { kinds: [MESSAGE_KIND], arg: "id" },
    writes: ["body", "removed"],
    destructive: true,
    idempotent: true,
    input: z.object({ id: refTo([MESSAGE_KIND]) }) as unknown as ClassicType<{ id: string }>,
    describe: () => "Remove a message",
    apply(ctx, args) {
      const message = messageNamed(ctx as never, args.id);
      if (message.removed) return;
      const room = rooms[message.room];
      if (!ownMessage(ctx as never, message) && !(room?.moderate && admits(room.moderate, ctx.by))) {
        throw new ActRefusal(room?.moderate ? `Only whoever said it, or ${rolesSaid(room.moderate)}, may remove a message.` : "Only whoever said it may remove a message.", "forbidden");
      }
      ctx.patchNode(args.id, { body: "", removed: true });
    },
  });
  for (const act of [post, edit, remove]) FRAMEWORK.add(act);
  return [post, edit, remove] as unknown as AnyMutationDefinition<AnySchema>[];
}

/** The grant that lets the acts be run: each room says who it admits, and the acts hold to it. */
export const ROOMS_GRANT: Grant = {
  roles: "*",
  mutations: [...ROOM_ACTS],
  kinds: "*",
  describe: "Whoever a room lets in may post in it, and change or take out what they said.",
};
FRAMEWORK.add(ROOMS_GRANT);

/** Each room's sight over its messages: its readers, and a thread's messages only where the record is seen too. */
export function roomSights(rooms: AppRooms): Sight[] {
  return Object.entries(rooms).map(([id, room]) => framework({
    roles: room.read ?? "*",
    kinds: [MESSAGE_KIND],
    where: { field: "room", is: [id] },
    ...(room.about ? { follows: "about" } : {}),
    describe: `${room.read ? `Only ${rolesSaid(room.read)}` : "Everybody"} may read ${room.title}${room.about ? `, and only on ${withArticle(room.about)} they can see` : ""}.`,
  }));
}

/** A part of the policy the framework folded in, known as such. */
function framework<T extends object>(part: T): T {
  FRAMEWORK.add(part);
  return part;
}

/**
 * THE POLICY WITH ITS ROOMS FOLDED IN. Without a policy, nothing is kept
 * from anybody, and a room that admits everybody needs none; a room that
 * reads only some roles brings a policy that sees everything else as before.
 */
export function roomsPolicy(policy: Policy | undefined, rooms: AppRooms, kinds: readonly string[]): Policy | undefined {
  const restricted = Object.values(rooms).some((room) => room.read !== undefined);
  if (!policy && !restricted) return undefined;
  const base: Policy = policy ?? { grants: [framework({ roles: "*", mutations: "*", describe: "Everybody may do everything here." } as Grant)] };
  const grants = base.grants.some((grant) => grant === ROOMS_GRANT) ? base.grants : [...base.grants, ROOMS_GRANT];
  const sights = base.sees?.length ? base.sees : restricted ? [framework({ roles: "*", kinds: kinds.filter((kind) => kind !== MESSAGE_KIND), describe: "Everybody sees everything else here." } as Sight)] : undefined;
  return { ...base, grants, ...(sights ? { sees: [...sights.filter((sight) => !sight.kinds.includes(MESSAGE_KIND)), ...roomSights(rooms)] } : {}) };
}

/**
 * FOLD AN APP'S ROOMS IN: its schema with the message kind, its acts with
 * the three, its policy with their grant and sights. An app without rooms,
 * one already folded, and one that declares a `message` kind of its own
 * (which `graview check` refuses, `room-kind-taken`) come back as they are.
 */
export function withRooms<A extends GraviewApp<AnySchema>>(app: A): A {
  const rooms = app.rooms;
  if (!rooms || Object.keys(rooms).length === 0 || UNFOLDED.has(app)) return app;
  if (app.schema.tryDefinition(MESSAGE_KIND)) return app;
  const kind = messageKind(rooms);
  const schema = createSchema([...app.schema.definitions, kind] as never, (app.schema as { readonly computed?: never }).computed) as unknown as A["schema"];
  const taken = new Set((app.mutations ?? []).map((mutation) => mutation.name));
  const acts = roomActs(rooms, schema as AnySchema).filter((act) => !taken.has(act.name));
  const policy = roomsPolicy(app.policy, rooms, schema.kinds as readonly string[]);
  const folded = { ...app, schema, mutations: [...(app.mutations ?? []), ...acts], ...(policy ? { policy } : {}) } as A;
  UNFOLDED.set(folded, app);
  return folded;
}

/**
 * A SNAPSHOT WITHOUT ITS TALK: every message taken out, for a copy that is
 * not this app's own history — a template, a remix, an export for
 * strangers. What people said to each other stays with the app it was said
 * in.
 */
export function withoutTalk<T extends { readonly nodes: readonly { readonly id: string; readonly kind: string }[]; readonly edges: readonly { readonly from: string; readonly to: string }[] }>(snapshot: T): T {
  const talk = new Set(snapshot.nodes.filter((node) => node.kind === MESSAGE_KIND).map((node) => node.id));
  if (talk.size === 0) return snapshot;
  return { ...snapshot, nodes: snapshot.nodes.filter((node) => !talk.has(node.id)), edges: snapshot.edges.filter((edge) => !talk.has(edge.from) && !talk.has(edge.to)) };
}
