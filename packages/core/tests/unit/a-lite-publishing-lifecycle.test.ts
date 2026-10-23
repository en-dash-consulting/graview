import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { compileDocument, describeApp } from "../../src/check.js";
import { toDocument } from "../../src/document/index.js";
import { bindSchema, createSchema, defineNode, nodeRef, PermissionDeniedError, PUBLISH, Store, type Principal, type Publishing } from "../../src/index.js";
import { pastOf } from "../../src/past.js";
import { unpublished } from "../../src/history.js";

/**
 * A LITE PUBLISHING LIFECYCLE (Roadmap f-publishing-lifecycle). Nick, Oct
 * 23, 2026: "edits don't go live right away to people on the site unless
 * that's turned on or they are a collaborator and are in realtime edit
 * mode." An app declared `on-publish` serves the head to the roles it
 * names `working`, and everyone else the app as it stood at the last
 * publish; a publish is one op that touches no record, and taking it back
 * is an undo of it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "t"), kind: "task", label: args.label } as never);
  },
});
const rename = defineMutation("rename-task", {
  title: "Rename the task",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

const editor: Principal = { kind: "human", id: "eve", name: "Eve", roles: ["editor"] };
const writer: Principal = { kind: "human", id: "wes", name: "Wes", roles: ["writer"] };
const visitor: Principal = { kind: "human", id: "form:abc", name: "A visitor", roles: ["visitor"] };
const agentForEve: Principal = { kind: "agent", id: "claude", name: "Claude", onBehalfOf: editor };

const publishing: Publishing = { mode: "on-publish", working: ["editor", "writer"], publishers: ["editor"] };
const policy = {
  grants: [
    { roles: ["editor", "writer"], mutations: "*" as const },
    { roles: ["visitor"], mutations: ["add-task"] },
  ],
};

function app(options: { readonly sees?: boolean; readonly publishing?: Publishing } = {}) {
  const store = new Store({
    schema,
    mutations: [add, rename],
    policy: options.sees ? { ...policy, sees: [{ roles: "*" as const, kinds: ["task"] }] } : policy,
    publishing: options.publishing ?? publishing,
    snapshot: { nodes: [{ id: "t0", kind: "task", label: "Seeded" }], edges: [] } as never,
  });
  return store;
}
const labels = (store: Store<typeof schema>) => store.graph.allNodes().map((node) => node.label).sort();

describe("an app that publishes", () => {
  it("does not show a visitor an unpublished edit", () => {
    const store = app();
    store.apply({ name: "add-task", args: { label: "Draft" } }, { author: editor });
    expect(labels(store.seenBy(visitor))).toEqual(["Seeded"]);
    expect(store.seenBy(visitor).servedSeq).toBe(0);
    expect(store.publishedSeq).toBeUndefined();
  });

  it("shows a collaborator the head, and an agent acting for one", () => {
    const store = app();
    store.apply({ name: "add-task", args: { label: "Draft" } }, { author: writer });
    expect(labels(store.seenBy(editor))).toEqual(["Draft", "Seeded"]);
    expect(labels(store.seenBy(writer))).toEqual(["Draft", "Seeded"]);
    expect(labels(store.seenBy(agentForEve))).toEqual(["Draft", "Seeded"]);
  });

  it("moves readers to the head when a publisher publishes, in one op that touches nothing", () => {
    const store = app();
    store.apply({ name: "add-task", args: { label: "Draft" } }, { author: editor });
    const reader = store.seenBy(visitor);
    const result = store.apply({ name: PUBLISH, args: {} }, { author: editor });
    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]).toMatchObject({ intent: "Publish 1 change", primitives: [], publishedThrough: 2, author: { id: "eve" } });
    expect(store.publishedSeq).toBe(2);
    expect(labels(reader)).toEqual(["Draft", "Seeded"]);
    expect(reader.servedSeq).toBe(2);
    // And what is made after it waits for the next.
    store.apply({ name: "add-task", args: { label: "Later" } }, { author: editor });
    expect(labels(reader)).toEqual(["Draft", "Seeded"]);
    expect(reader.log.length).toBe(2);
  });

  it("moves readers back when the publish is undone, and forward again when that is", () => {
    const store = app();
    store.apply({ name: "add-task", args: { label: "One" } }, { author: editor });
    const first = store.apply({ name: PUBLISH, args: {} }, { author: editor });
    store.apply({ name: "add-task", args: { label: "Two" } }, { author: editor });
    const second = store.apply({ name: PUBLISH, args: {} }, { author: editor });
    expect(labels(store.seenBy(visitor))).toEqual(["One", "Seeded", "Two"]);
    const taken = store.undo(second.batch, { author: editor });
    expect(store.publishedSeq).toBe(first.ops[0]!.publishedThrough);
    expect(labels(store.seenBy(visitor))).toEqual(["One", "Seeded"]);
    store.redo(taken.batch, { author: editor });
    expect(labels(store.seenBy(visitor))).toEqual(["One", "Seeded", "Two"]);
  });

  it("tells a reader's subscribers when what is published moves, and not before", () => {
    const store = app();
    const reader = store.seenBy(visitor);
    const heard: number[] = [];
    reader.subscribe((diff) => heard.push(diff.addedNodes.length));
    store.apply({ name: "add-task", args: { label: "Draft" } }, { author: editor });
    expect(heard).toEqual([]);
    store.apply({ name: PUBLISH, args: {} }, { author: editor });
    expect(heard).toEqual([1]);
  });

  it("lets only a publisher publish, or take a publish back", () => {
    const store = app();
    expect(() => store.apply({ name: PUBLISH, args: {} }, { author: writer })).toThrow(PermissionDeniedError);
    expect(() => store.apply({ name: PUBLISH, args: {} }, { author: visitor })).toThrow(/only editor may publish/);
    const published = store.apply({ name: PUBLISH, args: {} }, { author: editor });
    expect(() => store.undo(published.batch, { author: writer })).toThrow(PermissionDeniedError);
    expect(store.permittedMutations(editor).map((one) => one.name)).toContain(PUBLISH);
    expect(store.permittedMutations(writer).map((one) => one.name)).not.toContain(PUBLISH);
  });

  it("lands a visitor's answer on the head, where readers see it only after the next publish", () => {
    const store = app();
    store.seenBy(visitor).apply({ name: "add-task", args: { label: "From a visitor" } }, { author: visitor });
    expect(labels(store)).toEqual(["From a visitor", "Seeded"]);
    expect(labels(store.seenBy(visitor))).toEqual(["Seeded"]);
    store.apply({ name: PUBLISH, args: {} }, { author: editor });
    expect(labels(store.seenBy(visitor))).toEqual(["From a visitor", "Seeded"]);
  });

  it("serves a reader's sight over what was published", () => {
    const store = app({ sees: true });
    store.apply({ name: "add-task", args: { label: "Draft" } }, { author: editor });
    expect(labels(store.seenBy(visitor))).toEqual(["Seeded"]);
    store.apply({ name: PUBLISH, args: {} }, { author: editor });
    expect(labels(store.seenBy(visitor))).toEqual(["Draft", "Seeded"]);
  });

  it("previews what readers see for a collaborator who asks (as: published)", () => {
    const store = app();
    store.apply({ name: "add-task", args: { label: "Draft" } }, { author: editor });
    expect(labels(store.seenBy(editor, { as: "published" }))).toEqual(["Seeded"]);
    expect(labels(store.seenBy(editor))).toEqual(["Draft", "Seeded"]);
  });

  it("does not let a reader look past what was published", () => {
    const store = app();
    store.apply({ name: "add-task", args: { label: "Draft" } }, { author: editor });
    expect(() => pastOf(store.seenBy(visitor), 1)).toThrow(RangeError);
  });

  it("publishes through an earlier seq when asked, and refuses one the store does not hold", () => {
    const store = app();
    store.apply({ name: "add-task", args: { label: "One" } }, { author: editor });
    store.apply({ name: "add-task", args: { label: "Two" } }, { author: editor });
    store.apply({ name: PUBLISH, args: { through: 1 } }, { author: editor });
    expect(labels(store.seenBy(visitor))).toEqual(["One", "Seeded"]);
    expect(() => store.apply({ name: PUBLISH, args: { through: 99 } }, { author: editor })).toThrow(/Cannot publish through seq 99/);
  });

  it("keeps the published seq readable through a compaction", () => {
    const store = app();
    for (let n = 0; n < 6; n++) store.apply({ name: "add-task", args: { label: `T${n}` } }, { author: editor });
    store.apply({ name: PUBLISH, args: { through: 3 } }, { author: editor });
    for (let n = 6; n < 9; n++) store.apply({ name: "add-task", args: { label: `T${n}` } }, { author: editor });
    const checkpoint = store.checkpoint({ seq: 9 });
    expect(checkpoint?.seq).toBe(3);
    store.compact(checkpoint!);
    expect(labels(store.seenBy(visitor))).toEqual(["Seeded", "T0", "T1", "T2"]);
  });

  it("says what is not published yet, gesture by gesture", () => {
    const store = app();
    store.apply({ name: "add-task", args: { label: "One" } }, { author: editor });
    store.apply({ name: PUBLISH, args: {} }, { author: editor });
    store.apply({ name: "add-task", args: { label: "Two" } }, { author: editor });
    store.apply({ name: "rename-task", args: { id: "t0", label: "Renamed" } }, { author: writer });
    const said = unpublished(store);
    expect(said.publishedSeq).toBe(2);
    expect(said.ticks.map((tick) => tick.said)).toEqual([expect.stringContaining("Two"), expect.stringContaining("Renamed")]);
    expect(said.sentence).toBe("2 changes are not published yet.");
    expect(unpublished(app()).sentence).toBe("Nothing is published yet.");
  });

  it("is live by default: every seat the head, and no publish act", () => {
    const store = app({ publishing: { mode: "live", working: ["editor"] } });
    store.apply({ name: "add-task", args: { label: "Draft" } }, { author: editor });
    expect(labels(store.seenBy(visitor))).toEqual(["Draft", "Seeded"]);
    expect(() => store.apply({ name: PUBLISH, args: {} }, { author: editor })).toThrow(/Unknown mutation/);
  });
});

describe("a seat's view, kept per seat", () => {
  it("keeps two agents for one person apart, each answering as its own principal", () => {
    const store = new Store({ schema, mutations: [add, rename], policy: { ...policy, sees: [{ roles: "*" as const, kinds: ["task"] }] } });
    const first: Principal = { kind: "agent", id: "one", onBehalfOf: editor };
    const second: Principal = { kind: "agent", id: "two", onBehalfOf: editor };
    const a = store.seenBy(first) as Store<typeof schema> & { seenFor: Principal };
    const b = store.seenBy(second) as Store<typeof schema> & { seenFor: Principal };
    expect(a).not.toBe(b);
    expect(a.seenFor).toBe(first);
    expect(b.seenFor).toBe(second);
  });
});

describe("a document that says when its edits reach readers", () => {
  const RSVP = JSON.parse(readFileSync(new URL("../document/fixtures/rsvp.gdd.json", import.meta.url), "utf8")) as Record<string, unknown>;
  const withPublishing = (publishing: unknown) => ({ ...structuredClone(RSVP), publishing });
  const codes = (document: unknown) => compileDocument(document).findings.filter((f) => f.code.includes("publishing")).map((f) => f.code);

  it("is compiled into the app and given back by toDocument", () => {
    const result = compileDocument(withPublishing({ mode: "on-publish", working: ["host"] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.app.publishing).toEqual({ mode: "on-publish", working: ["host"] });
    expect(toDocument(result.app).document.publishing).toEqual({ mode: "on-publish", working: ["host"] });
    expect(describeApp(result.app)).toContain("## Publishing\nEdits reach readers when they are published. Host edit live");
  });

  it("is refused by its path when it says a mode or a key no build knows, as an older build refuses the key itself", () => {
    expect(compileDocument(withPublishing({ mode: "scheduled", working: ["host"] })).ok).toBe(false);
    expect(compileDocument(withPublishing({ mode: "on-publish", working: ["host"], reviewers: ["host"] })).ok).toBe(false);
    const refused = compileDocument({ ...structuredClone(RSVP), publishingLater: {} });
    expect(refused.ok).toBe(false);
    expect(JSON.stringify(refused.findings)).toContain("publishingLater");
  });

  it("is judged: a role nobody holds, nobody working, and a publisher not served the head", () => {
    expect(codes(withPublishing({ mode: "on-publish", working: ["host"] }))).toEqual([]);
    expect(codes(withPublishing({ mode: "on-publish", working: ["editor"] }))).toContain("check:publishing-unknown-role");
    expect(codes(withPublishing({ mode: "on-publish", working: [] }))).toContain("check:publishing-nobody-working");
    expect(codes(withPublishing({ mode: "on-publish", working: ["host"], publishers: ["visitor"] }))).toContain("check:publishing-publisher-not-working");
  });
});
