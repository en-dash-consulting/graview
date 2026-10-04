import { createSchema, defineApp, defineMutation, defineNode, Store, type GraviewApp, type AnySchema, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, openRemote, type LiveSocketLike } from "../../src/index.js";

/**
 * THE DECLARATION'S NUMBER IS THE HOST'S, AND THE SAME NUMBER IS NOTHING NEW.
 *
 * `liveProtocol({ version })` is the host's own monotonic number for the
 * declaration it serves — Graview Cloud's is its document version, not the
 * document's — and the client hands it to `resolveApp`. The README says a
 * push with the number a client already serves is ignored; this holds it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }) });
const add = defineMutation("add", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string() }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label });
  },
});
const schema = createSchema([task]);
const app = defineApp({ name: "numbered", schema, mutations: [add], version: 7 });
const kim: Principal = { kind: "human", id: "kim" };

describe("the declaration's number is the host's", () => {
  it("ignores a declaration push with the number the client already serves, and asks resolveApp for a new one", async () => {
    const handler = await createStoreHandler({ app, store: new Store({ schema, mutations: [add], snapshot: { nodes: [], edges: [] } as never }), seatOf: () => kim });
    const fetcher = ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
    let push: (message: unknown) => void = () => {};
    const socket = (): LiveSocketLike => {
      const fake: LiveSocketLike & { readyState: number } = {
        readyState: 0,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
        send: (text) => {
          if ((JSON.parse(text) as { t: string }).t === "hello") setTimeout(() => push({ t: "welcome", protocol: 1, version: 7, seq: -1, ops: [] }), 0);
        },
        close() {
          fake.readyState = 3;
        },
      };
      push = (message) => fake.onmessage?.({ data: JSON.stringify(message) });
      setTimeout(() => {
        fake.readyState = 1;
        fake.onopen?.({});
      }, 0);
      return fake;
    };
    const asked: number[] = [];
    const remote = await openRemote({
      app,
      url: "https://store.example",
      principal: kim,
      fetch: fetcher,
      live: true,
      pollMs: 0,
      socket,
      resolveApp: (version) => {
        asked.push(version);
        return new Promise<GraviewApp<AnySchema>>(() => {});
      },
    });
    push({ t: "declaration", version: 7 });
    await new Promise((tick) => setTimeout(tick, 10));
    expect(asked).toEqual([]);
    push({ t: "declaration", version: 8 });
    await new Promise((tick) => setTimeout(tick, 10));
    expect(asked).toEqual([8]);
    remote.close();
    await handler.close();
  });
});
