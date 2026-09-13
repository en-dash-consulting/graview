import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSchema, defineApp, defineMutation, defineNode, nodeRef } from "@graview/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createFileAdapter } from "../../src/file-adapter.js";
import { openRemote } from "../../src/remote.js";
import { serveStore, type ServedStore } from "../../src/serve.js";

/**
 * WHERE IS MY DATA — answered with a folder you can open.
 *
 * Two server-side adapters existed and nothing showed either, so the
 * strongest thing this platform can say to somebody self-hosting was a
 * capability the launcher asserted. This is the whole arrangement driven end
 * to end: the store behind HTTP with the op log as the wire, the same policy
 * refusing on the server what it refuses in a browser, two clients seeing
 * each other, and the data surviving a restart.
 */

const task = defineNode("task", {
  fields: z.object({ label: z.string().min(1), done: z.boolean() }),
  plural: "Tasks",
  label: (node) => node.label,
});
const finish = defineMutation("finish", {
  title: "Finish it",
  description: "Marks a task done.",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    // A guard, so there is something for the two sides to DISAGREE about:
    // a call both stores permit, that only one of them can still run.
    if ((ctx.graph.getNode(args.id) as { done?: boolean } | undefined)?.done === true) {
      throw new Error("It is already finished.");
    }
    ctx.patchNode(args.id, { done: true });
  },
});
const schema = createSchema([task]);
const app = defineApp({
  name: "served",
  schema,
  mutations: [finish],
  policy: {
    roles: ["keeper", "reader"],
    grants: [{ roles: ["keeper"], mutations: ["finish"], describe: "The keeper finishes things." }],
  },
  version: 1,
});
const seed = {
  nodes: [
    { id: "t1", kind: "task", label: "Book the hall", done: false },
    { id: "t2", kind: "task", label: "Pay the deposit", done: false },
  ],
  edges: [],
};

const KEEPER = { kind: "human" as const, id: "u-keeper", roles: ["keeper"] };
const READER = { kind: "human" as const, id: "u-reader", roles: ["reader"] };
const done = (store: { graph: { getNode(id: string): unknown } }, id: string) =>
  (store.graph.getNode(id) as { done: boolean }).done;

let root: string;
let served: ServedStore<typeof schema>;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "graview-serve-"));
  served = await serveStore({ app, adapter: createFileAdapter(root), seed: seed as never });
});
afterEach(async () => {
  await served.close();
  rmSync(root, { recursive: true, force: true });
});

