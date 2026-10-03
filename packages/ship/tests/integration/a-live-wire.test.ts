import { createMemoryAdapter, createSchema, defineApp, defineMutation, defineNode, nodeRef, type Operation, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, LIVE_PATH, openRemote, seatHeaders, serveStore, type LiveServerMessage, type RemoteConflict, type RemoteStore, type ServedStore } from "../../src/index.js";

/**
 * A LIVE WIRE (FR-05): ops pushed as they land, pending edits rebased, and a
 * stale write a conflict rather than a loss.
 *
 * The served store answered a poll every 800 ms, and two people who changed
 * one field had the second overwrite the first without either knowing. Now
 * `openRemote({ live: true })` holds a WebSocket the server pushes every op
 * down, a call carries the revision of each field it changes, and a field
 * that moved since is refused by name — theirs and yours — with nothing
 * overwritten. Polling stays: it is the wire a person can drive with curl.
 */

const task = defineNode("task", {
  fields: z.object({ label: z.string().min(1), done: z.boolean(), note: z.string().optional() }),
  plural: "Tasks",
  label: (node) => node.label,
});
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  describe: (args) => `Rename to “${args.label}”`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const annotate = defineMutation("annotate", {
  title: "Note",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["note"],
  input: z.object({ id: nodeRef(["task"]), note: z.string() }),
  describe: (args) => `Note “${args.note}”`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { note: args.note });
  },
});
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    if (ctx.graph.getNode(args.id)) return;
    ctx.addNode({ id: args.id, kind: "task", label: args.label, done: false });
  },
});
const schema = createSchema([task]);
const app = defineApp({
  name: "live",
  schema,
  mutations: [rename, annotate, add],
  policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*", describe: "The keeper keeps everything." }] },
  version: 1,
});
const seed = {
  nodes: [
    { id: "t1", kind: "task", label: "Book the hall", done: false },
    { id: "t2", kind: "task", label: "Pay the deposit", done: false },
  ],
  edges: [],
};
const sam: Principal = { kind: "human", id: "sam", name: "Sam", roles: ["keeper"] };
const ana: Principal = { kind: "human", id: "ana", name: "Ana", roles: ["keeper"] };
const kit: Principal = { kind: "human", id: "kit", name: "Kit", roles: ["keeper"] };

type Task = { label: string; done: boolean; note?: string };
const node = (remote: { store: { graph: { getNode(id: string): unknown } } }, id: string) => remote.store.graph.getNode(id) as Task;
const until = async (holds: () => boolean, ms = 2000) => {
  const start = Date.now();
  while (!holds()) {
    if (Date.now() - start > ms) throw new Error("It never came true.");
    await new Promise((tick) => setTimeout(tick, 2));
  }
  return Date.now() - start;
};

let served: ServedStore<typeof schema> | undefined;
const opened: RemoteStore<typeof schema>[] = [];
const open = async (principal: Principal, extra: Partial<Parameters<typeof openRemote>[0]> = {}) => {
  const remote = await openRemote({ app, url: served!.url, principal, live: true, ...extra });
  opened.push(remote as never);
  return remote;
};
afterEach(async () => {
  for (const remote of opened.splice(0)) remote.close();
  await served?.close();
  served = undefined;
});

/** A raw socket on the served store, as a seat, with every message it hears kept. */
async function socketAs(principal: Principal) {
  const heard: LiveServerMessage[] = [];
  const socket = new WebSocket(`${served!.url.replace(/^http/, "ws")}${LIVE_PATH}`, { headers: seatHeaders(principal) } as never);
  socket.onmessage = (event) => heard.push(JSON.parse(String(event.data)) as LiveServerMessage);
  await new Promise<void>((ready, fail) => {
    socket.onopen = () => ready();
    socket.onerror = () => fail(new Error("The socket did not open."));
  });
  return { socket, heard, say: (message: unknown) => socket.send(JSON.stringify(message)) };
}

