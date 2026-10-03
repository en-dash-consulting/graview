import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSchema, defineApp, defineMutation, defineNode, nodeRef } from "@graview/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { assertBundle } from "../../src/export.js";
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
  served = await serveStore({ app, adapter: createFileAdapter(root), seed: seed as never, trustSeatHeaders: true });
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

  it("carries a whole gesture and its take-back to the wire, not only a single press", async () => {
    /*
     * A seat's plan lands as `applyAll` and its undo as `undo`. The first
     * version patched `apply` alone, so a robot's plans stayed in the
     * browser that made them while its presses travelled. Both go now,
     * judged on the server as the same seat.
     */
    const one = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    const two = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    const plan = one.store.applyAll(
      [
        { name: "finish", args: { id: "t1" } },
        { name: "finish", args: { id: "t2" } },
      ],
      { intent: "Finish both" },
    );
    await new Promise((settle) => setTimeout(settle, 80));
    await two.pull();
    expect(done(two.store, "t1")).toBe(true);
    expect(done(two.store, "t2")).toBe(true);
    expect(served.store.log.all().at(-1)?.intent).toBe("Finish both");

    one.store.undo(plan.batch);
    await new Promise((settle) => setTimeout(settle, 80));
    await two.pull();
    expect(done(two.store, "t1")).toBe(false);
    expect(done(two.store, "t2")).toBe(false);
    expect(served.store.log.all().at(-1)?.intent).toMatch(/^Undo/);
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

    served = await serveStore({ app, adapter: createFileAdapter(root), trustSeatHeaders: true });
    const again = await (await fetch(`${served.url}/graview/state`)).json();
    expect(again.snapshot.nodes.find((node: { id: string }) => node.id === "t1").done).toBe(true);
    expect(again.log).toHaveLength(1);
    expect(again.version).toBe(1);
  });

  // FR-11: the route called exportBundle(store, app) against exportBundle(app, store) and answered 500.
  it("exports a bundle the app's own assertBundle accepts", async () => {
    const response = await fetch(`${served.url}/graview/export`);
    expect(response.status).toBe(200);
    const bundle = await response.json();
    expect(() => assertBundle(app, bundle)).not.toThrow();
    expect(bundle.app).toBe(app.name);
    expect(bundle.snapshot.nodes.length).toBeGreaterThan(0);
  });

  it("reports where the data is, and which adapter is keeping it", async () => {
    const report = await (await fetch(`${served.url}/graview/health`)).json();
    expect(report.ok).toBe(true);
    expect(report.adapter).toBe("file");
    expect(report.where).toContain(root);
  });
});

