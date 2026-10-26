import { createMemoryAdapter, createSchema, defineApp, defineNode, type Presence, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler } from "../../src/runtime.js";

/**
 * A SEAT WITH NO ID STANDS ONLY FOR ITSELF. A presence is keyed by the
 * seat that says it — `kind:id:session` — so a client cannot say where
 * somebody else is, or that they have gone. A seat the host serves with no
 * id (an anonymous reader) was keyed by whatever it claimed, and its leave
 * matched every key: it could stand in Alice's place under her name, or
 * take her off the map. Now it is keyed `kind::session`, in a namespace no
 * identified person is in, and it leaves only keys there.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const app = defineApp({ name: "room", schema: createSchema([task]), mutations: [], version: 1 });

const alice: Principal = { kind: "human", id: "alice", name: "Alice" };
const nobody: Principal = { kind: "human" };

async function room() {
  let asking: Principal = alice;
  const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: { nodes: [], edges: [] } as never, seatOf: () => asking });
  const post = async (as: Principal, path: string, body: unknown) => {
    asking = as;
    return (await handler.handle(new Request(`http://room.example${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))).json() as Promise<{ participant?: string; who: Presence[] }>;
  };
  const who = async () => {
    asking = alice;
    return ((await (await handler.handle(new Request("http://room.example/graview/who"))).json()) as { who: Presence[] }).who;
  };
  return { post, who };
}

describe("a seat with no id stands only for itself", () => {
  it("is keyed in its own namespace, whatever key it claims, and Alice's place stays hers", async () => {
    const { post, who } = await room();
    await post(alice, "/graview/here", { presence: { participant: "human:alice:t9", stop: "s-alice", hue: 1, at: "" } });
    const answer = await post(nobody, "/graview/here", { presence: { participant: "human:alice:t9", stop: "anon-spoof", name: "Alice?", hue: 1, at: "" } });
    expect(answer.participant).toBe("human::t9");
    const standing = await who();
    expect(standing.find((one) => one.participant === "human:alice:t9")).toMatchObject({ stop: "s-alice", name: "Alice" });
  });

  it("cannot say Alice has gone, and can say it has", async () => {
    const { post, who } = await room();
    await post(alice, "/graview/here", { presence: { participant: "human:alice:t9", stop: "s-alice", hue: 1, at: "" } });
    const mine = (await post(nobody, "/graview/here", { presence: { participant: "human::tab", stop: "s-anon", hue: 1, at: "" } })).participant!;
    expect(mine).toBe("human::tab");

    await post(nobody, "/graview/leave", { participant: "human:alice:t9" });
    expect((await who()).map((one) => one.participant).sort()).toEqual(["human::tab", "human:alice:t9"]);

    await post(nobody, "/graview/leave", { participant: mine });
    expect((await who()).map((one) => one.participant)).toEqual(["human:alice:t9"]);
  });

  it("cannot reach an id that begins with a colon through its own namespace", async () => {
    const { post, who } = await room();
    const odd: Principal = { kind: "human", id: ":odd" };
    const theirs = (await post(odd, "/graview/here", { presence: { participant: "human::odd:s", stop: "s-odd", hue: 1, at: "" } })).participant!;
    expect(theirs).toBe("human::odd:s");
    await post(nobody, "/graview/leave", { participant: theirs });
    expect((await who()).map((one) => one.participant)).toEqual([theirs]);
    // Nor by claiming that key on a here: its session keeps no colon.
    expect((await post(nobody, "/graview/here", { presence: { participant: theirs, stop: "spoof", hue: 1, at: "" } })).participant).toBe("human::s");
    expect((await who()).find((one) => one.participant === theirs)).toMatchObject({ stop: "s-odd" });
  });
});
