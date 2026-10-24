import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindSchema, createSchema, defineApp, defineNode, FORMATS, inverseOf, NewerFormatError, Store, withInverse, type Operation, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  assertBundle,
  createFileAdapter,
  createStoreHandler,
  exportBundle,
  liveProtocol,
  openRemote,
  openStore,
  opFormatOf,
  type LiveClientMessage,
  type LivePeer,
  type LiveServerMessage,
  type LiveSocketLike,
} from "../../src/index.js";

/**
 * OP FORMAT 2 ON DISK AND ON THE WIRE (Roadmap f-ops-without-inverse-on-the-wire).
 *
 * A store keeps no inverse, and neither does what it writes or sends to a
 * reader that says it reads format 2. A client before 0.1.43 says nothing
 * and reads each op's inverse off the op, so it is sent ops as format 1 had
 * them; a store on disk from before opens, undoes and goes on; and a bundle
 * from before imports.
 */
const card = defineNode("card", { fields: z.object({ label: z.string().min(1), image: z.string().optional() }) });
const schema = createSchema([card]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add a card",
  creates: ["card"],
  input: z.object({ id: z.string(), label: z.string().min(1), image: z.string().optional() }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "card", label: args.label, ...(args.image ? { image: args.image } : {}) });
  },
});
const picture = defineMutation("picture", {
  title: "Change the picture",
  subject: { kinds: ["card"], arg: "id" },
  writes: ["image"],
  input: z.object({ id: z.string(), image: z.string() }),
  describe: () => "Change the picture",
  apply(ctx, args) {
    ctx.patchNode(args.id, { image: args.image });
  },
});
const app = defineApp({ name: "cards", schema, mutations: [add, picture], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const kim: Principal = { kind: "human", id: "kim", name: "Kim", roles: ["keeper"] };
const IMAGE = `data:image/png;base64,${"iVBORw0KGgo".repeat(1800)}`;
const OTHER = `data:image/png;base64,${"R0lGODlh".repeat(2400)}`;

const aStore = () => {
  const store = new Store({ schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } as never });
  store.apply({ name: "add", args: { id: "c1", label: "Cover", image: IMAGE } }, { author: kim });
  store.apply({ name: "picture", args: { id: "c1", image: OTHER } }, { author: kim });
  return store;
};
const carry = (ops: readonly Operation[]) => ops.every((op) => Array.isArray(op.inverse));
const bare = (ops: readonly Operation[]) => ops.every((op) => !("inverse" in op));

function peerOf(state: LivePeer | ReturnType<ReturnType<typeof liveProtocol<typeof schema>>["open"]>) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...state, send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) };
  return { peer, heard };
}

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("a reader is sent the op format it reads", () => {
  it("routes answer ops bare to a reader of format 2, and with their inverses to one that says nothing", async () => {
    const store = aStore();
    const live = liveProtocol({ store });
    const older = { seat: kim, via: "api" };
    const newer = { seat: kim, via: "api", opFormat: 2 };
    const log = (answer: { body: Record<string, unknown> }) => answer.body["log"] as Operation[];
    expect(carry(log(live.state(older)))).toBe(true);
    expect(bare(log(live.state(newer)))).toBe(true);
    expect(log(live.state(older)).map((op) => op.inverse)).toEqual(store.log.all().map(inverseOf));
    expect(carry(live.since(-1, older).body["ops"] as Operation[])).toBe(true);
    expect(bare(live.since(-1, newer).body["ops"] as Operation[])).toBe(true);
    const posted = await live.post(JSON.stringify({ calls: [{ name: "add", args: { id: "c2", label: "Back" } }], batch: "batch:kimtab:1" }), older);
    expect(carry(posted.body["ops"] as Operation[])).toBe(true);
    const again = await live.post(JSON.stringify({ calls: [{ name: "add", args: { id: "c3", label: "Spine" } }], batch: "batch:kimtab:2" }), newer);
    expect(bare(again.body["ops"] as Operation[])).toBe(true);
    // What each costs: the older reader is sent the first picture once more for the add and once for the change, and the second once.
    const bytes = (answer: { body: Record<string, unknown> }) => JSON.stringify(answer.body).length;
    expect(bytes(live.state(older)) - bytes(live.state(newer))).toBeGreaterThan(2 * IMAGE.length + OTHER.length);
  });

  it("the handler reads the format off the request", async () => {
    const handler = await createStoreHandler({ app, store: aStore(), seatOf: () => kim });
    const state = async (query: string) => (await (await handler.handle(new Request(`https://store.example/graview/state${query}`))).json()) as { log: Operation[] };
    expect(carry((await state("")).log)).toBe(true);
    expect(bare((await state(`?opFormat=${FORMATS.op}`)).log)).toBe(true);
    expect(opFormatOf("https://store.example/graview/since?seq=3&opFormat=2")).toBe(2);
    expect(opFormatOf("/graview/since?seq=3")).toBeUndefined();
    await handler.close();
  });

  it("a socket is sent the format its hello said, and two in one publish are each sent their own", async () => {
    const store = aStore();
    const live = liveProtocol({ store });
    const older = peerOf(live.open(kim, "web"));
    const newer = peerOf(live.open(kim, "web"));
    await live.receive(older.peer, JSON.stringify({ t: "hello" }));
    await live.receive(newer.peer, JSON.stringify({ t: "hello", opFormat: 2 }));
    const welcome = (heard: LiveServerMessage[]) => heard[0] as Extract<LiveServerMessage, { t: "welcome" }>;
    expect(carry(welcome(older.heard).state!.log)).toBe(true);
    expect(bare(welcome(newer.heard).state!.log)).toBe(true);
    // The format survives the host keeping the socket's state as JSON.
    expect(JSON.parse(JSON.stringify(newer.peer))).toMatchObject({ opFormat: 2 });
    const changed = store.apply({ name: "picture", args: { id: "c1", image: IMAGE } }, { author: kim });
    live.publish(changed.ops, [older.peer, newer.peer]);
    const pushed = (heard: LiveServerMessage[]) => (heard.find((one) => one.t === "ops") as Extract<LiveServerMessage, { t: "ops" }>).ops;
    expect(carry(pushed(older.heard))).toBe(true);
    expect(bare(pushed(newer.heard))).toBe(true);
    await live.receive(newer.peer, JSON.stringify({ t: "call", cid: "c", calls: [{ name: "add", args: { id: "c9", label: "Nine" } }] }));
    expect(bare((newer.heard.find((one) => one.t === "ack") as Extract<LiveServerMessage, { t: "ack" }>).ops)).toBe(true);
  });

  it("openRemote says the op format it reads, keeps a copy that matches the server's, and undoes through it", async () => {
    const server = aStore();
    const handler = await createStoreHandler({ app, store: server, seatOf: () => kim });
    const asked: string[] = [];
    const fetcher = ((url: string, init?: RequestInit) => {
      asked.push(url);
      return handler.handle(new Request(url, init));
    }) as typeof fetch;
    const said: LiveClientMessage[] = [];
    const socket = (): LiveSocketLike => {
      const fake: LiveSocketLike & { readyState: number } = {
        readyState: 0,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
        send: (text) => void said.push(JSON.parse(text) as LiveClientMessage),
        close() {
          fake.readyState = 3;
        },
      };
      setTimeout(() => {
        fake.readyState = 1;
        fake.onopen?.({});
      }, 0);
      return fake;
    };
    const remote = await openRemote({ app, url: "https://store.example", principal: kim, fetch: fetcher, live: true, pollMs: 0, openTimeoutMs: 30, socket });
    await new Promise((tick) => setTimeout(tick, 10));
    expect(said.find((message) => message.t === "hello")).toMatchObject({ opFormat: FORMATS.op });
    expect(asked.some((url) => url.includes(`/graview/state?opFormat=${FORMATS.op}`))).toBe(true);
    expect(bare(remote.store.log.all())).toBe(true);
    expect(remote.store.snapshot()).toEqual(server.snapshot());
    remote.close();
    await handler.close();
  });

  it("a poll that says where its reader is answers the ops since in the format its request said (FR-210)", async () => {
    const handler = await createStoreHandler({ app, store: aStore(), seatOf: () => kim });
    const here = async (query: string) =>
      (await (
        await handler.handle(
          new Request(`https://store.example/graview/here${query}`, { method: "POST", body: JSON.stringify({ presence: { participant: "human:kim:tab", hue: 1, stop: "/", at: "" }, seq: -1 }) }),
        )
      ).json()) as { ops: Operation[] };
    expect((await here("")).ops).toHaveLength(2);
    expect(carry((await here("")).ops)).toBe(true);
    expect(bare((await here(`?opFormat=${FORMATS.op}`)).ops)).toBe(true);
    await handler.close();
  });

  it("openRemote's poll that says where its reader is says the op format it reads (FR-210)", async () => {
    const server = aStore();
    const handler = await createStoreHandler({ app, store: server, seatOf: () => kim });
    const asked: string[] = [];
    const fetcher = ((url: string, init?: RequestInit) => {
      asked.push(url);
      return handler.handle(new Request(url, init));
    }) as typeof fetch;
    const remote = await openRemote({ app, url: "https://store.example", principal: kim, fetch: fetcher, live: false, pollMs: 0, visible: () => true });
    remote.presence.here({ participant: "human:kim:tab", hue: 1, stop: "/", at: "" });
    server.apply({ name: "add", args: { id: "c2", label: "Back" } }, { author: kim });
    await remote.pull();
    expect(asked.some((url) => url.includes(`/graview/here?opFormat=${FORMATS.op}`))).toBe(true);
    expect(bare(remote.store.log.all())).toBe(true);
    expect(remote.store.snapshot()).toEqual(server.snapshot());
    remote.close();
    await handler.close();
  });

  it("a store on disk from before 0.1.43 opens, undoes, goes on in format 2, and is stamped so", async () => {
    const root = mkdtempSync(join(tmpdir(), "graview-op-format-"));
    scratch.push(root);
    const before = aStore();
    // As 0.1.42 left it: every op with its inverse, a meta saying op format 1.
    mkdirSync(join(root, "cards"), { recursive: true });
    writeFileSync(join(root, "cards", "snapshot.json"), JSON.stringify(before.snapshot()));
    writeFileSync(join(root, "cards", "log.jsonl"), before.log.all().map((op) => JSON.stringify(withInverse(op))).join("\n") + "\n");
    writeFileSync(join(root, "cards", "meta.json"), JSON.stringify({ version: 1, framework: "0.1.42", formats: { snapshot: 1, op: 1 } }));
    const opened = await openStore({ app, adapter: createFileAdapter(root) });
    expect(bare(opened.store.log.all())).toBe(true);
    opened.store.undo(opened.store.batches().at(-1)!.id, { author: kim });
    expect((opened.store.graph.getNode("c1") as { image: string }).image).toBe(IMAGE);
    opened.store.apply({ name: "add", args: { id: "c2", label: "Back" } }, { author: kim });
    await opened.flush?.();
    await new Promise((tick) => setTimeout(tick, 20));
    const lines = readFileSync(join(root, "cards", "log.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as Operation);
    expect(lines).toHaveLength(4);
    expect(carry(lines.slice(0, 2))).toBe(true);
    expect(bare(lines.slice(2))).toBe(true);
    expect(JSON.parse(readFileSync(join(root, "cards", "meta.json"), "utf8"))).toMatchObject({ formats: { op: FORMATS.op } });
    opened.close?.();
    // Opened again, the mixed log reads as one history.
    const again = await openStore({ app, adapter: createFileAdapter(root) });
    expect(again.store.log.all().map((op) => op.intent)).toEqual(["Add “Cover”", "Change the picture", "Undo: Change the picture", "Add “Back”"]);
    expect(again.store.verify().ok).toBe(true);
    again.close?.();
  });

  it("an export is op format 2 or later, with no inverse; one from before imports and undoes the same", () => {
    const store = aStore();
    const bundle = exportBundle(app, store);
    expect(bundle.formats).toMatchObject({ op: FORMATS.op });
    expect(bare(bundle.log)).toBe(true);
    const older = { ...bundle, framework: "0.1.42", formats: { snapshot: 1, op: 1 }, log: bundle.log.map(withInverse) };
    for (const one of [bundle, older]) {
      const read = JSON.parse(JSON.stringify(one)) as typeof bundle;
      expect(() => assertBundle(app, read)).not.toThrow();
      const imported = new Store({ schema, mutations: app.mutations ?? [], snapshot: read.snapshot as never, log: read.log });
      imported.undo(imported.batches().at(-1)!.id);
      expect((imported.graph.getNode("c1") as { image: string }).image).toBe(IMAGE);
    }
    // A reader that predates op format 2 is told, not handed what it would misread.
    expect(() => assertBundle(app, { ...bundle, formats: { snapshot: 1, op: FORMATS.op + 1 } })).toThrow(NewerFormatError);
  });
});