describe("who is here, beside the log and never in it", () => {
  const presence = (participant: string, stop: string) => ({ participant, name: participant.split(":")[1]!, hue: 200, stop, at: new Date().toISOString() });

  it("round-trips a presence through the poll, named by the seat that posted it", async () => {
    const one = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    const two = await openRemote({ app, url: served.url, principal: READER, pollMs: 0 });
    const seen: (readonly { participant: string; stop: string }[])[] = [];
    two.presence.onWho((who) => seen.push(who));
    // A poster cannot claim another seat: the id segment is the seat's own.
    one.presence.here(presence("human:somebody-else:tab-a", "#focus=aggregate%3Atask"));
    two.presence.here(presence("human:u-reader:tab-b", "#focus=t1"));
    await one.pull();
    await two.pull();
    expect(seen.at(-1)).toEqual([expect.objectContaining({ participant: "human:u-keeper:tab-a", name: "somebody-else", stop: "#focus=aggregate%3Atask" })]);
    // And the op log stayed the op log.
    expect(served.store.log.all()).toHaveLength(0);
    // A person with curl can still see it.
    const who = (await (await fetch(`${served.url}/graview/who`)).json()) as { who: { participant: string }[] };
    expect(who.who.map((p) => p.participant).sort()).toEqual(["human:u-keeper:tab-a", "human:u-reader:tab-b"]);
    one.close();
    two.close();
  });

  it("carries the ops since on the same heartbeat, so being here costs no round trip", async () => {
    const one = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    const two = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    two.presence.here(presence("human:u-keeper:tab-b", "#focus=t1"));
    await one.send([{ name: "finish", args: { id: "t1" } }]);
    await two.pull();
    expect(done(two.store, "t1")).toBe(true);
    one.close();
    two.close();
  });

  it("forgets a tab that went quiet, and one that said goodbye at once", async () => {
    await served.close();
    served = await serveStore({ app, adapter: createFileAdapter(root), seed: seed as never, presenceTtlMs: 60, trustSeatHeaders: true });
    const one = await openRemote({ app, url: served.url, principal: KEEPER, pollMs: 0 });
    const two = await openRemote({ app, url: served.url, principal: READER, pollMs: 0 });
    const three = await openRemote({ app, url: served.url, principal: { kind: "human", id: "u-third", roles: ["reader"] }, pollMs: 0 });
    const seen: string[][] = [];
    three.presence.onWho((who) => seen.push(who.map((p) => p.participant)));
    one.presence.here(presence("human:u-keeper:a", "#"));
    two.presence.here(presence("human:u-reader:b", "#"));
    three.presence.here(presence("human:u-third:c", "#"));
    await one.pull();
    await two.pull();
    await three.pull();
    expect(seen.at(-1)?.sort()).toEqual(["human:u-keeper:a", "human:u-reader:b"]);
    // Two says goodbye; one just stops talking.
    two.presence.leave();
    await new Promise((settle) => setTimeout(settle, 20));
    await three.pull();
    expect(seen.at(-1)).toEqual(["human:u-keeper:a"]);
    await new Promise((settle) => setTimeout(settle, 90));
    await three.pull();
    expect(seen.at(-1)).toEqual([]);
    one.close();
    three.close();
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
    served = await serveStore({ app: grown, adapter: createFileAdapter(root), trustSeatHeaders: true });
    expect(served.opened.migrated).toHaveLength(1);
    expect(served.store.graph.getNode("t3")).toBeDefined();

    // And not again: a migration is once, whatever restarts.
    await served.close();
    served = await serveStore({ app: grown, adapter: createFileAdapter(root), trustSeatHeaders: true });
    expect(served.opened.migrated).toEqual([]);
    expect(JSON.parse(readFileSync(join(root, "served", "meta.json"), "utf8")).version).toBe(2);
  });
});

describe("a served store believes a seat header only when told to (FR-06)", () => {
  it("without trustSeatHeaders it ignores x-graview-seat and answers 401 when no seatOf is supplied; health still answers", async () => {
    await served.close();
    served = await serveStore({ app, adapter: createFileAdapter(root), seed: seed as never });
    const claim = { "content-type": "application/json", "x-graview-seat": "u-keeper", "x-graview-roles": "keeper" };
    expect((await fetch(`${served.url}/graview/state`, { headers: claim })).status).toBe(401);
    const press = await fetch(`${served.url}/graview/ops`, { method: "POST", headers: claim, body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }] }) });
    expect(press.status).toBe(401);
    expect((served.store.graph.getNode("t1") as { done: boolean }).done).toBe(false);
    expect((await fetch(`${served.url}/graview/health`)).status).toBe(200);
  });

  it("trusted, it records an agent acting for a person as both, and the channel it came through", async () => {
    const agent = { kind: "agent" as const, id: "claude", name: "Claude", roles: ["keeper"], onBehalfOf: { ...KEEPER, name: "Kai" } };
    const remote = await openRemote({ app, url: served.url, principal: agent, via: "mcp:Claude", pollMs: 0 });
    remote.store.apply({ name: "finish", args: { id: "t1" } }, { author: agent });
    await remote.settled();
    const op = served.store.log.all().at(-1)!;
    expect(op.author).toMatchObject({ kind: "agent", id: "claude", name: "Claude", onBehalfOf: { id: "u-keeper", name: "Kai" } });
    expect(op.via).toBe("mcp:Claude");
    remote.close();
  });
});
