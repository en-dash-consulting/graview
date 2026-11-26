import { describe, expect, it } from "vitest";
import { createSchema, declareInstallation, defineApp, defineMutation, defineNode, Store, z, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { toDocument } from "../../src/document/index.js";
import { memorySubscriptions, type SubscriptionMatch } from "../../src/index.js";
import { watchSubscriptions } from "../../src/subscriptions.js";
import { checkApp } from "../../src/check.js";
import { compileDocument } from "../../src/check.js";
import { MESSAGE_KIND, mentionablesOf, mentionsIn, messagesIn, roomsOf, threadOf, unreadFor, roomKey, isPlaceless } from "../../src/rooms.js";

/*
 * PEOPLE TALK IN THE ROOMS AN APP DECLARES (Graview HQ feature:f-chat-rooms).
 * A room is declared; what is said in it is a record of the framework's
 * `message` kind, made by `post-message`, changed by its author with
 * `edit-message` and taken out with `remove-message` — so a seat's sight,
 * the roles a room admits, history and undo hold of it as of any record.
 */

const installation = declareInstallation({ roles: ["keeper", "member", "guest"], admin: "keeper" });
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }), plural: "Tasks" });
const schema = createSchema([task, ...installation.kinds]);
const addTask = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label } as never);
  },
});

const sam: Principal = { kind: "human", id: "user:sam", name: "Sam", roles: ["member"] };
const nora: Principal = { kind: "human", id: "user:nora", name: "Nora Quinn", roles: ["keeper"] };
const gus: Principal = { kind: "human", id: "user:gus", name: "Gus", roles: ["guest"] };

const people = [
  { id: "user:sam", kind: "user", label: "Sam", email: "sam@home.test", roles: ["member"], status: "active" },
  { id: "user:nora", kind: "user", label: "Nora Quinn", email: "nora@home.test", roles: ["keeper"], status: "active" },
  { id: "user:gus", kind: "user", label: "Gus", email: "gus@home.test", roles: ["guest"], status: "active" },
];

function household(policy: GraviewApp["policy"] = installation.withPolicy({ grants: [{ roles: ["keeper", "member"], mutations: ["add-task"] }] })) {
  return defineApp({
    name: "household",
    schema,
    mutations: [addTask, ...installation.mutations] as never,
    policy,
    rooms: {
      household: { title: "Household" },
      keepers: { title: "Keepers", read: ["keeper"] },
      "task-talk": { title: "Talk about it", about: "task", moderate: ["keeper"] },
    },
  });
}

let clock = 0;
function open(app: GraviewApp<AnySchema>, tasks: readonly Record<string, unknown>[] = [{ id: "task:van", kind: "task", label: "Book the van" }]) {
  clock = 0;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations as never,
    policy: app.policy,
    now: () => `2026-11-26T10:00:${String(clock++).padStart(2, "0")}.000Z`,
    snapshot: { nodes: [...people, ...tasks], edges: [] } as never,
  });
}

const post = (store: Store<AnySchema>, who: Principal, args: Record<string, unknown>) => store.apply({ name: "post-message", args }, { author: who });
const said = (store: Store<AnySchema>, who: Principal, room: string, about?: string) => messagesIn(store.seenBy(who).graph as never, room, about).map((one) => `${one.authorName}: ${one.body}`);

describe("a declared room", () => {
  it("brings the message kind and its three acts, and the declaration gives them back without", () => {
    const app = household();
    expect(app.schema.kinds).toContain(MESSAGE_KIND);
    expect(isPlaceless(app.schema.tryDefinition(MESSAGE_KIND))).toBe(true);
    expect((app.mutations ?? []).map((one) => one.name)).toEqual(expect.arrayContaining(["post-message", "edit-message", "remove-message"]));
    const { document } = toDocument(app as never);
    expect(Object.keys(document.kinds)).not.toContain(MESSAGE_KIND);
    expect(Object.keys(document.acts ?? {})).not.toContain("post-message");
    expect(Object.keys(document.rooms ?? {})).toEqual(["household", "keepers", "task-talk"]);
  });

  it("is read with its defaults, and a record of the kind it is about has its thread", () => {
    const app = household();
    expect(roomsOf(app).map((room) => [room.id, room.mentions])).toEqual([["household", true], ["keepers", true], ["task-talk", true]]);
    expect(threadOf(app, { kind: "task" })?.id).toBe("task-talk");
    expect(threadOf(app, { kind: "user" })).toBeUndefined();
  });

  it("is stood on no list or district: its messages are read in their room", () => {
    const store = open(household());
    expect(store.kindsKeptFrom(sam).has(MESSAGE_KIND)).toBe(true);
  });
});

