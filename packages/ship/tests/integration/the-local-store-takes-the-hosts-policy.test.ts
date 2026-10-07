import { createSchema, defineApp, defineMutation, defineNode, nodeRef, Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, openRemote, seatHeaders, type RemoteStore } from "../../src/index.js";

/**
 * THE LOCAL STORE TAKES THE HOST'S POLICY.
 *
 * `openRemote` judges a call in the browser before the server is asked, so
 * the interface moves at once — under the app's own policy. A host whose
 * store judges by more than the declaration says (Graview Cloud adds a
 * sight: an app's owners see everything) had the owner of a sighted app
 * refused in the browser for a record the room would have let them change.
 * `localApp` shapes the app the local store is built from — the first one
 * and every one `resolveApp` gives — so local judgment matches the host's.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }), plural: "Tasks", label: (node) => node.label });
const rename = () =>
  defineMutation("rename", {
    title: "Rename",
    subject: { kinds: ["task"], arg: "id" },
    writes: ["label"],
    input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
    describe: (args) => `Rename to “${args.label}”`,
    apply(ctx, args) {
      ctx.patchNode(args.id, { label: args.label });
    },
  });
const policy = { roles: ["owner", "editor"], grants: [{ roles: ["owner", "editor"], mutations: "*" as const }], sees: [{ roles: ["editor"], kinds: ["task"] }] };
const v1 = defineApp({ name: "sighted", schema: createSchema([task]), mutations: [rename()], policy, version: 1 });
const v2 = defineApp({ name: "sighted", schema: createSchema([task]), mutations: [rename()], policy, version: 2 });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Book the hall" }], edges: [] };
const olu: Principal = { kind: "human", id: "olu", name: "Olu", roles: ["owner"] };

/** What the host's own store adds: owners see every kind. */
function withOwnerSight<S extends AnySchema>(app: GraviewApp<S>): GraviewApp<S> {
  const sees = app.policy?.sees ?? [];
  return { ...app, policy: { ...app.policy!, sees: [...sees, { roles: ["owner"], kinds: [...app.schema.kinds] }] } } as GraviewApp<S>;
}
const hostStore = (app: GraviewApp<AnySchema>, snapshot: unknown = seed) => {
  const shaped = withOwnerSight(app);
  return new Store({ schema: shaped.schema, mutations: shaped.mutations ?? [], policy: shaped.policy!, snapshot: snapshot as never });
};

describe("the local store takes the host's policy", () => {
  it("an owner sight the hook adds lets the owner act locally, on the first app and on every one resolveApp gives", async () => {
    const handler = await createStoreHandler({ app: v1, store: hostStore(v1 as never) as never, trustSeatHeaders: true });
    const fetch = ((url: string, init?: RequestInit) => handler.handle(new Request(url, { ...init, headers: { ...(init?.headers as Record<string, string>), ...seatHeaders(olu) } }))) as typeof globalThis.fetch;

    // Without the hook the browser refuses the owner before the room is asked.
    const unshaped = await openRemote({ app: v1, url: "http://room.example", principal: olu, pollMs: 0, fetch });
    expect(() => unshaped.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } })).toThrow();
    unshaped.close();

    const remote = await openRemote({ app: v1, url: "http://room.example", principal: olu, pollMs: 0, fetch, localApp: withOwnerSight, resolveApp: (version) => (version === 2 ? v2 : v1) });
    const refusals: string[] = [];
    remote.onRefusal((sentence) => refusals.push(sentence));
    remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
    await remote.settled();
    expect(refusals).toEqual([]);
    expect(handler.store.graph.getNode("t1")).toMatchObject({ label: "Book the big hall" });

    // The declaration moves: the app resolveApp gives is shaped the same way.
    let next: RemoteStore<AnySchema> | undefined;
    remote.onDeclaration((store) => (next = store));
    await handler.declarationChanged({ app: v2, store: hostStore(v2 as never, handler.store.snapshot()) as never });
    await remote.pull();
    for (let tries = 0; tries < 200 && !next; tries++) await new Promise((tick) => setTimeout(tick, 2));
    expect(next?.version).toBe(2);
    next!.store.apply({ name: "rename", args: { id: "t1", label: "Book the town hall" } });
    await next!.settled();
    expect(refusals).toEqual([]);
    expect(handler.store.graph.getNode("t1")).toMatchObject({ label: "Book the town hall" });
    next!.close();
    await handler.close();
  });
});
