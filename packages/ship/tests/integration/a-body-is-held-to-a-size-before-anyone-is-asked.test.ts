import { request as send } from "node:http";
import { createMemoryAdapter, createSchema, defineApp, defineNode } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { serveStore, type ServedStore } from "../../src/index.js";

/**
 * A BODY IS HELD TO A SIZE BEFORE ANYONE IS ASKED. `serveStore` reads a
 * request's body into memory before it routes it or asks the host's
 * `seatOf` who is asking, so the body is the cost of reaching the port. It
 * read any size: a stranger could make the process every seat is served by
 * hold as much as it liked. Now a body that says it is over the limit is
 * answered 413 before a byte is read, one that streams past it (chunked
 * says no length) is answered 413 the moment it does, and neither reaches
 * `answer`, a route or `seatOf`.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const app = defineApp({ name: "sized", schema: createSchema([task]), mutations: [], version: 1 });

let served: ServedStore<never> | undefined;
afterEach(async () => {
  await served?.close({ grace: 0 });
  served = undefined;
});

async function serving(maxBodyBytes?: number) {
  const reached = { answer: 0, seatOf: 0 };
  served = (await serveStore({
    app: app as never,
    adapter: createMemoryAdapter(),
    seed: { nodes: [], edges: [] } as never,
    host: "127.0.0.1",
    port: 0,
    ...(maxBodyBytes !== undefined ? { maxBodyBytes } : {}),
    seatOf: () => {
      reached.seatOf++;
      throw new Error("not signed in");
    },
    answer: () => {
      reached.answer++;
      return undefined;
    },
  })) as never;
  return reached;
}

/** A POST, with a length or chunked; the status, or what ended the connection. */
function post(path: string, body: Buffer, chunked: boolean): Promise<number | string> {
  return new Promise((done) => {
    const asked = send(
      { host: "127.0.0.1", port: served!.port, path, method: "POST", headers: chunked ? { "transfer-encoding": "chunked" } : { "content-length": body.length } },
      (answer) => {
        answer.resume();
        done(answer.statusCode ?? 0);
      },
    );
    asked.on("error", (error: NodeJS.ErrnoException) => done(error.code ?? error.message));
    if (chunked) {
      for (let at = 0; at < body.length; at += 16 * 1024) asked.write(body.subarray(at, at + 16 * 1024));
      asked.end();
    } else asked.end(body);
  });
}

/** A POST that says it is `length` bytes and sends one: the status. */
function declaring(length: number): Promise<number | string> {
  return new Promise((done) => {
    const asked = send({ host: "127.0.0.1", port: served!.port, path: "/graview/nowhere", method: "POST", headers: { "content-length": length } }, (answer) => {
      answer.resume();
      done(answer.statusCode ?? 0);
    });
    asked.on("error", (error: NodeJS.ErrnoException) => done(error.code ?? error.message));
    asked.write("x");
  });
}

describe("a body is held to a size before anyone is asked", () => {
  it("answers 413 to a body one byte over, with a length and chunked, without asking answer or seatOf", async () => {
    const reached = await serving(64 * 1024);
    const over = Buffer.alloc(64 * 1024 + 1, 0x20);
    expect(await post("/graview/ops", over, false)).toBe(413);
    const chunked = await post("/graview/friction", over, true);
    // Answered 413, or cut once the answer is sent while the rest was still coming.
    expect([413, "ECONNRESET", "EPIPE"]).toContain(chunked);
    expect(reached).toEqual({ answer: 0, seatOf: 0 });
  });

  it("refuses a declared length over the limit before reading any of it", async () => {
    const reached = await serving(1024);
    expect(await declaring(10_000_000_000)).toBe(413);
    expect(reached).toEqual({ answer: 0, seatOf: 0 });
  });

  it("still reads a body at the limit, and holds 16 MiB unless told", async () => {
    const reached = await serving(64 * 1024);
    expect(await post("/graview/ops", Buffer.alloc(64 * 1024, 0x20), true)).toBe(500);
    expect(reached.answer).toBe(1);
    await served!.close({ grace: 0 });
    const defaults = await serving();
    expect(await declaring(16 * 1024 * 1024 + 1)).toBe(413);
    expect(defaults.answer).toBe(0);
  });
});
