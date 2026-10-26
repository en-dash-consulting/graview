import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryAdapter, createSchema, defineApp, defineNode, memoryViews, type LensTidyEdit, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { fileViews, remoteViews, serveStore, VIEWS_PATH, type ServedStore } from "../../src/index.js";

/**
 * A SERVED STORE KEEPS THE VIEWS A PERSON TIDIED (Roadmap f-place-menu-views):
 * `/graview/views` says what is hidden and recently deleted and what the
 * asking seat may do, and does it for a seat that keeps the app — refusing,
 * in a sentence, a seat that does not, and a declared lens where the host
 * writes no declaration. `remoteViews` is the page's half; `graview serve`
 * keeps it in a file beside the store.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }) });
const schema = createSchema([task]);
const app = defineApp({ name: "tidied", schema, policy: { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] } });
const keeper: Principal = { kind: "human", id: "nick", roles: ["keeper"] };
const reader: Principal = { kind: "human", id: "ada", roles: ["reader"] };

let served: ServedStore<typeof schema> | undefined;
afterEach(async () => {
  await served?.close();
  served = undefined;
});

describe("a served store's views a person tidied", () => {
  it("are hidden, deleted and restored by a seat that keeps the app, through remoteViews", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), trustSeatHeaders: true });
    const views = remoteViews({ url: served.url, principal: keeper });
    await views.ready;
    expect(views.current().may).toEqual({ views: true, lenses: false });
    let told = 0;
    views.onChange?.(() => told++);
    await views.hide("board");
    expect(views.current().hidden).toEqual(["board"]);
    await views.show("board");
    await views.remove("board", { title: "Board", kind: "task" });
    expect(views.current().removed.map((one) => [one.name, one.title, one.kind])).toEqual([["board", "Board", "task"]]);
    await views.restore("board");
    expect(views.current().removed).toEqual([]);
    expect(told).toBe(4);
    // A declared lens is the declaration's, which this host does not write.
    await expect(views.lens({ op: "remove-lens", title: "By day" })).rejects.toThrow(/does not change the app's declaration/);
  });

  it("refuses a seat that does not keep the app, in a sentence, and tells it it may do nothing", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), trustSeatHeaders: true });
    const views = remoteViews({ url: served.url, principal: reader });
    await views.ready;
    expect(views.current().may).toEqual({ views: false, lenses: false });
    await expect(views.hide("board")).rejects.toThrow("Only the app's owner or an editor hides or deletes a view.");
    const odd = await fetch(`${served.url}${VIEWS_PATH}`, { method: "POST", headers: { "content-type": "application/json", "x-graview-seat": "nick", "x-graview-roles": "keeper" }, body: JSON.stringify({ hush: "board" }) });
    expect(odd.status).toBe(400);
  });

  it("hands a declared lens's change to the host that writes the declaration, as the host decides who may", async () => {
    const changes: LensTidyEdit[] = [];
    served = await serveStore({
      app,
      adapter: createMemoryAdapter(),
      trustSeatHeaders: true,
      views: memoryViews({ declaration: { change: (edit) => void changes.push(edit), restore: () => undefined } }),
      mayTidyViews: (seat) => ({ views: true, lenses: seat.id === "nick" }),
    });
    const owner = remoteViews({ url: served.url, principal: keeper });
    await owner.ready;
    expect(owner.current().may).toEqual({ views: true, lenses: true });
    await owner.lens({ op: "set-lens-hidden", title: "By day", hidden: true });
    expect(changes).toEqual([{ op: "set-lens-hidden", title: "By day", hidden: true }]);
    const editor = remoteViews({ url: served.url, principal: reader });
    await editor.ready;
    expect(editor.current().may).toEqual({ views: true, lenses: false });
    await expect(editor.lens({ op: "remove-lens", title: "By day" })).rejects.toThrow("Only the app's owner hides or deletes a lens the app declares.");
  });

  it("judges an agent as the store judges it: by the roles it shares with its person, and by its declared may", async () => {
    const guarded = defineApp({
      name: "tidied",
      schema,
      policy: { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] },
      intelligence: [{ name: "reader-bot", kind: "llm", may: [] }],
    } as never);
    let asking: Principal = keeper;
    served = await serveStore({ app: guarded as never, adapter: createMemoryAdapter(), seatOf: () => asking });
    const hide = async (seat: Principal, name: string) => {
      asking = seat;
      return (await fetch(`${served!.url}${VIEWS_PATH}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hide: name }) })).status;
    };
    // An agent with a keeper's roles, acting for a reader, may do only what the reader may.
    expect(await hide({ kind: "agent", id: "helper", roles: ["keeper"], onBehalfOf: reader }, "for-a-reader")).toBe(403);
    // A provider declared able to do nothing keeps nothing, whatever roles it carries.
    expect(await hide({ kind: "agent", id: "reader-bot", roles: ["keeper"] }, "may-nothing")).toBe(403);
    // The keeper still does, and an agent acting for the keeper with the keeper's roles too.
    expect(await hide(keeper, "by-the-keeper")).toBe(200);
    expect(await hide({ kind: "agent", id: "helper", roles: ["keeper"], onBehalfOf: keeper }, "for-the-keeper")).toBe(200);
    asking = keeper;
    const state = (await (await fetch(`${served.url}${VIEWS_PATH}`)).json()) as { hidden: string[] };
    expect(state.hidden).toEqual(["by-the-keeper", "for-the-keeper"]);
  });

  it("never lets a seat that may not restore a deleted lens replace or clear it under the lens's name", async () => {
    const restored: string[] = [];
    let asking: Principal = keeper;
    served = await serveStore({
      app,
      adapter: createMemoryAdapter(),
      seatOf: () => asking,
      views: memoryViews({ declaration: { change: () => undefined, restore: (entry) => void restored.push(entry.title) } }),
      mayTidyViews: (seat) => ({ views: true, lenses: seat.id === "nick" }),
    });
    const post = async (seat: Principal, body: unknown) => {
      asking = seat;
      return fetch(`${served!.url}${VIEWS_PATH}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    };
    expect((await post(keeper, { lens: { op: "remove-lens", title: "Calendar" } })).status).toBe(200);
    expect((await post(reader, { restore: "lens:Calendar" })).status).toBe(403);
    expect((await post(reader, { remove: "lens:Calendar" })).status).toBe(403);
    expect((await post(reader, { hide: "lens:Calendar" })).status).toBe(403);
    expect((await post(reader, { show: "lens:Calendar" })).status).toBe(403);
    // The owner's restore still reaches the declaration.
    expect((await post(keeper, { restore: "lens:Calendar" })).status).toBe(200);
    expect(restored).toEqual(["Calendar"]);
  });

  it("are kept in a file beside the store, read again when it starts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "graview-views-"));
    try {
      const file = join(dir, "views.json");
      const first = fileViews(file);
      await first.hide("board");
      await first.remove("week", { title: "The week", kind: "task" });
      expect(JSON.parse(readFileSync(file, "utf8")).hidden).toEqual(["board"]);
      const again = fileViews(file);
      expect(again.current().hidden).toEqual(["board"]);
      expect(again.current().removed.map((one) => one.name)).toEqual(["week"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
