import { createMemoryAdapter, createSchema, defineApp, defineMutation, defineNode, nodeRef, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, openRemote, seatHeaders, type LiveClientMessage, type LiveSocketLike, type RemoteStore, type StoreHandler } from "../../src/index.js";

/**
 * A VIEW CLAIMS ITS CHANNEL ON THE WIRE.
 *
 * A guest view applies as the viewer with `via: "view:<name>"`, so the
 * activity rail can say where an act came from. On a remote store that
 * claim stopped at the browser: `openRemote`'s `applyAll` and `undo` sent
 * no `via`, so the server could not even be asked to believe it. Now a
 * `call` and an `undo` carry the claim — on the socket and in the body of
 * `POST /graview/ops` — and what the server makes of it is the server's:
 * by default it records its own channel, as FR-52 says, and a host that
 * accepts a claim says so itself.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1) }), plural: "Tasks", label: (node) => node.label });
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
const app = defineApp({ name: "viewed", schema: createSchema([task]), mutations: [rename], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Book the hall" }], edges: [] };
const sam: Principal = { kind: "human", id: "sam", name: "Sam", roles: ["keeper"] };

function wired(handler: StoreHandler<typeof app.schema>) {
  const said: LiveClientMessage[] = [];
  const posted: Record<string, unknown>[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    if (url.endsWith("/graview/ops") && typeof init?.body === "string") posted.push(JSON.parse(init.body) as Record<string, unknown>);
    return handler.handle(new Request(url, init));
  }) as typeof globalThis.fetch;
  const socket = (url: string): LiveSocketLike => {
    let deliver: (text: string) => void = () => {};
    const fake = {
      readyState: 0,
      onopen: null as null | ((event: unknown) => void),
      onmessage: null as null | ((event: { data: unknown }) => void),
      onclose: null as null | ((event: { code: number; reason: string }) => void),
      onerror: null as null | ((event: unknown) => void),
      send(text: string) {
        said.push(JSON.parse(text) as LiveClientMessage);
        deliver(text);
      },
      close() {
        fake.readyState = 3;
      },
    };
    void handler
      .connect(new Request(url.replace(/^ws/, "http"), { headers: seatHeaders(sam) }), { send: (text) => setTimeout(() => fake.readyState === 1 && fake.onmessage?.({ data: text }), 0) })
      .then((connection) => {
        if (connection instanceof Response) throw new Error("refused");
        deliver = (text) => connection.receive(text);
        fake.readyState = 1;
        fake.onopen?.({});
      });
    return fake;
  };
  return { fetch, socket, said, posted };
}

const opened: RemoteStore<typeof app.schema>[] = [];
afterEach(() => {
  for (const remote of opened.splice(0)) remote.close();
});

describe("a view claims its channel on the wire", () => {
  for (const live of [true, false]) {
    it(`sends a call's and an undo's via claim, and the server records its own channel by default (${live ? "socket" : "HTTP"})`, async () => {
      const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
      const wire = wired(handler);
      const remote = await openRemote({ app, url: "http://room.example", principal: sam, live, pollMs: 0, fetch: wire.fetch, socket: wire.socket });
      opened.push(remote);
      expect(remote.transport()).toBe(live ? "socket" : "poll");

      const made = remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the big hall" } }, { via: "view:board" });
      await remote.settled();
      remote.store.undo(made.batch, { via: "view:board" });
      await remote.settled();
      // An act with no claim says none.
      remote.store.apply({ name: "rename", args: { id: "t1", label: "Book the town hall" } });
      await remote.settled();

      const sent = live
        ? wire.said.filter((message) => message.t === "call" || message.t === "undo").map((message) => ({ t: message.t, via: (message as { via?: string }).via }))
        : wire.posted.map((body) => ({ t: body["undo"] ? "undo" : "call", via: body["via"] as string | undefined }));
      expect(sent).toEqual([
        { t: "call", via: "view:board" },
        { t: "undo", via: "view:board" },
        { t: "call", via: undefined },
      ]);
      // FR-52 stands: a claim the host was not asked to believe is not recorded.
      expect(handler.store.log.all().map((op) => op.via)).toEqual(["web", "web", "web"]);
      await handler.close();
    });
  }
});
