import { readFileSync } from "node:fs";
import { createSchema, defineApp, defineMutation, defineNode, nodeRef, Store, z, type Policy, type Principal } from "@graview/core";
import { deriveAffordances } from "@graview/tools/derive";
import { describe, expect, it } from "vitest";
import { renderScreen, resolveTap, tapAt, type TapRegion } from "@graview/pages/device";
import { createTodoStore, todoApp } from "../../../../apps/todo/src/domain/app.js";

/**
 * A STATIC RENDER SAYS WHAT EACH REGION OF ITS PICTURE DOES (Roadmap
 * f-render-tap-map). A host photographs the screen and is later handed a
 * point on it: the render gives the rectangles, in the viewport's pixels,
 * each doing exactly one of go, open, act, page or refresh, with the
 * render's id — and `resolveTap` says what a tap does now, never running an
 * act against a state the picture did not show.
 */

const PW3 = { width: 758, height: 1024 } as const;
const example = JSON.parse(readFileSync(new URL("../../../../apps/todo/src/data/example.json", import.meta.url), "utf8"));
const keeper: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const todo = () => createTodoStore({ snapshot: example });
const screen = (store: Store<never>, place: string, options: Partial<Parameters<typeof renderScreen>[3]> = {}) => renderScreen(store, todoApp as never, place, { profile: "eink", viewport: PW3, viewer: keeper, ...options });
const DOES = ["go", "open", "act", "page", "refresh"] as const;

