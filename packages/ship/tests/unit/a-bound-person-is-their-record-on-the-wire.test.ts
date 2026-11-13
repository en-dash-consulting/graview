import { bindSchema, createSchema, defineApp, defineNode, Store, type AnySchema, type Operation, type Principal } from "@graview/core";
import { bindPerson } from "@graview/core/binding";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, liveProtocol, presenceFrom, SEAT_HEADERS, visitorPresence, whoFor, type LivePeer, type LiveServerMessage } from "../../src/runtime.js";

/**
 * A BOUND PERSON IS THEIR RECORD ON THE WIRE. Bud's account was bound to the
 * participant the organizer entered for him. Whatever a socket or a request
 * hands another member — the log a welcome carries, an op as it lands, the
 * ops since a seq, an export — says his acts were the record's, by its id
 * and its name, and never names his account. His own socket is told his
 * account, as before.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }) } as never);
const schema = createSchema([participant, gift]);
const { defineMutation } = bindSchema(schema);
const addGift = defineMutation("add-gift", { title: "Add a gift", creates: ["gift"], input: z.object({ title: z.string() }), apply: (ctx: any, args: any) => ctx.addNode({ id: ctx.freshId(args.title, "gift"), kind: "gift", title: args.title }) } as never);
const policy = { roles: ["member"], grants: [{ roles: ["member"], mutations: ["add-gift"] }] };
const app = defineApp({ name: "bound", schema, mutations: [addGift] as never, policy, version: 1 } as never);

const host: Principal = { kind: "system", id: "host" };
const bud: Principal = { kind: "human", id: "acct-bud", name: "budster", roles: ["member"] };
const ann: Principal = { kind: "human", id: "acct-ann", roles: ["member"] };

function bound(): Store<AnySchema> {
  const store = new Store<AnySchema>({ schema, mutations: [addGift] as never, policy, snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }], edges: [] } } as never);
  bindPerson(store, bud, "participant:bud", { author: host });
  store.apply({ name: "add-gift", args: { title: "A kite" } }, { author: bud });
  return store;
}

const tells = (value: unknown) => JSON.stringify(value ?? null).includes("acct-bud");
const opsIn = (messages: readonly LiveServerMessage[]): Operation[] => messages.flatMap((message) => ((message as { ops?: Operation[] }).ops ?? []));

async function peerOf(live: ReturnType<typeof liveProtocol>, seat: Principal) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...live.open(seat, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
  return { peer, heard };
}

describe("a bound person on the wire, as another member is served it", () => {
  it("is his record in the log a socket's welcome carries, and in an op as it lands", async () => {
    const store = bound();
    const live = liveProtocol({ store } as never);
    const a = await peerOf(live as never, ann);
    store.apply({ name: "add-gift", args: { title: "A ball" } }, { author: bud });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const ops = opsIn(a.heard).filter((op) => op.mutation?.name === "add-gift");
    expect(ops.length).toBeGreaterThanOrEqual(1);
    for (const op of ops) expect(op.author).toMatchObject({ id: "participant:bud", name: "Bud" });
    expect(tells(a.heard)).toBe(false);
  });

  it("is his record in the ops since a seq and in an export, over HTTP", async () => {
    const served = await createStoreHandler({ app, store: bound(), trustSeatHeaders: true } as never);
    const as = (seat: Principal) => ({ [SEAT_HEADERS.seat]: seat.id!, [SEAT_HEADERS.roles]: "member" });
    const since = await (await served.handle(new Request("http://store/graview/since?seq=-1", { headers: as(ann) }))).json();
    expect(tells(since)).toBe(false);
    expect(JSON.stringify(since)).toContain("participant:bud");
    const exported = await (await served.handle(new Request("http://store/graview/export", { headers: as(ann) }))).json();
    expect(tells(exported)).toBe(false);
    // His own seat is told his account.
    const own = await (await served.handle(new Request("http://store/graview/since?seq=-1", { headers: as(bud) }))).json();
    expect(tells(own)).toBe(true);
    await served.close();
  });

  it("is his record in what a member's own change answers over HTTP, when it lands beside his", async () => {
    const store = bound();
    const served = await createStoreHandler({ app, store, trustSeatHeaders: true } as never);
    const answer = await served.handle(new Request("http://store/graview/ops", { method: "POST", headers: { [SEAT_HEADERS.seat]: "acct-ann", [SEAT_HEADERS.roles]: "member" }, body: JSON.stringify({ seq: -1, calls: [{ name: "add-gift", args: { title: "A hoop" } }] }) }));
    expect(answer.status).toBe(200);
    expect(tells(await answer.json())).toBe(false);
    await served.close();
  });

  it("is his record in who is here, and in for whom his agent acts", () => {
    const store = bound();
    const helper: Principal = { kind: "agent", id: "helper", roles: ["member"], onBehalfOf: bud };
    const here = [presenceFrom({ participant: "x", stop: "" } as never, bud), visitorPresence(helper)];
    const told = whoFor(store, ann, here);
    expect(tells(told)).toBe(false);
    expect(told.find((one) => one.kind === "human")).toMatchObject({ participant: "human:participant:bud:x", name: "Bud" });
    expect(told.find((one) => one.kind === "agent")).toMatchObject({ onBehalfOf: "participant:bud", onBehalfOfName: "Bud" });
    // A member who may not see his record is not shown him at all, nor for whom the agent acts.
    const blind = new Store<AnySchema>({ schema, mutations: [addGift] as never, policy: { ...policy, sees: [{ roles: ["member"], kinds: ["gift"] }] }, snapshot: store.snapshot() } as never);
    const hidden = whoFor(blind, ann, here);
    expect(tells(hidden)).toBe(false);
    expect(hidden.filter((one) => one.kind === "human")).toEqual([]);
    expect(hidden.find((one) => one.kind === "agent")).not.toHaveProperty("onBehalfOf");
    // He himself is told his own account.
    expect(tells(whoFor(store, bud, here))).toBe(true);
  });
});