describe("a live wire", () => {
  it("lets two live clients see each other's ops in under 200 ms, and a polling client on the same store still converges", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const one = await open(sam);
    const two = await open(ana);
    const poller = await open(kit, { live: false, pollMs: 0 });
    expect(one.transport()).toBe("socket");
    expect(two.transport()).toBe("socket");
    expect(poller.transport()).toBe("poll");

    one.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
    const took = await until(() => node(two, "t1").label === "Book the big hall");
    expect(took).toBeLessThan(200);
    two.store.apply({ name: "annotate", args: { id: "t2", note: "By Friday" } });
    expect(await until(() => node(one, "t2").note === "By Friday")).toBeLessThan(200);

    await Promise.all([one.settled(), two.settled()]);
    await poller.pull();
    const ids = (remote: RemoteStore<typeof schema>) => remote.store.log.all().map((op) => op.id);
    expect(ids(one)).toEqual(served.store.log.all().map((op) => op.id));
    expect(ids(two)).toEqual(ids(one));
    expect(ids(poller)).toEqual(ids(one));
    expect(poller.store.snapshot()).toEqual(served.store.snapshot());
    expect(one.store.snapshot()).toEqual(served.store.snapshot());
  });

  it("keeps a pending optimistic edit through an interleaved remote op, and then the server confirms it or refuses it", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    /*
     * A socket whose calls the test holds: what this client sends waits
     * until the test lets it go, so a remote op lands in between.
     */
    let held: string[] = [];
    let holding = true;
    let deliver: (text: string) => void = () => {};
    const socket = (url: string) => {
      const fake = {
        readyState: 0,
        onopen: null as null | ((event: unknown) => void),
        onmessage: null as null | ((event: { data: unknown }) => void),
        onclose: null as null | ((event: { code: number; reason: string }) => void),
        onerror: null as null | ((event: unknown) => void),
        send(text: string) {
          if (holding && text.includes('"t":"call"')) held.push(text);
          else deliver(text);
        },
        close() {
          fake.readyState = 3;
        },
      };
      void handler
        .connect(new Request(url.replace(/^ws/, "http"), { headers: seatHeaders(sam) }), {
          send: (text) => setTimeout(() => fake.onmessage?.({ data: text }), 0),
          close: () => fake.close(),
        })
        .then((connection) => {
          if (connection instanceof Response) throw new Error("refused");
          deliver = (text) => connection.receive(text);
          fake.readyState = 1;
          fake.onopen?.({});
        });
      return fake;
    };
    const remote = await openRemote({ app, url: "http://store.example", principal: sam, live: true, socket, fetch: ((url: string, init?: RequestInit) => handler.handle(new Request(url, { ...init, headers: { ...(init?.headers as Record<string, string>) } }))) as typeof fetch });
    opened.push(remote as never);
    expect(remote.transport()).toBe("socket");

    // Confirmed: Sam renames t1; Ana notes t2 on the server before Sam's call arrives.
    remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
    handler.store.apply({ name: "annotate", args: { id: "t2", note: "By Friday" } }, { author: ana });
    await until(() => node(remote, "t2").note === "By Friday");
    expect(node(remote, "t1").label).toBe("Book the big hall");
    const pendingOp = remote.store.log.all().at(-1)!;
    expect(pendingOp.intent).toBe("Rename to “Book the big hall”");
    expect(remote.store.log.all().at(-2)!.intent).toBe("Note “By Friday”");
    holding = false;
    for (const text of held.splice(0)) deliver(text);
    await remote.settled();
    expect(node(remote, "t1").label).toBe("Book the big hall");
    expect(handler.store.graph.getNode("t1")).toMatchObject({ label: "Book the big hall" });
    expect(remote.store.log.all().map((op) => op.id)).toEqual(handler.store.log.all().map((op) => op.id));

    // Refused: Sam renames t2 while Ana renames it on the server first — a stale write, taken back.
    holding = true;
    held = [];
    const conflicts: RemoteConflict[] = [];
    remote.onConflict((conflict) => conflicts.push(conflict));
    remote.store.apply({ name: "rename", args: { id: "t2", label: "Pay it" } });
    handler.store.apply({ name: "rename", args: { id: "t2", label: "Pay the deposit today" } }, { author: ana });
    await until(() => remote.store.log.all().some((op) => op.intent === "Rename to “Pay the deposit today”"));
    // Still pending, still shown: the rebase put it back on top.
    expect(node(remote, "t2").label).toBe("Pay it");
    holding = false;
    for (const text of held.splice(0)) deliver(text);
    await remote.settled();
    expect(conflicts).toHaveLength(1);
    expect(node(remote, "t2").label).toBe("Pay the deposit today");
    expect(handler.store.graph.getNode("t2")).toMatchObject({ label: "Pay the deposit today" });
    expect(remote.store.log.all().map((op) => op.id)).toEqual(handler.store.log.all().map((op) => op.id));
    await handler.close();
  });

  it("refuses a stale-revision patch as a conflict naming the field, theirs and yours, and overwrites nothing", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const post = (principal: Principal, body: unknown) =>
      fetch(`${served!.url}/graview/ops`, { method: "POST", headers: { "content-type": "application/json", ...seatHeaders(principal) }, body: JSON.stringify(body) });

    // Ana renames t1; that op is the field's revision now.
    const first = (await (await post(ana, { calls: [{ name: "rename", args: { id: "t1", label: "Book the church hall" } }] })).json()) as { ops: Operation[] };
    const rev = first.ops[0]!.seq;

    // Sam read t1 before that, and says so.
    const stale = await post(sam, { calls: [{ name: "rename", args: { id: "t1", label: "Book the village hall" } }], base: [{ node: "t1", field: "label", rev: -1 }] });
    expect(stale.status).toBe(409);
    const said = (await stale.json()) as { error: string; conflict: boolean; conflicts: { node: string; field: string; theirs: unknown; yours: unknown; by: string; rev: number }[] };
    expect(said.conflict).toBe(true);
    expect(said.conflicts).toEqual([{ node: "t1", field: "label", theirs: "Book the church hall", yours: "Book the village hall", by: "Ana", rev, saw: -1 }]);
    expect(said.error).toContain("Ana changed label");
    expect(said.error).toContain("Book the church hall");
    expect(said.error).toContain("Book the village hall");
    expect(served.store.graph.getNode("t1")).toMatchObject({ label: "Book the church hall" });
    expect(served.store.log.all()).toHaveLength(1);

    // Having seen it, the same call stands.
    expect((await post(sam, { calls: [{ name: "rename", args: { id: "t1", label: "Book the village hall" } }], base: [{ node: "t1", field: "label", rev }] })).status).toBe(200);

    // Through openRemote: the person chooses — keep theirs, or use mine.
    const one = await open(sam, { live: false, pollMs: 0 });
    const two = await open(ana, { live: false, pollMs: 0 });
    const conflicts: RemoteConflict[] = [];
    one.onConflict((conflict) => conflicts.push(conflict));
    two.store.apply({ name: "rename", args: { id: "t2", label: "Pay the deposit now" } });
    await two.settled();
    one.store.apply({ name: "rename", args: { id: "t2", label: "Pay it later" } });
    await one.settled();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.conflicts).toMatchObject([{ node: "t2", field: "label", theirs: "Pay the deposit now", yours: "Pay it later", by: "Ana" }]);
    expect(node(one, "t2").label).toBe("Pay the deposit now");
    expect(served.store.graph.getNode("t2")).toMatchObject({ label: "Pay the deposit now" });
    conflicts[0]!.useMine();
    await one.settled();
    expect(served.store.graph.getNode("t2")).toMatchObject({ label: "Pay it later" });
    expect(node(one, "t2").label).toBe("Pay it later");
  });

  it("sends a client reconnecting with its last seq exactly the ops it missed", async () => {
    served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    for (const label of ["One", "Two", "Three", "Four"]) served.store.apply({ name: "rename", args: { id: "t1", label } }, { author: ana });
    const { socket, heard, say } = await socketAs(sam);
    say({ t: "hello", seq: 1, protocol: 1 });
    await until(() => heard.some((message) => message.t === "welcome"));
    const welcome = heard.find((message) => message.t === "welcome") as Extract<LiveServerMessage, { t: "welcome" }>;
    expect(welcome.protocol).toBe(1);
    expect(welcome.seq).toBe(3);
    expect(welcome.ops.map((op) => op.seq)).toEqual([2, 3]);
    expect(welcome.ops.map((op) => op.id)).toEqual(served.store.log.all().slice(2).map((op) => op.id));

    // And what lands after, pushed — once each.
    served.store.apply({ name: "rename", args: { id: "t1", label: "Five" } }, { author: ana });
    await until(() => heard.some((message) => message.t === "ops"));
    const pushed = heard.filter((message) => message.t === "ops") as Extract<LiveServerMessage, { t: "ops" }>[];
    expect(pushed.flatMap((message) => message.ops.map((op) => op.seq))).toEqual([4]);
    socket.close();

    // A live client that drops and comes back catches up from where it was.
    const sockets: WebSocket[] = [];
    const remote = await open(sam, {
      socket: (url, headers) => {
        const made = new WebSocket(url, { headers } as never);
        sockets.push(made);
        return made as never;
      },
    });
    expect(remote.transport()).toBe("socket");
    sockets[0]!.close();
    await until(() => remote.transport() === "poll");
    served.store.apply({ name: "rename", args: { id: "t1", label: "Six" } }, { author: ana });
    served.store.apply({ name: "rename", args: { id: "t2", label: "Seven" } }, { author: ana });
    await until(() => node(remote, "t2").label === "Seven", 4000);
    expect(remote.store.log.all().map((op) => op.id)).toEqual(served.store.log.all().map((op) => op.id));
  });

  it("converges three clients' interleaved calls to identical snapshots", async () => {
    let state = 20260930;
    const random = () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
    const tally = { conflicts: 0, refusals: 0, ops: 0 };
    for (let round = 0; round < 5; round++) {
      served = await serveStore({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
      const clients = [await open(sam), await open(ana, { live: round % 2 === 0 }), await open(kit, { live: false, pollMs: 15 })];
      for (const client of clients) {
        client.onConflict(() => tally.conflicts++);
        client.onRefusal(() => tally.refusals++);
      }
      const ids = ["t1", "t2"];
      for (let step = 0; step < 40; step++) {
        const client = clients[Math.floor(random() * clients.length)]!;
        const pick = random();
        const id = ids[Math.floor(random() * ids.length)]!;
        try {
          if (pick < 0.4) client.store.apply({ name: "rename", args: { id, label: `L${round}.${step}` } });
          else if (pick < 0.7) client.store.apply({ name: "annotate", args: { id, note: `N${round}.${step}` } });
          else if (pick < 0.85) {
            const fresh = `t${round}x${step}`;
            client.store.apply({ name: "add", args: { id: fresh, label: `New ${step}` } });
            ids.push(fresh);
          } else {
            const last = client.store.batches().filter((batch) => !batch.undone).at(-1);
            if (last) client.store.undo(last.id);
          }
        } catch {
          // A call the local store refuses never reaches the wire; that is a result, not a failure.
        }
        if (random() < 0.3) await new Promise((tick) => setTimeout(tick, Math.floor(random() * 6)));
      }
      await Promise.all(clients.map((client) => client.settled()));
      for (const client of clients) await client.pull();
      await Promise.all(clients.map((client) => client.settled()));
      for (const client of clients) await client.pull();
      const truth = served.store.snapshot();
      for (const client of clients) {
        expect(client.store.snapshot()).toEqual(truth);
        expect(client.store.log.all().map((op) => op.id)).toEqual(served.store.log.all().map((op) => op.id));
      }
      tally.ops += served.store.log.length;
      for (const client of opened.splice(0)) client.close();
      await served.close();
      served = undefined;
    }
    // Interleaved enough to mean something: stale writes met, and most calls landed.
    expect(tally.conflicts).toBeGreaterThan(0);
    expect(tally.ops).toBeGreaterThan(100);
  }, 30_000);
});
