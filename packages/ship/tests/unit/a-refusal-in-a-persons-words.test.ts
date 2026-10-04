import { createSchema, defineApp, defineMutation, defineNode, Store, type MutationCall, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { liveProtocol, type LivePeer, type LiveServerMessage, type ServedSocket } from "../../src/runtime.js";

/**
 * A REFUSAL ON THE WIRE IS SAID TO A PERSON (FR-46).
 *
 * The live wire sent the store's own sentences, which were written for a
 * developer: `Invalid arguments for mutation "add" label: Too small…` and
 * `Unknown mutation "dance" Registered: add, rename, archive, …` — every act
 * the app has, listed to any seat that sent a name it does not have. Now
 * the default says invalid arguments in the form's own words and names no
 * act the seat did not, and `liveProtocol({ refusal })` lets a host word a
 * refusal itself: handed the error, the calls and the socket, it answers
 * the refusal to send, or nothing for the default.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }), plural: "Tasks" });
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const archiveEverything = defineMutation("archive-everything-secretly", {
  title: "Archive everything",
  input: z.object({}),
  describe: () => "Archive everything",
  apply() {},
});
const schema = createSchema([task]);
const app = defineApp({ name: "words", schema, mutations: [add, archiveEverything], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const kim: Principal = { kind: "human", id: "kim", name: "Kim", roles: ["keeper"] };
const hostsStore = () => new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } as never });

async function asked(live: ReturnType<typeof liveProtocol<typeof schema>>, calls: unknown[]) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...live.open(kim, "web"), send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  await live.receive(peer, JSON.stringify({ t: "hello", seq: -1 }));
  await live.receive(peer, JSON.stringify({ t: "call", cid: "c", calls }));
  return heard.at(-1) as Extract<LiveServerMessage, { t: "refused" }>;
}

describe("a refusal in a person's words", () => {
  it("names no act the seat did not when it asks for one the app does not have", async () => {
    const refused = await asked(liveProtocol({ store: hostsStore() }), [{ name: "dance", args: {} }]);
    expect(refused).toMatchObject({ t: "refused", reason: "invalid" });
    expect(refused.sentence).toBe("This app has no act called “dance”.");
    expect(refused.sentence).not.toMatch(/Registered|archive-everything-secretly|add/);
  });

  it("says invalid arguments in the form's words, not the mutation's id and the argument's key", async () => {
    const refused = await asked(liveProtocol({ store: hostsStore() }), [{ name: "add", args: { id: "t1", label: "" } }]);
    expect(refused).toMatchObject({ t: "refused", reason: "invalid" });
    expect(refused.sentence).not.toMatch(/Invalid arguments for mutation/);
    expect(refused.sentence).toMatch(/^“Add a task” was not made: Name — /);
  });

  it("lets a host word a refusal itself, and keeps the default when it answers nothing", async () => {
    const handed: [string, readonly MutationCall[], ServedSocket][] = [];
    const live = liveProtocol({
      store: hostsStore(),
      refusal: (error, calls, peer) => {
        handed.push([error instanceof Error ? error.name : String(error), calls, peer]);
        return calls[0]?.name === "dance" ? { reason: "invalid", sentence: "Dancing is not something this room does." } : undefined;
      },
    });
    expect((await asked(live, [{ name: "dance", args: {} }])).sentence).toBe("Dancing is not something this room does.");
    expect((await asked(live, [{ name: "add", args: { id: "t1", label: "" } }])).sentence).toMatch(/^“Add a task” was not made/);
    expect(handed.map(([name, calls, peer]) => [name, calls[0]?.name, peer.seat.id, peer.via])).toEqual([
      ["UnknownMutationError", "dance", "kim", "web"],
      ["InvalidArguments", "add", "kim", "web"],
    ]);
    // The same over HTTP.
    const answer = await live.post(JSON.stringify({ calls: [{ name: "dance", args: {} }] }), { seat: kim, via: "api" });
    expect(answer).toMatchObject({ status: 409, body: { error: "Dancing is not something this room does.", reason: "invalid" } });
  });
});
