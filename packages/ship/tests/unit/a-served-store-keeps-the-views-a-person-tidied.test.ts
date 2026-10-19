import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryAdapter, createSchema, defineApp, defineNode, memoryViews, type LensTidyEdit } from "@graview/core";
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
const keeper = { kind: "human" as const, id: "nick", roles: ["keeper"] };
const reader = { kind: "human" as const, id: "ada", roles: ["reader"] };

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
