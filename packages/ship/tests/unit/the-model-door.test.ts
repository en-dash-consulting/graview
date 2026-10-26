import { describe, expect, it, vi } from "vitest";
import { AI_HOW_TO, aiDevProxy, aiDevProxyHandler, doorCookie } from "../../src/dev.js";

// The door's key for this file, so no test reaches for the one kept in a home folder; a page let in holds it as a cookie.
process.env["GRAVIEW_DOOR_KEY"] ??= "the-door-tests-key-0123456789abcdef";

/**
 * A MODEL FOR THE SEAT IN DEVELOPMENT, with the key on the server side.
 *
 * The page posts a prompt to `/__graview/ai`; the dev server adds
 * `ANTHROPIC_API_KEY` from its own environment, asks the Messages API and
 * answers with the text alone. No real network here: every upstream call
 * is a stub.
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
const request = (method: string, body?: string, origin?: string, host = "localhost:5193") =>
  ({
    method,
    headers: { host, cookie: doorCookie(), ...(origin ? { origin } : {}) },
    on: (event: string, handler: (chunk?: Buffer) => void) => {
      if (event === "data" && body) handler(Buffer.from(body));
      if (event === "end") handler();
    },
  }) as never;

const KEY = "sk-ant-test-key";
const answered = (text: string, status = 200) =>
  vi.fn(async (_url: string, _init: { method: string; headers: Record<string, string>; body: string }) => ({
    status,
    text: async () => JSON.stringify({ content: [{ type: "thinking", thinking: "" }, { type: "text", text }], stop_reason: "end_turn" }),
  }));

describe("the model door", () => {
  it("without a key, says it is not configured and how to turn it on — and refuses a prompt", async () => {
    const handler = aiDevProxyHandler({ env: {} });
    const { sent, res } = respond();
    await handler(request("GET"), res);
    expect(JSON.parse(sent.body!)).toEqual({ configured: false, howTo: AI_HOW_TO });
    expect(AI_HOW_TO).toContain("ANTHROPIC_API_KEY");
    const posted = respond();
    await handler(request("POST", '{"prompt":"hello"}'), posted.res);
    expect(posted.sent.status).toBe(503);
  });

  it("with a key, says which model, never the key", async () => {
    const { sent, res } = respond();
    await aiDevProxyHandler({ env: { ANTHROPIC_API_KEY: KEY } })(request("GET"), res);
    expect(JSON.parse(sent.body!)).toEqual({ configured: true, model: "claude-sonnet-5-5", name: "claude" });
    expect(sent.body).not.toContain(KEY);
    const other = respond();
    await aiDevProxyHandler({ env: { ANTHROPIC_API_KEY: KEY, GRAVIEW_AI_MODEL: "claude-opus-5-5" } })(request("GET"), other.res);
    expect(JSON.parse(other.sent.body!)).toMatchObject({ model: "claude-opus-5-5" });
  });

  it("forwards a prompt to the Messages API with the key in its header, and answers with the text alone", async () => {
    const upstream = answered("Ada is on Thursday.");
    const handler = aiDevProxyHandler({ env: { ANTHROPIC_API_KEY: KEY }, fetch: upstream, endpoint: "https://messages.test/v1/messages" });
    const { sent, res } = respond();
    await handler(request("POST", JSON.stringify({ prompt: "who is on thursday?" })), res);
    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, init] = upstream.mock.calls[0]!;
    expect(url).toBe("https://messages.test/v1/messages");
    expect(init.headers).toMatchObject({ "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" });
    expect(JSON.parse(init.body)).toMatchObject({ model: "claude-sonnet-5-5", messages: [{ role: "user", content: "who is on thursday?" }] });
    expect(sent.status).toBe(200);
    expect(JSON.parse(sent.body!)).toEqual({ text: "Ada is on Thursday." });
    expect(sent.body).not.toContain(KEY);
  });

  it("forwards a completion's framing and pictures to the Messages request, and answers what the call used", async () => {
    const upstream = vi.fn(async (_url: string, _init: { method: string; headers: Record<string, string>; body: string }) => ({
      status: 200,
      text: async () => JSON.stringify({ content: [{ type: "text", text: "A receipt for 12 dollars." }], stop_reason: "end_turn", usage: { input_tokens: 812, output_tokens: 9 } }),
    }));
    const handler = aiDevProxyHandler({ env: { ANTHROPIC_API_KEY: KEY }, fetch: upstream });
    const { sent, res } = respond();
    const images = [{ mediaType: "image/png", data: "iVBORw0KGgo=" }, { mediaType: "text/html", data: "PGI+" }];
    await handler(request("POST", JSON.stringify({ prompt: "what is this?", system: "Read receipts.", images })), res);
    expect(JSON.parse(upstream.mock.calls[0]![1].body)).toMatchObject({
      system: "Read receipts.",
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } }, { type: "text", text: "what is this?" }] }],
    });
    expect(JSON.parse(upstream.mock.calls[0]![1].body).messages[0].content).toHaveLength(2);
    expect(JSON.parse(sent.body!)).toEqual({ text: "A receipt for 12 dollars.", usage: { inputTokens: 812, outputTokens: 9 } });
  });

  it("forwards one step of a seat's turn — its framing, messages and read tools — and answers with the content and why it stopped, so the page runs the reads (FR-160)", async () => {
    const blocks = [{ type: "tool_use", id: "t1", name: "get_node", input: { id: "Bloom & Co" } }];
    const upstream = vi.fn(async (_url: string, _init: { method: string; headers: Record<string, string>; body: string }) => ({ status: 200, text: async () => JSON.stringify({ content: blocks, stop_reason: "tool_use" }) }));
    const handler = aiDevProxyHandler({ env: { ANTHROPIC_API_KEY: KEY }, fetch: upstream });
    const tools = [{ name: "get_node", description: "Read one node.", input_schema: { type: "object" } }];
    const step = { system: "You are the seat.", messages: [{ role: "user", content: "what did we pay the florist?" }], tools, tool_choice: { type: "none" } };
    const { sent, res } = respond();
    await handler(request("POST", JSON.stringify(step)), res);
    expect(JSON.parse(upstream.mock.calls[0]![1].body)).toMatchObject({ model: "claude-sonnet-5-5", ...step });
    expect(sent.status).toBe(200);
    expect(JSON.parse(sent.body!)).toEqual({ content: blocks, stop_reason: "tool_use" });
    expect(sent.body).not.toContain(KEY);
  });

  it("passes a refused key back as a refusal in words, without the key", async () => {
    const upstream = vi.fn(async () => ({ status: 401, text: async () => JSON.stringify({ error: { message: `invalid x-api-key ${KEY}` } }) }));
    const { sent, res } = respond();
    await aiDevProxyHandler({ env: { ANTHROPIC_API_KEY: KEY }, fetch: upstream })(request("POST", '{"prompt":"hi"}'), res);
    expect(sent.status).toBe(401);
    expect(sent.body).toContain("ANTHROPIC_API_KEY");
    expect(sent.body).not.toContain(KEY);
  });

  it("never scrubs a thrown error into a leak", async () => {
    const upstream = vi.fn(async () => {
      throw new Error(`connect failed for ${KEY}`);
    });
    const { sent, res } = respond();
    await aiDevProxyHandler({ env: { ANTHROPIC_API_KEY: KEY }, fetch: upstream })(request("POST", '{"prompt":"hi"}'), res);
    expect(sent.status).toBe(500);
    expect(sent.body).not.toContain(KEY);
  });

  it("answers this app only: another site's page gets nothing and spends nothing", async () => {
    const upstream = answered("no");
    const { sent, res } = respond();
    await aiDevProxyHandler({ env: { ANTHROPIC_API_KEY: KEY }, fetch: upstream })(request("POST", '{"prompt":"hi"}', "https://elsewhere.test"), res);
    expect(sent.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("answers no page that names another host, as a page rebinding its own name to this machine does", async () => {
    const upstream = answered("no");
    const { sent, res } = respond();
    await aiDevProxyHandler({ env: { ANTHROPIC_API_KEY: KEY }, fetch: upstream })(request("POST", '{"prompt":"hi"}', "http://evil.test:5193", "evil.test:5193"), res);
    expect(sent.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("is a dev-server plugin only, so a build never carries it", () => {
    const plugin = aiDevProxy({ env: {} });
    expect(plugin.apply).toBe("serve");
    const used: unknown[] = [];
    plugin.configureServer({ middlewares: { use: (path: unknown) => void used.push(path) } } as never);
    // The address that trades the door's key for its cookie, and then the door.
    expect(used).toEqual([expect.any(Function), "/__graview/ai"]);
  });
});
