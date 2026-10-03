import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryAdapter, createSchema, defineApp, defineMutation, defineNode, nodeRef, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, SEAT_HEADERS, seatFromHeaders, WIRE } from "../../src/runtime.js";

/**
 * THE WIRE WITHOUT A SERVER (FR-09).
 *
 * `serveStore` was a `node:http` server, so the only runtime a store could
 * be served from was Node. The routes are now one function from a `Request`
 * to a `Response` — what a Worker, a Durable Object, Deno and Bun all call
 * a handler — and `node:http` is a thin wrapper around it. These tests reach
 * the handler with no port open and no socket, which is the whole claim.
 */

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
  name: "handled",
  schema,
  mutations: [finish],
  policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: ["finish"], describe: "The keeper finishes things." }] },
  version: 1,
});
const seed = { nodes: [{ id: "t1", kind: "task", label: "Book the hall", done: false }], edges: [] };
const keeper = { "content-type": "application/json", [SEAT_HEADERS.seat]: "u1", [SEAT_HEADERS.roles]: "keeper" };

const at = (path: string, init: RequestInit = {}) => new Request(`https://store.example${path}`, init);

describe("the WIRE routes answer through a fetch handler", () => {
  it("answers every WIRE route from a Request, with no server listening", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    for (const route of WIRE) {
      const response = await handler.handle(
        at(`${route.path}${route.path.endsWith("since") ? "?seq=-1" : ""}`, {
          method: route.method,
          headers: keeper,
          ...(route.method === "POST"
            ? { body: JSON.stringify(route.path.endsWith("here") ? { presence: { participant: "human:u1:s", stop: "/" } } : {}) }
            : {}),
        }),
      );
      expect(response.status, `${route.method} ${route.path} — ${route.says}`).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
    }
    expect((await handler.handle(at("/graview/nothing", { headers: keeper }))).status).toBe(404);
    await handler.close();
  });

  it("applies a call under the seat the request carries, and the op comes back", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const response = await handler.handle(
      at("/graview/ops", { method: "POST", headers: keeper, body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }], via: "web" }) }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ops: { author: Principal; via: string }[] };
    expect(body.ops[0]).toMatchObject({ author: { id: "u1", roles: ["keeper"] }, via: "web" });
    expect((handler.store.graph.getNode("t1") as { done: boolean }).done).toBe(true);

    const state = (await (await handler.handle(at("/graview/state", { headers: keeper }))).json()) as { log: unknown[] };
    expect(state.log).toHaveLength(1);
  });

  it("refuses with the policy's sentence as a 409, exactly as the server did", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const response = await handler.handle(
      at("/graview/ops", {
        method: "POST",
        headers: { "content-type": "application/json", [SEAT_HEADERS.seat]: "nobody" },
        body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }] }),
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ refused: true });
  });

  it("hands the host's seatOf the Request itself, and awaits it when it is asynchronous", async () => {
    const seen: string[] = [];
    const handler = await createStoreHandler({
      app,
      adapter: createMemoryAdapter(),
      seed: seed as never,
      // A Worker verifies a token with crypto.subtle, which only answers a promise.
      seatOf: async (request: Request) => {
        seen.push(request.headers.get("authorization") ?? "");
        return request.headers.get("authorization") === "Bearer keeper-key" ? { kind: "human", id: "k", roles: ["keeper"] } : { kind: "human" };
      },
    });
    const response = await handler.handle(
      at("/graview/ops", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer keeper-key" },
        body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }] }),
      }),
    );
    expect(response.status).toBe(200);
    expect(seen).toEqual(["Bearer keeper-key"]);
    expect(handler.store.log.all()[0]!.author).toMatchObject({ id: "k" });
  });

  it("answers 401 on every route but health when it can tell nobody, and believes no header", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never });
    for (const route of WIRE.filter((route) => route.path !== "/graview/health")) {
      const response = await handler.handle(at(route.path, { method: route.method, headers: keeper, ...(route.method === "POST" ? { body: "{}" } : {}) }));
      expect(response.status, route.path).toBe(401);
    }
    expect((await handler.handle(at("/graview/health"))).status).toBe(200);
    expect((handler.store.graph.getNode("t1") as { done: boolean }).done).toBe(false);
  });

  it("allows another origin, and answers a preflight with the seat headers allowed", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const preflight = await handler.handle(at("/graview/ops", { method: "OPTIONS" }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
    expect(preflight.headers.get("access-control-allow-headers")).toContain("authorization");
    expect(preflight.headers.get("access-control-allow-headers")).toContain(SEAT_HEADERS.seat);
    const state = await handler.handle(at("/graview/state", { headers: keeper }));
    expect(state.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("reads a seat from a Request's headers, an agent acting for a person included", () => {
    const seat = seatFromHeaders(
      at("/", {
        headers: {
          [SEAT_HEADERS.seat]: "claude",
          [SEAT_HEADERS.kind]: "agent",
          [SEAT_HEADERS.name]: encodeURIComponent("Claude Ö"),
          [SEAT_HEADERS.roles]: "keeper,reader",
          [SEAT_HEADERS.for]: "u1",
          [SEAT_HEADERS.forName]: "Kai",
        },
      }),
    );
    expect(seat).toEqual({ kind: "agent", id: "claude", name: "Claude Ö", roles: ["keeper", "reader"], onBehalfOf: { kind: "human", id: "u1", name: "Kai" } });
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "../../dist");

/** Everything an entry reaches, following relative imports through dist. */
function reached(entry: string): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (file: string) => {
    if (found.has(file)) return;
    const source = readFileSync(file, "utf8");
    found.set(file, source);
    for (const match of source.matchAll(/from\s+"(\.[^"]+)"/g)) walk(resolve(dirname(file), match[1]!));
  };
  walk(resolve(dist, entry));
  return found;
}

describe("the runtime entry, which any JavaScript runtime may import", () => {
  it("reaches no node: builtin and no shebang, anywhere in its graph", () => {
    const offenders: string[] = [];
    for (const [file, source] of reached("runtime.js")) {
      const builtins = [...source.matchAll(/from\s+"(node:[^"]+)"/g)].map((m) => m[1]!);
      if (builtins.length > 0) offenders.push(`${file.slice(dist.length + 1)} → ${builtins.join(", ")}`);
      if (source.startsWith("#!")) offenders.push(`${file.slice(dist.length + 1)} → a shebang`);
    }
    expect(offenders).toEqual([]);
  });

  it("carries the handler and the store, not the page's localStorage adapter", () => {
    const files = [...reached("runtime.js").keys()].map((file) => file.slice(dist.length + 1));
    expect(files).toContain("handler.js");
    expect(files).toContain("open-store.js");
    expect(files).not.toContain("browser-adapter.js");
  });

  it("is the module serveStore wraps: the node:http server holds no route of its own", () => {
    const serve = readFileSync(resolve(dist, "serve.js"), "utf8");
    expect(serve).toContain("./handler.js");
    expect(serve).not.toContain("/graview/ops");
  });
});