describe("two people in a room", () => {
  it("each see what the other said, as its author, in the order it was said", () => {
    const store = open(household());
    post(store, sam, { room: "household", body: "Who has the van keys?" });
    post(store, nora, { room: "household", body: "  On the hook by the door.  " });
    expect(said(store, sam, "household")).toEqual(["Sam: Who has the van keys?", "Nora Quinn: On the hook by the door."]);
    expect(said(store, nora, "household")).toEqual(said(store, sam, "household"));
    const [first] = messagesIn(store.graph as never, "household");
    expect(first).toMatchObject({ author: "user:sam", authorKind: "human", at: "2026-11-26T10:00:00.000Z" });
  });

  it("is refused an empty message, and a room the app does not have", () => {
    const store = open(household());
    expect(() => post(store, sam, { room: "household", body: "   " })).toThrow(/Write something/);
    expect(() => post(store, sam, { room: "attic", body: "hello" })).toThrow();
  });

  it("an agent posts as itself, within its person's roles", () => {
    const store = open(household());
    const agent: Principal = { kind: "agent", id: "agent:helper", name: "Helper", onBehalfOf: sam };
    post(store, agent, { room: "household", body: "I booked the van for Saturday." });
    expect(messagesIn(store.graph as never, "household")[0]).toMatchObject({ author: "agent:helper", authorName: "Helper", authorKind: "agent" });
    expect(() => post(store, { ...agent, onBehalfOf: gus }, { room: "keepers", body: "psst" })).toThrow(/Only a keeper may post in Keepers/);
  });
});

describe("who reads a room", () => {
  it("a room that reads only some roles is not served to anybody else, and refuses their posts", () => {
    const store = open(household());
    post(store, nora, { room: "keepers", body: "The budget is tight this month." });
    expect(said(store, nora, "keepers")).toEqual(["Nora Quinn: The budget is tight this month."]);
    expect(said(store, sam, "keepers")).toEqual([]);
    expect(store.seenBy(sam).log.all().some((op) => JSON.stringify(op).includes("budget"))).toBe(false);
    expect(() => post(store, sam, { room: "keepers", body: "can I see?" })).toThrow(/Only a keeper/);
  });

  it("a room that reads only some roles keeps everything else as it was, in an app with no sight of its own", () => {
    const store = open(household({ grants: [{ roles: "*", mutations: "*" }] }));
    expect(store.seenBy(sam).graph.getNode("task:van")).toBeDefined();
    post(store, nora, { room: "keepers", body: "Just us." });
    expect(said(store, sam, "keepers")).toEqual([]);
    expect(said(store, nora, "keepers")).toEqual(["Nora Quinn: Just us."]);
  });

  it("a thread follows the record it is on: a seat that may not see the record sees none of it", () => {
    const own = installation.withPolicy({
      grants: [{ roles: ["keeper", "member"], mutations: ["add-task"] }],
      sees: [
        { roles: ["keeper", "member"], kinds: ["task"] },
        { roles: "*", kinds: ["user"] },
      ],
    });
    const store = open(household(own));
    post(store, sam, { room: "task-talk", about: "task:van", body: "Saturday works." });
    expect(said(store, nora, "task-talk", "task:van")).toEqual(["Sam: Saturday works."]);
    expect(said(store, gus, "task-talk", "task:van")).toEqual([]);
    expect(() => post(store, gus, { room: "task-talk", about: "task:van", body: "me too" })).toThrow();
  });

  it("a thread is about one record of its kind, and an app-wide room about none", () => {
    const store = open(household());
    expect(() => post(store, sam, { room: "task-talk", body: "which one?" })).toThrow(/say which one/);
    expect(() => post(store, sam, { room: "household", about: "task:van", body: "?" })).toThrow(/whole app/);
    expect(() => post(store, sam, { room: "task-talk", about: "user:gus", body: "?" })).toThrow();
  });
});

