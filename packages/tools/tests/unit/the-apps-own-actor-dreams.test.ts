import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, type AnySchema, type Author } from "@graview/core";
import { declineSuggestion, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { openHost } from "../../src/cli.js";
import { archive, dream, duplicates, links, TIDYING_ACTOR, touchedIn, whileAway, type JudgeContext } from "../../src/tidy.js";

/*
 * THE APP'S OWN ACTOR DREAMS. Run while nobody is looking, its judges find
 * what it would tidy from the graph alone — two records with one name, a
 * record whose text names another, a finished one long untouched — and the
 * run suggests each for a person, never asking again what a person
 * declined, never touching a record left alone or changed lately, and
 * applying nothing on its own unless the host said it may.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string(), email: z.string().optional() }) });
const task = defineNode("task", {
  fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]), supplier: z.string().optional(), notes: z.string().optional(), closedOn: z.string().optional() }),
  edges: { vendor: { to: ["vendor"], cardinality: "one" } },
  fieldRoles: { end: "closedOn" },
});
const note = defineNode("note", { fields: z.object({ label: z.string() }), archives: false });
const schema = createSchema([vendor, task, note]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename-task", {
  title: "Rename a task",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nick: Author = { kind: "human", id: "nick", name: "Nick" };
const NOW = "2026-10-22T09:00:00.000Z";

function storeOf(clock = { at: NOW }) {
  return new Store<AnySchema>({
    schema,
    mutations: [rename] as never,
    now: () => clock.at,
    snapshot: {
      nodes: [
        { id: "vendor:acme", kind: "vendor", label: "Acme Supply" },
        { id: "vendor:acme-2", kind: "vendor", label: "acme  supply" },
        { id: "vendor:bloom", kind: "vendor", label: "Bloom Florals", email: "hi@bloom.example" },
        { id: "vendor:bloom-2", kind: "vendor", label: "Bloom", email: "HI@bloom.example" },
        { id: "vendor:harbor", kind: "vendor", label: "Harbor Catering" },
        { id: "task:order", kind: "task", label: "Order the chairs", status: "todo", supplier: "Harbor Catering" },
        { id: "task:call", kind: "task", label: "Call about flowers", status: "doing", notes: "Ask Quill Stationers and Harbor Catering for a quote" },
        { id: "task:old", kind: "task", label: "Book the hall", status: "done", closedOn: "2026-07-01" },
        { id: "task:recent", kind: "task", label: "Send the invites", status: "done", closedOn: "2026-10-20" },
        { id: "note:one", kind: "note", label: "Same" },
        { id: "note:two", kind: "note", label: "Same" },
      ] as never,
      edges: [],
    },
  });
}

const contextOf = (store: Store<AnySchema>, at = NOW): JudgeContext => ({ store, now: Date.parse(at), touched: touchedIn(store), quietFor: 24 * 3600_000, olderThanDays: 30 });
const callsOf = (found: readonly { calls: readonly { name: string; args: unknown }[] }[]) => found.map((one) => one.calls[0]);

describe("the judges", () => {
  it("find duplicates of one kind by a shared key or a name, the one with more to it kept, and never in a kind that does not archive", () => {
    const store = storeOf();
    // Bloom Florals has a link, so it is the one that stays.
    store.apply({ name: "connect-task-vendor", args: { id: "task:old", to: "vendor:bloom" } }, { author: nick });
    const found = duplicates.judge(contextOf(store, "2026-10-25T09:00:00.000Z"));
    expect(callsOf(found)).toEqual([
      { name: "merge-vendor", args: { id: "vendor:bloom-2", into: "vendor:bloom" } },
      { name: "merge-vendor", args: { id: "vendor:acme-2", into: "vendor:acme" } },
    ]);
    expect(found.map((one) => [one.basis, one.confidence])).toEqual([
      ["Both have the email hi@bloom.example", 0.95],
      ["Same name as “Acme Supply” (another vendor)", 0.9],
    ]);
  });

  it("find a link a record's text names through a relation the app declares: an exact name surer than one named in passing", () => {
    const found = links.judge(contextOf(storeOf()));
    expect(callsOf(found)).toEqual([
      { name: "connect-task-vendor", args: { id: "task:order", to: "vendor:harbor" } },
      { name: "connect-task-vendor", args: { id: "task:call", to: "vendor:harbor" } },
    ]);
    expect(found.map((one) => [one.basis, one.confidence])).toEqual([
      ["Its supplier is “Harbor Catering”, the name of a vendor", 0.85],
      ["Its notes names “Harbor Catering”", 0.5],
    ]);
  });

  it("find a record its kind says is finished, unchanged for longer than the run allows, to set aside", () => {
    const found = archive.judge(contextOf(storeOf()));
    expect(callsOf(found)).toEqual([{ name: "archive-task", args: { id: "task:old" } }]);
    expect(found[0]!.basis).toBe("Finished — its status is “done” — and unchanged for 113 days");
  });

  it("leave a record a person changed lately for now", () => {
    const clock = { at: "2026-10-22T08:00:00.000Z" };
    const store = storeOf(clock);
    store.apply({ name: "rename-task", args: { id: "task:order", label: "Order the chairs, forty" } }, { author: nick });
    store.apply({ name: "rename-task", args: { id: "task:old", label: "Book the hall, again" } }, { author: nick });
    const context = contextOf(store);
    expect(links.judge(context).map((one) => one.about[0])).toEqual(["task:call"]);
    expect(archive.judge(context)).toEqual([]);
  });

  it("propose nothing about a record a person said to leave alone", () => {
    const store = storeOf();
    store.apply({ name: "leave-alone-vendor", args: { id: "vendor:harbor" } }, { author: nick });
    store.apply({ name: "leave-alone-vendor", args: { id: "vendor:acme-2" } }, { author: nick });
    const context = contextOf(store, "2026-10-25T09:00:00.000Z");
    expect(links.judge(context)).toEqual([]);
    expect(duplicates.judge(context).map((one) => one.about)).toEqual([["vendor:bloom-2", "vendor:bloom"]]);
  });
});

describe("what the declaration and the policy say", () => {
  const quietVendor = defineNode("vendor", { fields: z.object({ label: z.string() }), tidying: "no-links" });
  const linkedTask = defineNode("task", { fields: z.object({ label: z.string(), supplier: z.string() }), edges: { vendor: { to: ["vendor"] } } });
  const nodes = [
    { id: "vendor:harbor", kind: "vendor", label: "Harbor Catering" },
    { id: "vendor:harbor-2", kind: "vendor", label: "Harbor Catering" },
    { id: "task:order", kind: "task", label: "Order the chairs", supplier: "Harbor Catering" },
  ];

  it("keep a kind the app says is never linked out of every link the actor would make", () => {
    const store = new Store<AnySchema>({ schema: createSchema([quietVendor, linkedTask]), snapshot: { nodes: nodes as never, edges: [] } });
    expect(links.judge(contextOf(store))).toEqual([]);
    // Its fields may still be tidied: the duplicate is found.
    expect(duplicates.judge(contextOf(store))).toHaveLength(1);
  });

  it("are read as the actor sees the app: an agent actor finds nothing in a kind it may not see (the system sees what it keeps)", async () => {
    const plainVendor = defineNode("vendor", { fields: z.object({ label: z.string() }) });
    const store = new Store<AnySchema>({
      schema: createSchema([plainVendor, linkedTask]),
      policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["tidier"], kinds: ["task"] }] },
      snapshot: { nodes: nodes as never, edges: [] },
    });
    const report = await dream(store, { principal: { kind: "agent", id: "tidier", name: "Tidier", automated: true, roles: ["tidier"] } as Author, now: NOW });
    expect(report.outcomes).toEqual([]);
  });
});

describe("a dream", () => {
  it("suggests what the judges found, surest first and no more than its limit, and applies nothing unless the host says", async () => {
    const store = storeOf();
    const report = await dream(store, { now: NOW, limit: 3 });
    expect(report.outcomes.map((one) => [one.outcome, one.confidence])).toEqual([
      ["suggested", 0.95],
      ["suggested", 0.9],
      ["suggested", 0.85],
    ]);
    expect(report.said).toBe("Suggested 3 changes.");
    expect(report.applying).toMatch(/Nothing was applied/);
    expect(store.graph.allEdges()).toEqual([]);
    const waiting = suggestions(store);
    expect(waiting.map((one) => [one.author.id, one.lineage?.basis])).toEqual([
      ["tidying", "Both have the email hi@bloom.example"],
      ["tidying", "Same name as “Acme Supply” (another vendor)"],
      ["tidying", "Its supplier is “Harbor Catering”, the name of a vendor"],
    ]);
    // Run again: what waits is not asked twice.
    const again = await dream(store, { now: NOW, limit: 3 });
    expect(again.outcomes.filter((one) => one.outcome === "waiting")).toHaveLength(3);
    expect(suggestions(store)).toHaveLength(5);
  });

  it("never asks again what a person declined", async () => {
    const store = storeOf();
    await dream(store, { now: NOW, judges: [archive] });
    const [old] = suggestions(store);
    declineSuggestion(store, old!.id, { author: nick });
    const again = await dream(store, { now: NOW, judges: [archive] });
    expect(again.outcomes.map((one) => one.outcome)).toEqual(["declined"]);
    expect(suggestions(store)).toEqual([]);
  });

  it("applies what it is sure enough of, with its lineage, only where the host lets it", async () => {
    const store = storeOf();
    const report = await dream(store, { now: NOW, judges: [links], applyAtLeast: 0.8 });
    expect(report.outcomes.map((one) => one.outcome)).toEqual(["applied", "suggested"]);
    const made = store.log.all().find((op) => op.primitives.length > 0)!;
    expect(made.author).toEqual(actor);
    expect(made.lineage).toEqual({ basis: "Its supplier is “Harbor Catering”, the name of a vendor", confidence: 0.85, actor: "links", run: expect.any(String) });
  });


  it("is refused to a person", async () => {
    await expect(dream(storeOf(), { principal: nick })).rejects.toThrow(/Only the app's own actor/);
  });
});

describe("while you were away", () => {
  it("says what waits and what the actor did since a person last looked", async () => {
    const store = storeOf();
    const since = store.log.length;
    await dream(store, { now: NOW, judges: [links], applyAtLeast: 0.8 });
    await dream(store, { now: NOW, judges: [archive] });
    const away = whileAway(store, { seq: since });
    expect(away).toMatchObject({ waiting: 2, suggestedSince: 2, tidied: 1 });
    expect(away.said).toBe("2 suggestions waiting · tidied one thing while you were away");
    expect(whileAway(store, { seq: store.log.length })).toMatchObject({ suggestedSince: 0, tidied: 0, said: "2 suggestions waiting" });
  });

  it("leaves out of what waits the suggestions the reader said not now to, as the tray does (FR-212)", async () => {
    const store = storeOf();
    const since = store.log.length;
    await dream(store, { now: NOW, judges: [links], applyAtLeast: 0.8 });
    await dream(store, { now: NOW, judges: [archive] });
    const [first] = suggestions(store);
    const dismissed = [{ suggestion: first!.id, at: NOW }];
    expect(whileAway(store, { seq: since }, undefined, { dismissed })).toMatchObject({ waiting: 1, suggestedSince: 1, tidied: 1, said: "One suggestion waiting · tidied one thing while you were away" });
    // A "not now" whose time has passed hides nothing.
    expect(whileAway(store, { seq: since }, undefined, { dismissed: [{ ...dismissed[0]!, until: "2000-01-01T00:00:00Z" }] })).toMatchObject({ waiting: 2 });
  });
});

describe("a dream on a store kept on disk", () => {
  it("keeps its suggestions there, for the next to open it", async () => {
    const root = mkdtempSync(join(tmpdir(), "graview-dream-"));
    try {
      const app = defineApp({ name: "dreams", schema, mutations: [rename], invariants: [], version: 1 });
      writeFileSync(join(root, "seed.json"), JSON.stringify(storeOf().snapshot()));
      const host = await openHost(app, ["--data", root, "--seed", join(root, "seed.json")], TIDYING_ACTOR, "cli");
      const report = await dream(host.store, { now: NOW, judges: [archive] });
      expect(report.said).toBe("Suggested one change.");
      await host.close();
      const again = await openHost(app, ["--data", root], TIDYING_ACTOR, "cli");
      expect(suggestions(again.store).map((one) => one.calls)).toEqual([[{ name: "archive-task", args: { id: "task:old" } }]]);
      await again.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
