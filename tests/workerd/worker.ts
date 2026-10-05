/**
 * A WORKER THAT IS NOTHING BUT THE FRAMEWORK (FR-09).
 *
 * Bundled from the packages' published entries — `@graview/core`,
 * `@graview/tools` and `@graview/ship/runtime`, resolved through their
 * `exports` to dist — and run in workerd with no Node compatibility flag, so
 * a `node:` import anywhere in what they reach fails the bundle or the
 * isolate rather than passing quietly. It answers three things:
 *
 *   /cases                    the adapter contract's case names
 *   /contract/<suite>/<i>     one contract case, against a fresh Durable Object's SQLite
 *   /tools                    a call applied through the tool runtime, in the isolate
 *   /thumbnail                a picture of an app (FR-74), drawn with no DOM
 *   /graview/*                the WIRE, from a Durable Object whose store is its own storage
 */
import { DurableObject } from "cloudflare:workers";
import {
  capabilities,
  createMemoryAdapter,
  createSchema,
  createSqlAdapter,
  defineApp,
  defineMutation,
  defineNode,
  nodeRef,
  z,
} from "@graview/core";
import { sceneThumbnail } from "@graview/core/document";
import { createToolRuntime } from "@graview/tools";
import { createStoreHandler, liveProtocol, openStore, type LiveSocketState, type StoreHandler } from "@graview/ship/runtime";
import { adapterCases, householdTables, sqlCases, type SqlHandle } from "../../packages/core/tests/support/adapter-contract.js";

interface Storage {
  readonly sql: SqlHandle["sql"];
  transactionSync<T>(fn: () => T): T;
}
interface State {
  readonly storage: Storage;
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}
interface Namespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}
interface Env {
  readonly CONTRACT: Namespace;
  readonly SERVED: Namespace;
}

const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }) });
const finish = defineMutation("finish", {
  title: "Finish it",
  description: "Marks a task done.",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const schema = createSchema([task]);
const app = defineApp({
  name: "worked",
  schema,
  mutations: [finish],
  policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: ["finish"], describe: "The keeper finishes things." }] },
  version: 1,
});
const seed = { nodes: [{ id: "t1", kind: "task", label: "Book the hall", done: false }], edges: [] };
const keeper = { kind: "agent" as const, id: "claude", roles: ["keeper"] };

const handleOf = (storage: Storage): SqlHandle => ({ sql: storage.sql, transaction: (fn) => storage.transactionSync(fn) });

function suites(handle: () => SqlHandle) {
  return {
    adapter: adapterCases(() => {
      const opened = handle();
      householdTables(opened.sql);
      return createSqlAdapter(opened);
    }),
    sql: sqlCases(handle),
  };
}

/** One contract case per object, so every case starts from an empty database. */
export class Contract extends DurableObject {
  override async fetch(request: Request): Promise<Response> {
    const [, , suite, index] = new URL(request.url).pathname.split("/");
    const storage = (this.ctx as unknown as State).storage;
    const cases = suites(() => handleOf(storage))[suite as "adapter" | "sql"];
    const contract = cases?.[Number(index)];
    if (!contract) return Response.json({ ok: false, error: `no case ${suite}/${index}` }, { status: 404 });
    try {
      await contract.run();
      return Response.json({ ok: true, name: contract.name });
    } catch (error) {
      return Response.json({ ok: false, name: contract.name, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

/** The store behind the wire, kept in this object's own SQLite. */
export class Served extends DurableObject {
  private handler: StoreHandler<typeof schema> | undefined;

  constructor(ctx: unknown, env: unknown) {
    super(ctx as never, env as never);
    const state = ctx as State;
    void state.blockConcurrencyWhile(async () => {
      this.handler = await createStoreHandler({
        app,
        adapter: createSqlAdapter({ ...handleOf(state.storage), createTables: true }),
        seed: seed as never,
        trustSeatHeaders: true,
        where: "a Durable Object",
      });
    });
  }

  override async fetch(request: Request): Promise<Response> {
    return this.handler!.handle(request);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/cases") {
      const names = suites(() => ({ sql: { exec: () => [] } }));
      return Response.json({ adapter: names.adapter.map((c) => c.name), sql: names.sql.map((c) => c.name) });
    }
    if (pathname.startsWith("/contract/")) return env.CONTRACT.get(env.CONTRACT.idFromName(pathname)).fetch(request);
    if (pathname === "/tools") {
      const opened = await openStore({ app, adapter: createMemoryAdapter(), scope: "tools", seed: seed as never });
      const runtime = createToolRuntime(opened.store, { author: keeper });
      const result = await runtime.call("finish", { id: "t1" });
      return Response.json({
        ok: result.ok,
        done: (opened.store.graph.getNode("t1") as { done: boolean }).done,
        author: opened.store.log.all().at(-1)?.author,
        tools: runtime.definitions.map((tool) => tool.name),
        shipped: capabilities().shipped,
      });
    }
    if (pathname === "/thumbnail") {
      /* A picture of an app with no DOM in the isolate (FR-74): from a document, and from the declared app. */
      const document = {
        format: "graview-document",
        formatVersion: 1,
        name: "Errands",
        kinds: {
          errand: { plural: "Errands", fields: { label: { type: "string", required: true } }, edges: { at: { to: ["shop"] } } },
          shop: { fields: { name: { type: "string", required: true } } },
        },
      };
      return Response.json({
        dom: typeof (globalThis as { document?: unknown }).document,
        fromDocument: sceneThumbnail(document, { scheme: "dark", counts: { errand: 3 } }),
        fromApp: sceneThumbnail(app),
      });
    }
    if (pathname === "/live") {
      /*
       * The live protocol a hibernating Durable Object runs (FR-41): each
       * message is answered by a protocol made afresh from the store, and
       * the socket's state between them is only a JSON string.
       */
      const opened = await openStore({ app, adapter: createMemoryAdapter(), scope: "live", seed: seed as never });
      const heard: unknown[] = [];
      let kept = JSON.stringify(liveProtocol({ store: opened.store }).open(keeper, "mcp:Claude"));
      for (const text of [JSON.stringify({ t: "hello", seq: -1 }), JSON.stringify({ t: "call", cid: "c1", via: "web", calls: [{ name: "finish", args: { id: "t1" } }] })]) {
        const peer = { ...(JSON.parse(kept) as LiveSocketState), send: (message: string) => heard.push(JSON.parse(message)) };
        await liveProtocol({ store: opened.store, flush: opened.flush }).receive(peer, text);
        const { send: _send, ...state } = peer;
        kept = JSON.stringify(state);
      }
      return Response.json({ heard, state: JSON.parse(kept), via: opened.store.log.all().at(-1)?.via });
    }
    if (pathname.startsWith("/graview/")) return env.SERVED.get(env.SERVED.idFromName("one")).fetch(request);
    return new Response("Nothing here", { status: 404 });
  },
};
