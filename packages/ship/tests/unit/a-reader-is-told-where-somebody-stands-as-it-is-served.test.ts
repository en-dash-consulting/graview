import { bindSchema, createSchema, defineApp, defineNode, PUBLISH, Store, TYPE_TEXT, type Presence, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler } from "../../src/runtime.js";

/**
 * A READER IS TOLD WHERE SOMEBODY STANDS AS IT IS SERVED THE APP (FR-211).
 * A reader of an app that publishes is served the app as it stood at the
 * last publish, and who is here may tell it no more than that: a
 * collaborator standing on, hovering or typing in a record not yet
 * published is told to the reader as here, and nowhere it could not go
 * itself — and once the record is published, where they are. A
 * collaborator is told everything, as before.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), notes: z.string().max(5000).optional() }) });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1), notes: z.string().optional() }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label, ...(args.notes ? { notes: args.notes } : {}) });
  },
});
const app = defineApp({
  name: "published",
  schema,
  mutations: [add],
  policy: { roles: ["editor", "reader"], grants: [{ roles: ["editor"], mutations: "*" }] },
  publishing: { mode: "on-publish", working: ["editor"] },
  version: 1,
});
const eve: Principal = { kind: "human", id: "eve", name: "Eve", roles: ["editor"] };
const wes: Principal = { kind: "human", id: "wes", name: "Wes", roles: ["editor"] };
const rae: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };
const SEATS: Record<string, Principal> = { eve, wes, rae };

async function room() {
  const store = new Store({ schema, mutations: [add], policy: app.policy!, publishing: app.publishing!, snapshot: { nodes: [{ id: "t0", kind: "task", label: "Seeded", notes: "Old words" }], edges: [] } as never });
  const handler = await createStoreHandler({ app, store, seatOf: (request) => SEATS[request.headers.get("authorization") ?? ""] ?? rae });
  const here = (who: string, presence: Omit<Presence, "participant" | "hue" | "at">) =>
    handler.handle(new Request("https://room.example/graview/here", { method: "POST", headers: { authorization: who, "content-type": "application/json" }, body: JSON.stringify({ presence: { participant: `human:${who}:tab`, hue: 1, at: "", ...presence } }) }));
  const whoFor = async (who: string) => ((await (await handler.handle(new Request("https://room.example/graview/who", { headers: { authorization: who } }))).json()) as { who: Presence[] }).who;
  return { store, handler, here, whoFor };
}

describe("a reader of an app that publishes is told who is here", () => {
  it("and nothing of where they stand on a record not yet published", async () => {
    const { store, handler, here, whoFor } = await room();
    store.apply({ name: "add", args: { id: "draft", label: "Draft", notes: "Secret plans" } }, { author: eve });
    await here("eve", { stop: "/task/draft", over: "draft", caret: { node: "draft", field: "notes", anchor: 3, head: 3, rev: store.log.length } });
    const toRae = (await whoFor("rae")).find((one) => one.name === "Eve" || one.participant.startsWith("human:eve"));
    expect(toRae).toBeDefined();
    expect(toRae!.stop).toBe("");
    expect(toRae!.over).toBeNull();
    expect(toRae!.caret).toBeUndefined();
    expect(JSON.stringify(await whoFor("rae"))).not.toContain("draft");
    // A collaborator is served the head, and is told where Eve is.
    const toWes = (await whoFor("wes")).find((one) => one.participant.startsWith("human:eve"));
    expect(toWes).toMatchObject({ stop: "/task/draft", over: "draft", caret: { node: "draft", field: "notes" } });
    await handler.close();
  });

  it("and where they stand once it is published", async () => {
    const { store, handler, here, whoFor } = await room();
    store.apply({ name: "add", args: { id: "draft", label: "Draft" } }, { author: eve });
    store.apply({ name: PUBLISH, args: {} } as never, { author: eve });
    await here("eve", { stop: "/task/draft", over: "draft" });
    expect((await whoFor("rae")).find((one) => one.participant.startsWith("human:eve"))).toMatchObject({ stop: "/task/draft", over: "draft" });
    await handler.close();
  });

  it("and no caret in text it is served otherwise than it now reads", async () => {
    const { store, handler, here, whoFor } = await room();
    store.apply({ name: TYPE_TEXT, args: { node: "t0", field: "notes", at: 0, remove: 0, insert: "New and " } }, { author: eve });
    await here("eve", { stop: "/task/t0", over: "t0", caret: { node: "t0", field: "notes", anchor: 8, head: 8, rev: store.log.length } });
    const toRae = (await whoFor("rae")).find((one) => one.participant.startsWith("human:eve"));
    // The record is published, so where Eve stands is said; her caret is in words Rae has not been served.
    expect(toRae).toMatchObject({ stop: "/task/t0", over: "t0" });
    expect(toRae!.caret).toBeUndefined();
    store.apply({ name: PUBLISH, args: {} } as never, { author: eve });
    expect((await whoFor("rae")).find((one) => one.participant.startsWith("human:eve"))!.caret).toMatchObject({ node: "t0", field: "notes" });
    await handler.close();
  });
});