describe("what was said", () => {
  it("is edited and removed by its author only, a moderator removes anybody's, and undo puts it back", () => {
    const store = open(household());
    post(store, sam, { room: "task-talk", about: "task:van", body: "Saturday works." });
    const [message] = messagesIn(store.graph as never, "task-talk", "task:van");
    expect(() => store.apply({ name: "edit-message", args: { id: message!.id, body: "Nora says Sunday" } }, { author: nora })).toThrow(/Only whoever said it/);
    store.apply({ name: "edit-message", args: { id: message!.id, body: "Sunday works." } }, { author: sam });
    expect(messagesIn(store.graph as never, "task-talk", "task:van")[0]).toMatchObject({ body: "Sunday works.", editedAt: expect.any(String) });
    expect(() => store.apply({ name: "remove-message", args: { id: message!.id } }, { author: gus })).toThrow(/or a keeper/);
    const removed = store.apply({ name: "remove-message", args: { id: message!.id } }, { author: nora });
    expect(messagesIn(store.graph as never, "task-talk", "task:van")[0]).toMatchObject({ body: "", removed: true });
    store.undo(removed.batch, { author: nora });
    expect(messagesIn(store.graph as never, "task-talk", "task:van")[0]).toMatchObject({ body: "Sunday works." });
    expect(messagesIn(store.graph as never, "task-talk", "task:van")[0]?.removed).toBeFalsy();
  });

  it("names the people it mentions, by whole name or a first name only one person has", () => {
    const store = open(household());
    const known = mentionablesOf(store.graph as never, store.schema);
    expect(mentionsIn("@Nora Quinn and @sam, can you?", known)).toEqual(["user:nora", "user:sam"]);
    expect(mentionsIn("@nora", known)).toEqual(["user:nora"]);
    expect(mentionsIn("mail@sam.test and @nobody", known)).toEqual([]);
  });

  it("counts what a person has not read, by room, and what names them", () => {
    const store = open(household());
    post(store, sam, { room: "household", body: "First" });
    post(store, sam, { room: "household", body: "@Nora Quinn, second" });
    post(store, nora, { room: "household", body: "Mine" });
    const known = mentionablesOf(store.graph as never, store.schema);
    const graph = store.seenBy(nora).graph as never;
    expect(unreadFor("user:nora", graph, {}, known)).toEqual({ total: 2, mentions: 1, byRoom: { household: 2 } });
    const first = messagesIn(graph, "household")[0]!;
    expect(unreadFor("user:nora", graph, { [roomKey("household")]: first.at }, known).total).toBe(1);
  });
});

describe("a mention", () => {
  it("tells the person it names, as they may read it, and never of their own", () => {
    const store = open(household());
    const told: SubscriptionMatch[] = [];
    const stop = watchSubscriptions(store, { subscriptions: memorySubscriptions(), app: "household", onSubscriptionMatch: (match) => void told.push(match) });
    post(store, sam, { room: "household", body: "@Nora Quinn can you take the van?" });
    post(store, nora, { room: "household", body: "Noted, @Nora Quinn" });
    post(store, nora, { room: "keepers", body: "@Gus is not in here" });
    stop();
    expect(told.map((match) => `${match.subscription.who.id} ${match.subscription.when.on} ${match.byName}`)).toEqual(["user:nora mentioned Sam"]);
    expect(told[0]!.records[0]).toMatchObject({ kind: "message", change: "created" });
  });
});

describe("the checker", () => {
  it("names a thread on a kind the app lacks, a role the policy does not know, a title taken twice, and the framework's kind taken", () => {
    const app = defineApp({
      name: "household",
      schema,
      mutations: [addTask, ...installation.mutations] as never,
      policy: installation.withPolicy({ grants: [{ roles: ["keeper"], mutations: ["add-task"] }] }),
      rooms: {
        talk: { title: "Talk" },
        again: { title: "talk" },
        chores: { title: "Chores", about: "chore" },
        quiet: { title: "Quiet", read: ["owner"] },
      },
    });
    const codes = checkApp(app as never).findings.filter((one) => one.code.startsWith("room")).map((one) => `${one.code} ${one.where}`);
    expect(codes).toEqual(expect.arrayContaining([`room-title-taken defineApp(…).rooms["again"].title`, `room-about-unknown defineApp(…).rooms["chores"].about`, `room-role-unknown defineApp(…).rooms["quiet"].read`]));
    const mine = defineNode("message", { fields: z.object({ label: z.string() }) });
    const taken = defineApp({ name: "x", schema: createSchema([mine]), rooms: { talk: { title: "Talk" } } });
    expect(checkApp(taken as never).findings.map((one) => one.code)).toContain("room-kind-taken");
  });

  it("judges a document's rooms at its own paths, and compiles one with the message kind", () => {
    const document = {
      format: "graview-document",
      formatVersion: 1,
      name: "doc",
      kinds: { task: { noun: "task", plural: "tasks", label: "{name}", fields: { name: { type: "string", required: true } } } },
      acts: { "add-task": { title: "Add a task", creates: "task", description: "Put a task down." } },
      rooms: { talk: { title: "Talk" }, chores: { title: "Chores", about: "chore" } },
    };
    const refused = compileDocument(document);
    expect(refused.findings.map((one) => `${one.code} ${one.path}`)).toContain("room-about-unknown rooms.chores.about");
    const compiled = compileDocument({ ...document, rooms: { talk: { title: "Talk" }, "task-talk": { title: "About it", about: "task" } } });
    expect(compiled.ok).toBe(true);
    if (compiled.ok) {
      expect(compiled.app.schema.kinds).toContain(MESSAGE_KIND);
      expect(toDocument(compiled.app).document).toEqual(compiled.document);
    }
  });
});
