import { describe, expect, it, vi } from "vitest";
import { decisionBridge, decisionBridgeHandler, decisionKey } from "../../src/dev.js";

/**
 * THE DOOR TO A DECISION PROVIDER, with the key on the server side of it.
 *
 * The page posts a state and questions; the dev server adds the key from
 * its own environment and forwards. The key is in no response, and a page
 * on another site gets nothing.
 */
const respond = () => {
  const sent: { status?: number; body?: string } = {};
  const res = {
    setHeader: () => {},
    end: (body: string) => (sent.body = body),
    set statusCode(value: number) {
      sent.status = value;
    },
  } as never;
  return { sent, res };
};
const request = (method: string, body?: string) =>
  ({
    method,
    headers: { host: "localhost:5173" },
    on: (event: string, handler: (chunk?: Buffer) => void) => {
      if (event === "data" && body) handler(Buffer.from(body));
      if (event === "end") handler();
    },
  }) as never;

describe("the decision door", () => {
  it("is shut when the environment holds no key, and says which name it looked for", async () => {
    const handler = decisionBridgeHandler({ env: {} });
    const { sent, res } = respond();
    await handler(request("GET"), res);
    expect(JSON.parse(sent.body!)).toEqual({ available: false, reason: expect.stringContaining("TYPESAFE_API_KEY") });
    const posted = respond();
    await handler(request("POST", '{"state":{},"questions":{}}'), posted.res);
    expect(posted.sent.status).toBe(503);
  });

  it("forwards a state and questions with the key in the header, and passes the answer back untouched", async () => {
    const upstream = vi.fn(async (_url: string, init: { headers: Record<string, string>; body: string }) => ({
      status: 200,
      text: async () => JSON.stringify({ answers: { q: { type: "noul", noul: 0.9 } }, usage: { input_tokens: 10 }, echo: init.headers["authorization"] === "Bearer ts-key" }),
    }));
    const handler = decisionBridgeHandler({ env: { TYPESAFE_API_KEY: "ts-key" }, fetch: upstream, endpoint: "https://example.test/decide" });
    const { sent, res } = respond();
    await handler(request("POST", JSON.stringify({ state: { a: 1 }, questions: { q: { type: "noul", instructions: "?" } } })), res);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream.mock.calls[0]![0]).toBe("https://example.test/decide");
    expect(JSON.parse(upstream.mock.calls[0]![1].body)).toEqual({ model: "jev-latest", state: { a: 1 }, questions: { q: { type: "noul", instructions: "?" } } });
    expect(sent.status).toBe(200);
    expect(JSON.parse(sent.body!)).toMatchObject({ answers: { q: { noul: 0.9 } }, echo: true });
    expect(sent.body).not.toContain("ts-key");
  });

  it("hands the provider's own status through, so the page tells failures apart the same way", async () => {
    const handler = decisionBridgeHandler({
      env: { JEV_API_KEY: "older-name" },
      fetch: async () => ({ status: 422, text: async () => '{"error":"criteria must have two levels"}' }),
    });
    const { sent, res } = respond();
    await handler(request("POST", '{"state":null,"questions":{"q":{}}}'), res);
    expect(sent.status).toBe(422);
    expect(sent.body).toContain("two levels");
    expect(decisionKey({ JEV_API_KEY: "older-name" })).toBe("older-name");
  });

  it("refuses a cross-origin caller and a request that is not one", async () => {
    const handler = decisionBridgeHandler({ env: { TYPESAFE_API_KEY: "k" } });
    const { sent, res } = respond();
    await handler({ method: "POST", headers: { origin: "https://elsewhere.example", host: "localhost:5173" }, on: () => {} } as never, res);
    expect(sent.status).toBe(403);
    const malformed = respond();
    await handler(request("POST", '{"state":1}'), malformed.res);
    expect(malformed.sent.status).toBe(400);
  });

  it("is a dev-server plugin on the declared path", () => {
    const use = vi.fn();
    decisionBridge().configureServer({ middlewares: { use } } as never);
    expect(use).toHaveBeenCalledWith("/__graview/decide", expect.any(Function));
    decisionBridge({ path: "/__grounds/jev" }).configureServer({ middlewares: { use } } as never);
    expect(use).toHaveBeenCalledWith("/__grounds/jev", expect.any(Function));
  });
});
