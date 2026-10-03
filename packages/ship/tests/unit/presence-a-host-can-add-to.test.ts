import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, type Policy, type Presence, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  announcePresence,
  createStoreHandler,
  LIVE_PATH,
  liveProtocol,
  presenceFrom,
  visitorPresence,
  type LiveServerMessage,
  type LiveSocketState,
} from "../../src/runtime.js";

/**
 * PRESENCE A HOST CAN ADD TO (FR-47).
 *
 * Who is here held only sockets and pollers. An agent acting for Ada over
 * MCP or an RPC has neither, so "Claude, for Ada" — the collaboration
 * people notice — never appeared in the room while it worked. A presence
 * now says its kind and, for an agent, whom it acts for; a host announces
 * a visitor without a socket for as long as it chooses; a socket is told
 * its own key in the welcome; and every one of those is built by the
 * server from the seat, never taken from what a client claims.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean() }), plural: "Tasks" });
const schema = createSchema([person, task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const policy: Policy = {
  grants: [{ roles: ["member", "staff"], mutations: "*" }],
  sees: [
    { roles: "*", kinds: ["task"] },
    { roles: ["staff"], kinds: ["person"] },
    { roles: ["member"], kinds: ["person"], own: true },
  ],
};
const app = defineApp({ name: "room", schema, mutations: [finish], policy, version: 1 });
const snapshot = {
  nodes: [
    { id: "person:ada", kind: "person", label: "Ada" },
    { id: "person:bo", kind: "person", label: "Bo" },
    { id: "t1", kind: "task", label: "Book the hall", done: false },
    { id: "t2", kind: "task", label: "Pay", done: false },
  ],
  edges: [],
};
const ada: Principal = { kind: "human", id: "person:ada", name: "Ada", roles: ["member"] };
const bo: Principal = { kind: "human", id: "person:bo", name: "Bo", roles: ["member"] };
const rhian: Principal = { kind: "human", id: "staff:rhian", name: "Rhian", roles: ["staff"] };
const claude: Principal = { kind: "agent", id: "claude", name: "Claude", roles: ["member"], onBehalfOf: ada };
const SEATS: Record<string, Principal> = { ada, bo, rhian, claude };

const at = (path: string, who: string, init: RequestInit = {}) => new Request(`https://room.example${path}`, { ...init, headers: { authorization: who } });
const seatOf = (request: Request) => SEATS[request.headers.get("authorization") ?? ""] ?? bo;
const room = () => new Store({ schema, mutations: [finish], policy, snapshot: snapshot as never });
const tick = () => new Promise((settle) => setTimeout(settle, 1));

type Heard = LiveServerMessage[];
async function socket(handler: Awaited<ReturnType<typeof createStoreHandler<typeof schema>>>, who: string) {
  const heard: Heard = [];
  const connection = await handler.connect(at(LIVE_PATH, who), { send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) });
  if (connection instanceof Response) throw new Error(`Refused: ${connection.status}`);
  connection.receive(JSON.stringify({ t: "hello", seq: -1 }));
  connection.receive(JSON.stringify({ t: "here", presence: { participant: `human:${who}:tab`, hue: 1, stop: "/", at: "" } }));
  for (let tries = 0; tries < 50; tries++) await tick();
  return { heard, connection, lastWho: () => (heard.filter((message) => message.t === "presence").at(-1) as Extract<LiveServerMessage, { t: "presence" }> | undefined)?.who ?? [] };
}
const agentIn = (who: readonly Presence[]) => who.find((presence) => presence.kind === "agent");

describe("an agent that acts without a socket", () => {
  it("shows in every socket's presence as the agent, for whom, while it works — and only as each seat may see the person", async () => {
    const handler = await createStoreHandler({ app, store: room(), seatOf, presenceTtlMs: 60_000 });
    const sockets = { ada: await socket(handler, "ada"), bo: await socket(handler, "bo"), rhian: await socket(handler, "rhian") };

    const posted = await handler.handle(at("/graview/ops", "claude", { method: "POST", body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }] }) }));
    expect(posted.status).toBe(200);
    for (let tries = 0; tries < 20; tries++) await tick();

    for (const seen of [sockets.ada.lastWho(), sockets.rhian.lastWho()]) {
      expect(agentIn(seen)).toMatchObject({ participant: "agent:claude:visit", kind: "agent", name: "Claude", onBehalfOf: "person:ada", onBehalfOfName: "Ada", over: "t1" });
      expect(Date.parse(agentIn(seen)!.until!)).toBeGreaterThan(Date.now());
    }
    // Bo may not see Ada's record: Claude is in the room, and for whom is not said to him.
    const bos = agentIn(sockets.bo.lastWho());
    expect(bos).toMatchObject({ participant: "agent:claude:visit", kind: "agent", name: "Claude" });
    expect(bos).not.toHaveProperty("onBehalfOf");
    expect(bos).not.toHaveProperty("onBehalfOfName");
    expect(JSON.stringify(sockets.bo.heard.filter((message) => message.t === "presence"))).not.toContain("Ada");

    // And on the poll, the same.
    const who = (await (await handler.handle(at("/graview/who", "rhian"))).json()) as { who: Presence[] };
    expect(agentIn(who.who)).toMatchObject({ name: "Claude", onBehalfOfName: "Ada" });
    await handler.close();
  });

  it("is gone when the time it was announced for has passed, without a word from anybody", async () => {
    const handler = await createStoreHandler({ app, store: room(), seatOf, announceAgents: 30 });
    await handler.handle(at("/graview/ops", "claude", { method: "POST", body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }] }) }));
    const now = (await (await handler.handle(at("/graview/who", "rhian"))).json()) as { who: Presence[] };
    expect(agentIn(now.who)?.name).toBe("Claude");
    await new Promise((settle) => setTimeout(settle, 50));
    const later = (await (await handler.handle(at("/graview/who", "rhian"))).json()) as { who: Presence[] };
    expect(agentIn(later.who)).toBeUndefined();
    await handler.close();
  });

  it("is not announced when the host says not to, and a person's call is never a visit", async () => {
    const handler = await createStoreHandler({ app, store: room(), seatOf, announceAgents: false });
    await handler.handle(at("/graview/ops", "claude", { method: "POST", body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }] }) }));
    expect(((await (await handler.handle(at("/graview/who", "rhian"))).json()) as { who: Presence[] }).who).toEqual([]);
    const on = await createStoreHandler({ app, store: room(), seatOf });
    await on.handle(at("/graview/ops", "bo", { method: "POST", body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t2" } }] }) }));
    expect(((await (await on.handle(at("/graview/who", "rhian"))).json()) as { who: Presence[] }).who).toEqual([]);
    await handler.close();
    await on.close();
  });

  it("is anybody the host announces: a polling tab, or an agent the host runs itself", async () => {
    const handler = await createStoreHandler({ app, store: room(), seatOf, presenceTtlMs: 60_000 });
    const rhians = await socket(handler, "rhian");
    handler.announce(visitorPresence(claude, { session: "rpc", stop: "/task/t2" }), 60_000);
    for (let tries = 0; tries < 5; tries++) await tick();
    expect(agentIn(rhians.lastWho())).toMatchObject({ participant: "agent:claude:rpc", name: "Claude", onBehalfOfName: "Ada", stop: "/task/t2" });
    await handler.close();
  });
});

describe("a socket knows its own key", () => {
  it("is told it in the welcome, and its here is keyed by it whatever it claims", async () => {
    const handler = await createStoreHandler({ app, store: room(), seatOf });
    const heard: Heard = [];
    const connection = await handler.connect(at(LIVE_PATH, "bo"), { send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) });
    if (connection instanceof Response) throw new Error("refused");
    connection.receive(JSON.stringify({ t: "hello", seq: -1 }));
    // Bo claims to be Ada, an agent, acting for Rhian, standing for a year.
    const year = new Date(Date.now() + 365 * 86_400_000).toISOString();
    connection.receive(
      JSON.stringify({ t: "here", presence: { participant: "human:person:ada:tab", kind: "agent", name: "Bo", onBehalfOf: "staff:rhian", onBehalfOfName: "Rhian", until: year, hue: 1, stop: "/", at: "" } }),
    );
    for (let tries = 0; tries < 50; tries++) await tick();
    const welcome = heard.find((message) => message.t === "welcome") as Extract<LiveServerMessage, { t: "welcome" }>;
    expect(welcome.participant).toMatch(/^human:person:bo:./);
    const who = (await (await handler.handle(at("/graview/who", "rhian"))).json()) as { who: Presence[] };
    expect(who.who).toHaveLength(1);
    expect(who.who[0]).toMatchObject({ participant: welcome.participant, kind: "human", name: "Bo" });
    for (const claim of ["onBehalfOf", "onBehalfOfName", "until"]) expect(who.who[0]).not.toHaveProperty(claim);
    await handler.close();
  });

  it("keeps the key across a hibernation: it is in the socket's state, and the here after the wake is keyed by it", async () => {
    const store = room();
    const heard: Heard = [];
    const send = (text: string) => heard.push(JSON.parse(text) as LiveServerMessage);
    let state: LiveSocketState = liveProtocol({ store }).open(bo, "web");
    const hello = { ...state, send };
    await liveProtocol({ store }).receive(hello, JSON.stringify({ t: "hello" }));
    state = JSON.parse(JSON.stringify({ seat: hello.seat, via: hello.via, cursor: hello.cursor, participant: hello.participant })) as LiveSocketState;
    const welcome = heard.find((message) => message.t === "welcome") as Extract<LiveServerMessage, { t: "welcome" }>;
    expect(welcome.participant).toBe(state.participant);
    const received = await liveProtocol({ store }).receive({ ...state, send }, JSON.stringify({ t: "here", presence: { participant: "human:person:ada:x", hue: 1, stop: "/", at: "" } }));
    expect(received.presence?.participant).toBe(welcome.participant);
  });
});

describe("the server builds a presence from the seat", () => {
  it("takes the kind, the name and for whom from the seat, and nothing of the sort from the claim", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    const claimed = { participant: "human:person:ada:t1", kind: "human", name: "Ada", onBehalfOf: "staff:rhian", onBehalfOfName: "Rhian", until: "2099-01-01T00:00:00Z", hue: 3, stop: "/", at: "" } as Presence;
    expect(presenceFrom(claimed, claude, now)).toEqual({ participant: "agent:claude:t1", kind: "agent", name: "Claude", onBehalfOf: "person:ada", onBehalfOfName: "Ada", hue: 3, stop: "/", at: now.toISOString() });
    expect(presenceFrom(claimed, { kind: "human", id: "person:bo", roles: ["member"] }, now)).toEqual({ participant: "human:person:bo:t1", kind: "human", name: "Ada", hue: 3, stop: "/", at: now.toISOString() });
  });
});

describe("a poller is told its own key, and may say only that it has gone", () => {
  it("answers a here with the key it holds the poller under, and refuses a leave in somebody else's name", async () => {
    const handler = await createStoreHandler({ app, store: room(), seatOf });
    const posted = (await (
      await handler.handle(at("/graview/here", "ada", { method: "POST", body: JSON.stringify({ presence: { participant: "human:person:ada:t1", hue: 1, stop: "/", at: "" } }) }))
    ).json()) as { participant: string };
    expect(posted.participant).toBe("human:person:ada:t1");
    await handler.handle(at("/graview/leave", "bo", { method: "POST", body: JSON.stringify({ participant: "human:person:ada:t1" }) }));
    const who = (await (await handler.handle(at("/graview/who", "rhian"))).json()) as { who: Presence[] };
    expect(who.who.map((presence) => presence.participant)).toEqual(["human:person:ada:t1"]);
    await handler.handle(at("/graview/leave", "ada", { method: "POST", body: JSON.stringify({ participant: "human:person:ada:t1" }) }));
    expect(((await (await handler.handle(at("/graview/who", "rhian"))).json()) as { who: Presence[] }).who).toEqual([]);
    await handler.close();
  });
});

describe("a hibernating host holds its visitors itself", () => {
  it("merges an announced visitor into who is here with an expiry, replaces it on the next call, and drops it once past", () => {
    const now = Date.parse("2026-10-03T12:00:00Z");
    const tab: Presence = { participant: "human:person:ada:t1", kind: "human", name: "Ada", hue: 1, stop: "/", at: new Date(now).toISOString() };
    let who = announcePresence([tab], visitorPresence(claude, { over: "t1" }), 5000, now);
    expect(who.map((presence) => presence.participant)).toEqual(["human:person:ada:t1", "agent:claude:visit"]);
    expect(who[1]!.until).toBe(new Date(now + 5000).toISOString());
    who = announcePresence(who, visitorPresence(claude, { over: "t2" }), 5000, now + 1000);
    expect(who.filter((presence) => presence.kind === "agent").map((presence) => [presence.over, presence.until])).toEqual([["t2", new Date(now + 6000).toISOString()]]);
    who = announcePresence(who, visitorPresence(rhian, { session: "poll" }), 5000, now + 6001);
    expect(who.map((presence) => presence.participant)).toEqual(["human:person:ada:t1", "human:staff:rhian:poll"]);
  });

  it("never tells a socket of a visitor whose time has passed, though the host still holds it", async () => {
    const store = room();
    const live = liveProtocol({ store });
    const heard: Heard = [];
    const peer = { ...live.open(rhian, "web"), send: (text: string) => heard.push(JSON.parse(text) as LiveServerMessage) };
    await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
    const gone = { ...visitorPresence(claude), until: new Date(Date.now() - 1).toISOString() };
    const standing = announcePresence([], visitorPresence(claude, { session: "rpc" }), 60_000);
    live.tell([gone, ...standing], [peer]);
    const told = heard.filter((message) => message.t === "presence").at(-1) as Extract<LiveServerMessage, { t: "presence" }>;
    expect(told.who.map((presence) => presence.participant)).toEqual(["agent:claude:rpc"]);
  });
});