/* A chore list where finishing is the doer's, renaming asks for a name, and a reader may do nothing. */
const chore = defineNode("chore", { fields: z.object({ label: z.string(), done: z.boolean() }), plural: "Chores" });
const schema = createSchema([chore]);
const finish = defineMutation("finish-chore", {
  title: "Mark it done",
  description: "Finish a chore.",
  subject: { kinds: ["chore"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["chore"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const rename = defineMutation("rename-chore", {
  title: "Rename it",
  description: "Give a chore another name.",
  subject: { kinds: ["chore"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["chore"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const policy: Policy = { roles: ["doer", "reader"], grants: [{ roles: ["doer"], mutations: ["finish-chore", "rename-chore"] }], sees: [{ roles: "*", kinds: ["chore"] }] };
const chores = defineApp({ name: "chores", schema, mutations: [finish, rename], policy });
const choreStore = () => new Store({ schema, mutations: [finish, rename], policy, snapshot: { nodes: [{ id: "c-bins", kind: "chore", label: "Put the bins out", done: false }, { id: "c-hall", kind: "chore", label: "Sweep the hall", done: false }] as never, edges: [] } });
const doer: Principal = { kind: "human", id: "pat", roles: ["doer"] };
const reader: Principal = { kind: "human", id: "lou", roles: ["reader"] };
const choreScreen = (store: Store<never>, viewer: Principal) => renderScreen(store, chores as never, "/chores/c-bins", { profile: "eink", viewport: PW3, viewer });

describe("the tap map", () => {
  it("is rectangles in the viewport's pixels, each doing exactly one of go, open, act, page or refresh, with the render's id", () => {
    const store = todo();
    const task = store.graph.nodesOfKind("task")[0]!;
    for (const place of ["home", "/tasks", task.id]) {
      const drawn = screen(store as never, place);
      expect(drawn.renderId).toMatch(/^eink\.[A-Za-z0-9_-]+\.[0-9a-f]{56}$/);
      for (const tap of drawn.taps) {
        expect(Object.keys(tap).sort()).toEqual(["does", "height", "label", "width", "x", "y"]);
        expect(DOES.filter((one) => one in tap.does), tap.label).toHaveLength(1);
        for (const n of [tap.x, tap.y, tap.width, tap.height]) expect(Number.isInteger(n)).toBe(true);
        expect(tap.x + tap.width).toBeLessThanOrEqual(PW3.width);
        expect(tap.y + tap.height).toBeLessThanOrEqual(PW3.height);
        expect(tap.label.length).toBeGreaterThan(0);
        // The element drawn for it says which region it is.
        expect(drawn.html).toContain(`style="left:${tap.x}px;top:${tap.y}px;width:${tap.width}px;height:${tap.height}px" data-tap="${drawn.taps.indexOf(tap)}"`);
      }
      expect(drawn.taps.some((tap) => "refresh" in tap.does), place).toBe(true);
    }
    expect(tapAt(screen(store as never, "home").taps, -1, -1)).toBeUndefined();
  });

  it("gives the same id and the same map for the same store, declaration, place, seat, profile, viewport and page — and another when any differs", () => {
    const a = screen(todo() as never, "/tasks");
    const b = screen(todo() as never, "/tasks");
    expect(b.renderId).toBe(a.renderId);
    expect(b.taps).toEqual(a.taps);
    expect(b.html).toBe(a.html);
    const others = [
      screen(todo() as never, "/tasks", { page: 1 }),
      screen(todo() as never, "/lists"),
      screen(todo() as never, "/tasks", { viewport: { width: 758, height: 1100 } }),
      screen(todo() as never, "/tasks", { viewer: { kind: "human", id: "user-sam", roles: ["member"] } }),
    ];
    for (const other of others) expect(other.renderId).not.toBe(a.renderId);
    // And a changed store is another picture.
    const changed = todo();
    const open = changed.graph.nodesOfKind("task").find((task) => !(task as { done?: boolean }).done)!;
    changed.apply({ name: "finish", args: { taskId: open.id } }, { author: keeper });
    expect(screen(changed as never, "/tasks").renderId).not.toBe(a.renderId);
  });

  it("offers an act only to a seat that may run it with every argument bound; one that needs a typed argument is not offered", () => {
    const store = choreStore();
    const doers = choreScreen(store as never, doer);
    const acts = doers.taps.filter((tap) => "act" in tap.does);
    expect(acts.map((tap) => tap.does)).toEqual([{ act: "finish-chore", args: { id: "c-bins" } }]);
    expect(acts[0]!.label).toBe("Mark it done");
    // The derivation offers renaming too — asking for the name, which a tap cannot give.
    const derived = deriveAffordances(store, ["c-bins"], { principal: doer, focus: "c-bins" });
    expect(derived.affordances.some((one) => one.mutation === "rename-chore" && one.open.length > 0)).toBe(true);
    expect(doers.taps.some((tap) => "act" in tap.does && tap.does.act === "rename-chore")).toBe(false);
    // A reader may run neither, and is offered neither.
    expect(choreScreen(store as never, reader).taps.some((tap) => "act" in tap.does)).toBe(false);
  });

  it("runs an act tapped on the screen the app still draws, as the seat that tapped it", () => {
    const store = choreStore();
    const drawn = choreScreen(store as never, doer);
    const done = drawn.taps.find((tap) => "act" in tap.does)!;
    const outcome = resolveTap(store, chores, done, { viewer: doer, renderId: drawn.renderId });
    expect(outcome).toEqual({ ok: true, does: "act", said: "Mark it done: done.", place: "/chores/c-bins", page: 0 });
    expect((store.graph.getNode("c-bins") as unknown as { done: boolean }).done).toBe(true);
    expect(store.log.all().at(-1)?.author).toMatchObject({ id: "pat" });
  });

  it("re-judges a tap resolved against a newer store, refuses it in words, and never runs it", () => {
    const store = choreStore();
    const drawn = choreScreen(store as never, doer);
    const done = drawn.taps.find((tap) => "act" in tap.does)!;
    // Somebody else renames the chore after the picture was taken.
    store.apply({ name: "rename-chore", args: { id: "c-bins", label: "Bins out by seven" } }, { author: doer });
    const ops = store.log.all().length;
    const outcome = resolveTap(store, chores, done, { viewer: doer, renderId: drawn.renderId });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.refused).toMatch(/changed since this screen was drawn/);
      expect(outcome.refused).toContain("Mark it done");
      expect(outcome.place).toBe("/chores/c-bins");
    }
    expect(store.log.all().length).toBe(ops);
    expect((store.graph.getNode("c-bins") as unknown as { done: boolean }).done).toBe(false);
  });

  it("says so in words when the seat may no longer run what it tapped", () => {
    const store = choreStore();
    const drawn = choreScreen(store as never, doer);
    const done = drawn.taps.find((tap) => "act" in tap.does)!;
    // The same tap handed in as a reader, who may not finish anything.
    const outcome = resolveTap(store, chores, done, { viewer: reader, renderId: drawn.renderId });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.refused).toMatch(/no longer yours to do/);
    expect((store.graph.getNode("c-bins") as unknown as { done: boolean }).done).toBe(false);
  });

  it("never runs an act the picture did not show, nor one from no screen at all", () => {
    const store = choreStore();
    const drawn = choreScreen(store as never, doer);
    const forged: TapRegion = { x: 0, y: 0, width: 100, height: 100, label: "Mark it done", does: { act: "finish-chore", args: { id: "c-hall" } } };
    const outcome = resolveTap(store, chores, forged, { viewer: doer, renderId: drawn.renderId });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.refused).toMatch(/not on this screen/);
    expect(resolveTap(store, chores, forged, { viewer: doer, renderId: "nonsense" }).ok).toBe(false);
    expect((store.graph.getNode("c-hall") as unknown as { done: boolean }).done).toBe(false);
  });

  it("answers a press that goes somewhere with the place to draw next", () => {
    const store = todo();
    const list = screen(store as never, "/tasks");
    const row = list.taps.find((tap) => "open" in tap.does)!;
    const id = (row.does as { open: string }).open;
    expect(resolveTap(store, todoApp, row, { viewer: keeper, renderId: list.renderId })).toEqual({ ok: true, does: "open", place: `/tasks/${encodeURIComponent(id)}`, page: 0 });
    const on = list.taps.find((tap) => "page" in tap.does)!;
    expect(resolveTap(store, todoApp, on, { viewer: keeper, renderId: list.renderId })).toEqual({ ok: true, does: "page", place: "/tasks", page: 1 });
    const refresh = list.taps.find((tap) => "refresh" in tap.does)!;
    expect(resolveTap(store, todoApp, refresh, { viewer: keeper, renderId: list.renderId })).toEqual({ ok: true, does: "refresh", place: "/tasks", page: 0 });
    const home = list.taps.find((tap) => "go" in tap.does && tap.does.go === "/")!;
    expect(resolveTap(store, todoApp, home, { viewer: keeper, renderId: list.renderId })).toEqual({ ok: true, does: "go", place: "/", page: 0 });
    // A record the seat may not see is answered as nothing there.
    const nora = { label: "Nora", does: { open: "user-nora" } } as const;
    expect(resolveTap(store, todoApp, nora, { viewer: { kind: "human", id: "user-sam", roles: ["member"] }, renderId: list.renderId }).ok).toBe(false);
  });
});