describe("the store behind HTTP", () => {
  it("answers with the graph, the log and the stored version", async () => {
    const state = await (await fetch(`${served.url}/graview/state`)).json();
    expect(state.version).toBe(1);
    expect(state.snapshot.nodes).toHaveLength(2);
    expect(state.log).toEqual([]);
  });

  it("keeps the data where a person can read it", async () => {
    const remote = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    await remote.send([{ name: "finish", args: { id: "t1" } }]);
    // One operation per line, which is what makes `grep` an answer.
    const lines = readFileSync(join(root, "served", "log.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).author.id).toBe("u-keeper");
    expect(JSON.parse(readFileSync(join(root, "served", "meta.json"), "utf8")).version).toBe(1);
    const snapshot = JSON.parse(readFileSync(join(root, "served", "snapshot.json"), "utf8"));
    expect(snapshot.nodes.find((node: { id: string }) => node.id === "t1").done).toBe(true);
    remote.close();
  });

  it("refuses on the server exactly what it refuses in a browser, in the policy's own words", async () => {
    const remote = await openRemote({ app, url: served.url, principal: READER, pollMs: 0 });
    await expect(remote.send([{ name: "finish", args: { id: "t1" } }])).rejects.toThrow(/keeper/);
    expect(done(served.store, "t1")).toBe(false);
    remote.close();
  });

  it("refuses a seat's own act LOCALLY, before the wire is involved at all", async () => {
    /*
     * The browser store carries the same policy, so the refusal is
     * immediate and in the same words — the server never hears about it.
     * That is the right behaviour and worth pinning: a design where every
     * refusal cost a round trip would make a policy feel like latency.
     */
    const remote = await openRemote({ app, url: served.url, principal: READER, pollMs: 0 });
    expect(() => remote.store.apply({ name: "finish", args: { id: "t1" } })).toThrow(/keeper/);
    expect(served.store.log.all()).toEqual([]);
    remote.close();
  });

  it("takes back what the server refused, rather than leaving it on screen", async () => {
    /*
     * The case the two sides can actually disagree about: both permit the
     * call, and the graph has moved where it counts. Somebody else finished
     * it while this browser was looking at the old answer — so the hopeful
     * change goes on screen for a moment and is taken back, which is the
     * only honest end. Leaving it would mean showing a graph the server
     * does not have.
     */
    const one = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    const two = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    await one.send([{ name: "finish", args: { id: "t1" } }]);

    const said: string[] = [];
    two.onRefusal((reason) => said.push(reason));
    two.store.apply({ name: "finish", args: { id: "t1" } });
    // For that moment, the second browser believes it.
    expect(done(two.store, "t1")).toBe(true);
    await new Promise((settle) => setTimeout(settle, 80));
    expect(said[0]).toMatch(/already finished/);
    // Taken back — and the server's own op then brings the truth.
    await two.pull();
    expect(done(two.store, "t1")).toBe(true);
    /*
     * The server's op is in both. This browser's log also holds the
     * provisional one and the take-back — which is honest: they happened
     * here, and the activity rail showing both is the truth about what a
     * person saw.
     */
    expect(two.store.log.all().map((op) => op.id)).toContain(one.store.log.all()[0]!.id);
    expect(two.store.log.all().map((op) => op.seq)).toEqual([0, 1, 2]);
    one.close();
    two.close();
  });

  it("lets two clients see each other", async () => {
    const one = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    const two = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    await one.send([{ name: "finish", args: { id: "t2" } }]);
    expect(done(two.store, "t2")).toBe(false);
    await two.pull();
    expect(done(two.store, "t2")).toBe(true);
    // The same op, not a second one with the same effect: two browsers that
    // minted their own ids would diverge rather than converge.
    // The server's op is in both, whatever provisional ones this browser
    // minted along the way.
    expect(two.store.log.all().map((op) => op.id)).toContain(one.store.log.all()[0]!.id);
    one.close();
    two.close();
  });

  it("ignores an op it already has, so a poll that overlaps is not a second change", async () => {
    const remote = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    await remote.send([{ name: "finish", args: { id: "t1" } }]);
    const before = remote.store.log.all().length;
    await remote.pull();
    await remote.pull();
    expect(remote.store.log.all()).toHaveLength(before);
    remote.close();
  });

  it("still has everything after a restart", async () => {
    const remote = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    await remote.send([{ name: "finish", args: { id: "t1" } }]);
    remote.close();
    await served.close();

    served = await serveStore({ app, adapter: createFileAdapter(root) });
    const again = await (await fetch(`${served.url}/graview/state`)).json();
    expect(again.snapshot.nodes.find((node: { id: string }) => node.id === "t1").done).toBe(true);
    expect(again.log).toHaveLength(1);
    expect(again.version).toBe(1);
  });

  it("reports where the data is, and which adapter is keeping it", async () => {
    const report = await (await fetch(`${served.url}/graview/health`)).json();
    expect(report.ok).toBe(true);
    expect(report.adapter).toBe("file");
    expect(report.where).toContain(root);
  });
});

describe("a migration runs on the server, once", () => {
  it("carries a stored graph forward and says so", async () => {
    const grown = defineApp({
      ...app,
      version: 2,
      migrations: [
        {
          from: 1,
          to: 2,
          title: "Everything gets a third task",
          apply: (snapshot) =>
            snapshot.nodes.some((node) => node.id === "t3")
              ? []
              : [{ op: "add-node" as const, node: { id: "t3", kind: "task", label: "Send the list", done: false } }],
        },
      ],
    });
    await served.close();
    served = await serveStore({ app: grown, adapter: createFileAdapter(root) });
    expect(served.opened.migrated).toHaveLength(1);
    expect(served.store.graph.getNode("t3")).toBeDefined();

    // And not again: a migration is once, whatever restarts.
    await served.close();
    served = await serveStore({ app: grown, adapter: createFileAdapter(root) });
    expect(served.opened.migrated).toEqual([]);
    expect(JSON.parse(readFileSync(join(root, "served", "meta.json"), "utf8")).version).toBe(2);
  });
});
