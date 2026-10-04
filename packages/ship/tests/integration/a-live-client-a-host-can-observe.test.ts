import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef, type Presence, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, openRemote, seatHeaders, type LiveSocketLike, type RemoteStatus, type RemoteStore, type StoreHandler } from "../../src/index.js";

/**
 * A LIVE CLIENT A HOST CAN OBSERVE (FR-49).
 *
 * A host's shell shows an offline banner, counts reconnects for its beacon,
 * and says how many changes have not reached the server yet. `openRemote`
 * said only which transport it was on, with no event, so a banner had to
 * poll for it — and a call made while the server was away was taken back as
 * if the server had refused it. Now the client says `connecting`, `online`
 * or `offline` as it changes, counts what happened to it, holds a call it
 * could not deliver until the server is back, and lets the host say how it
 * backs off, how often it says where it is, and whether anybody is looking.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string().min(1), done: z.boolean() }),
  plural: "Tasks",
  label: (node) => node.label,
});
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
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
const app = defineApp({
  name: "observed",
  schema,
  mutations: [rename],
  policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*", describe: "The keeper keeps everything." }] },
  version: 1,
});
const seed = {
  nodes: [
    { id: "t1", kind: "task", label: "Book the hall", done: false },
    { id: "t2", kind: "task", label: "Pay the deposit", done: false },
    { id: "t3", kind: "task", label: "Print the flyers", done: false },
  ],
  edges: [],
};
const sam: Principal = { kind: "human", id: "sam", name: "Sam", roles: ["keeper"] };
const ana: Principal = { kind: "human", id: "ana", name: "Ana", roles: ["keeper"] };

const label = (remote: RemoteStore<typeof schema>, id: string) => (remote.store.graph.getNode(id) as { label?: string } | undefined)?.label;
const until = async (holds: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!holds()) {
    if (Date.now() - start > ms) throw new Error("It never came true.");
    await new Promise((tick) => setTimeout(tick, 2));
  }
};

/**
 * A HOST THAT CAN BE TAKEN AWAY: the real handler, behind a fetch and a
 * socket that both stop reaching it while it is down — a fetch rejects as a
 * network does, an open socket closes and a new one never opens.
 */
function aHost(handler: StoreHandler<typeof schema>) {
  let up = true;
  const open = new Set<{ fake: LiveSocketLike & { readyState: number }; connection?: { close(): void } }>();
  const sent: string[] = [];
  const drop = (fake: LiveSocketLike & { readyState: number }) => {
    if (fake.readyState === 3) return;
    fake.readyState = 3;
    fake.onclose?.({ code: 1006, reason: "" });
  };
  const fetchVia = (async (url: string, init?: RequestInit) => {
    if (!up) throw new TypeError("fetch failed");
    return handler.handle(new Request(url, init));
  }) as typeof fetch;
  const socket = (url: string): LiveSocketLike => {
    const fake = {
      readyState: 0,
      onopen: null as null | ((event: unknown) => void),
      onmessage: null as null | ((event: { data: unknown }) => void),
      onclose: null as null | ((event: { code: number; reason: string }) => void),
      onerror: null as null | ((event: unknown) => void),
      send(text: string) {
        sent.push(text);
        deliver(text);
      },
      close() {
        drop(fake);
      },
    };
    let deliver: (text: string) => void = () => {};
    if (!up) {
      setTimeout(() => drop(fake), 0);
      return fake;
    }
    const held: { fake: typeof fake; connection?: { close(): void } } = { fake };
    open.add(held);
    void handler
      .connect(new Request(url.replace(/^ws/, "http"), { headers: seatHeaders(sam) }), {
        send: (text) => setTimeout(() => fake.readyState === 1 && fake.onmessage?.({ data: text }), 0),
        close: () => drop(fake),
      })
      .then((connection) => {
        if (connection instanceof Response) throw new Error("refused");
        held.connection = connection;
        deliver = (text) => connection.receive(text);
        fake.readyState = 1;
        fake.onopen?.({});
      });
    return fake;
  };
  return {
    fetch: fetchVia,
    socket,
    sent,
    down() {
      up = false;
      for (const held of open) {
        held.connection?.close();
        drop(held.fake);
      }
      open.clear();
    },
    up() {
      up = true;
    },
  };
}

const opened: RemoteStore<typeof schema>[] = [];
const handlers: StoreHandler<typeof schema>[] = [];
afterEach(async () => {
  for (const remote of opened.splice(0)) remote.close();
  for (const handler of handlers.splice(0)) await handler.close();
});
const aHandler = async () => {
  const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
  handlers.push(handler);
  return handler;
};

describe("a live client a host can observe", () => {
  it("goes offline when the server is taken away, holds the calls made meanwhile as pending, and lands them once it is back", async () => {
    const handler = await aHandler();
    const host = aHost(handler);
    const remote = await openRemote({ app, url: "http://store.example", principal: sam, live: true, socket: host.socket, fetch: host.fetch, pollMs: 20, backoff: () => 15 });
    opened.push(remote);
    expect(remote.transport()).toBe("socket");
    expect(remote.status()).toBe("online");
    expect(remote.pending()).toBe(0);
    expect(remote.counters()).toEqual({ reconnects: 0, rebases: 0, conflicts: 0, resyncs: 0 });

    // A banner driven by the status, as Cloud's shell drives its own.
    const banner: boolean[] = [];
    const statuses: RemoteStatus[] = [];
    remote.onStatus((status) => {
      statuses.push(status);
      const showing = banner.at(-1) ?? false;
      if ((status === "offline") !== showing) banner.push(status === "offline");
    });

    host.down();
    await until(() => remote.status() === "offline");
    remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
    remote.store.apply({ name: "rename", args: { id: "t2", label: "Pay it today" } });
    // Shown here, held for the server: neither taken back while it is away.
    await new Promise((tick) => setTimeout(tick, 120));
    expect(remote.status()).toBe("offline");
    expect(remote.pending()).toBe(2);
    expect(label(remote, "t1")).toBe("Book the big hall");
    expect(label(remote, "t2")).toBe("Pay it today");
    // Somebody else's change reaches the server while this client cannot.
    handler.store.apply({ name: "rename", args: { id: "t3", label: "Print the posters" } }, { author: ana });

    host.up();
    await until(() => remote.status() === "online" && remote.transport() === "socket");
    await remote.settled();
    expect(remote.pending()).toBe(0);
    expect(handler.store.graph.getNode("t1")).toMatchObject({ label: "Book the big hall" });
    expect(handler.store.graph.getNode("t2")).toMatchObject({ label: "Pay it today" });
    expect(label(remote, "t3")).toBe("Print the posters");
    expect(remote.store.log.all().map((op) => op.id)).toEqual(handler.store.log.all().map((op) => op.id));
    expect(remote.store.snapshot()).toEqual(handler.store.snapshot());
    expect(handler.store.log.all().filter((op) => op.intent === "Rename to “Book the big hall”")).toHaveLength(1);

    const counted = remote.counters();
    expect(counted.reconnects).toBe(1);
    // Ana's op landed under the two held calls.
    expect(counted.rebases).toBeGreaterThanOrEqual(1);
    expect(counted.conflicts).toBe(0);
    // Shown once, hidden once.
    expect(statuses).toEqual(["offline", "online"]);
    expect(banner).toEqual([true, false]);
  });

  it("says a polling client is offline when a poll fails and online when one lands", async () => {
    const handler = await aHandler();
    const host = aHost(handler);
    const remote = await openRemote({ app, url: "http://store.example", principal: sam, fetch: host.fetch, pollMs: 0 });
    opened.push(remote);
    expect(remote.status()).toBe("online");
    const statuses: RemoteStatus[] = [];
    remote.onStatus((status) => statuses.push(status));

    host.down();
    await expect(remote.pull()).rejects.toThrow();
    expect(remote.status()).toBe("offline");
    remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
    await new Promise((tick) => setTimeout(tick, 20));
    expect(remote.pending()).toBe(1);
    expect(label(remote, "t1")).toBe("Book the big hall");

    host.up();
    await remote.pull();
    await remote.settled();
    expect(remote.status()).toBe("online");
    expect(remote.pending()).toBe(0);
    expect(handler.store.graph.getNode("t1")).toMatchObject({ label: "Book the big hall" });
    expect(remote.store.snapshot()).toEqual(handler.store.snapshot());
    expect(statuses).toEqual(["offline", "online"]);
    expect(remote.counters().reconnects).toBe(1);
  });

  it("lands a call once when the server took it but its answer was lost, and the client sends it again", async () => {
    const handler = await aHandler();
    let lose = 1;
    const fetchVia = (async (url: string, init?: RequestInit) => {
      const answered = await handler.handle(new Request(url, init));
      // The server took it; the answer never came back.
      if (url.endsWith("/graview/ops") && lose > 0) {
        lose--;
        throw new TypeError("fetch failed");
      }
      return answered;
    }) as typeof fetch;
    const remote = await openRemote({ app, url: "http://store.example", principal: sam, fetch: fetchVia, pollMs: 0 });
    opened.push(remote);
    const told: string[] = [];
    remote.onRefusal((reason) => told.push(reason));
    remote.onConflict((conflict) => told.push(conflict.sentence));

    remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } });
    await until(() => remote.status() === "offline");
    expect(remote.pending()).toBe(1);
    expect(handler.store.log.all().filter((op) => op.intent === "Rename to “Book the big hall”")).toHaveLength(1);

    await remote.pull();
    await remote.settled();
    expect(remote.status()).toBe("online");
    expect(remote.pending()).toBe(0);
    expect(handler.store.log.all().filter((op) => op.intent === "Rename to “Book the big hall”")).toHaveLength(1);
    expect(remote.store.log.all().map((op) => op.id)).toEqual(handler.store.log.all().map((op) => op.id));
    expect(remote.store.snapshot()).toEqual(handler.store.snapshot());
    // Answered as the call it was, not as a conflict with itself.
    expect(told).toEqual([]);
    expect(remote.counters().conflicts).toBe(0);

    // An undo sent twice is taken back once, too.
    const [mine] = handler.store.log.all().filter((op) => op.intent === "Rename to “Book the big hall”");
    lose = 1;
    remote.store.undo(mine!.batch);
    await until(() => remote.status() === "offline");
    await remote.pull();
    await remote.settled();
    expect(handler.store.graph.getNode("t1")).toMatchObject({ label: "Book the hall" });
    expect(handler.store.log.length).toBe(2);
    expect(told).toEqual([]);
    expect(remote.store.log.all().map((op) => op.id)).toEqual(handler.store.log.all().map((op) => op.id));
    expect(remote.store.snapshot()).toEqual(handler.store.snapshot());
  });

  it("answers a batch the HTTP route already has with the ops it made, for a call and for an undo", async () => {
    const handler = await aHandler();
    const post = async (body: unknown) =>
      (await (await handler.handle(new Request("http://store.example/graview/ops", { method: "POST", headers: { "content-type": "application/json", ...seatHeaders(sam) }, body: JSON.stringify(body) }))).json()) as {
        ops: { id: string; batch: string }[];
        batch: string;
        error?: string;
      };
    const call = { calls: [{ name: "rename", args: { id: "t1", label: "Book the big hall" } }], batch: "batch:samtab:1", base: [{ node: "t1", field: "label", rev: -1 }] };
    const first = await post(call);
    const again = await post(call);
    expect(again.error).toBeUndefined();
    expect(again).toEqual(first);
    expect(first.batch).toBe("batch:samtab:1");
    expect(handler.store.log.length).toBe(1);

    const undo = { undo: ["batch:samtab:1"], batch: "undo:samtab:2" };
    const undone = await post(undo);
    expect(await post(undo)).toEqual(undone);
    expect(handler.store.log.length).toBe(2);
    expect(handler.store.graph.getNode("t1")).toMatchObject({ label: "Book the hall" });
  });

  it("counts a conflict, and an answered refusal is the server reached, not offline", async () => {
    const handler = await aHandler();
    const host = aHost(handler);
    const remote = await openRemote({ app, url: "http://store.example", principal: sam, fetch: host.fetch, pollMs: 0 });
    opened.push(remote);
    handler.store.apply({ name: "rename", args: { id: "t1", label: "Book the church hall" } }, { author: ana });
    remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the village hall" } });
    await remote.settled();
    expect(remote.counters().conflicts).toBe(1);
    expect(remote.status()).toBe("online");
    expect(remote.pending()).toBe(0);
  });

  it("backs off as the host says, by a function of the attempt", async () => {
    const handler = await aHandler();
    const host = aHost(handler);
    const attempts: number[] = [];
    const remote = await openRemote({
      app,
      url: "http://store.example",
      principal: sam,
      live: true,
      socket: host.socket,
      fetch: host.fetch,
      pollMs: 0,
      backoff: (attempt) => {
        attempts.push(attempt);
        return 5;
      },
    });
    opened.push(remote);
    host.down();
    await until(() => attempts.length >= 3);
    host.up();
    await until(() => remote.transport() === "socket");
    expect(attempts.slice(0, 3)).toEqual([0, 1, 2]);
    expect(remote.status()).toBe("online");
    expect(remote.counters().reconnects).toBe(1);
  });

  it("says where it is no more often than presenceEveryMs, and not at all while nobody is looking", async () => {
    const handler = await aHandler();
    const host = aHost(handler);
    let looking = true;
    const remote = await openRemote({
      app,
      url: "http://store.example",
      principal: sam,
      live: true,
      socket: host.socket,
      fetch: host.fetch,
      pollMs: 0,
      presenceEveryMs: 60_000,
      visible: () => looking,
    });
    opened.push(remote);
    const here = () => host.sent.filter((text) => text.includes('"t":"here"')).length;
    const where = (stop: string): Presence => ({ participant: "human:sam:tab", name: "Sam", hue: 200, stop, at: new Date().toISOString() });

    remote.presence.here(where("t1"));
    expect(here()).toBe(1);
    // The same place again, inside the interval: not said again.
    remote.presence.here(where("t1"));
    expect(here()).toBe(1);
    // A new place is said at once.
    remote.presence.here(where("t2"));
    expect(here()).toBe(2);

    looking = false;
    remote.presence.here(where("t3"));
    expect(here()).toBe(2);
    looking = true;
    remote.presence.here(where("t3"));
    expect(here()).toBe(3);
  });
});
