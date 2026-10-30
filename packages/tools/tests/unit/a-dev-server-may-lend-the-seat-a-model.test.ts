import { type AnySchema, type Store } from "@graview/core";
import { placesOf } from "@graview/core/seat";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { aiThroughDevServer, NO_AI_SAID, seatResponder } from "../../src/index.js";
import { createTodoStore, todoApp } from "../../../../apps/todo/src/domain/app.js";

/**
 * A DEV SERVER MAY LEND THE SEAT A MODEL (`aiDevProxy` in `@graview/ship/dev`),
 * and the page never holds the key. The page asks the door once: a model
 * there is the seat's `complete`; a door with no key says how to turn one
 * on — which only a dev server can say; no door at all is no AI, said the
 * way any product says it.
 */
const example = JSON.parse(readFileSync(new URL("../../../../apps/todo/src/data/example.json", import.meta.url), "utf8"));
const store = () => createTodoStore({ snapshot: example }) as unknown as Store<AnySchema>;
const places = placesOf(todoApp);
const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe("the seat's model, through the dev server", () => {
  it("a door holding a key lends a model, and each step of the seat's turn goes through the door", async () => {
    const door = vi.fn(async (_path: string, init?: { method?: string; body?: string }) =>
      init?.method === "POST"
        ? json(200, { content: [{ type: "text", text: '{"say": "Start with the deposit.", "proposals": []}' }], stop_reason: "end_turn" })
        : json(200, { configured: true, model: "claude-sonnet-5-5", name: "claude" }),
    );
    const ai = await aiThroughDevServer({ fetch: door });
    expect(ai.name).toBe("claude");
    expect(ai.complete).toBeDefined();
    expect(ai.turn).toBeDefined();
    const reply = await seatResponder<AnySchema>(ai)(store(), "what should I do first?", { places });
    expect(reply.say).toContain("Start with the deposit");
    expect(reply.via).toBe("ai:claude");
    expect(door.mock.calls.filter(([path]) => path === "/__graview/ai").map(([path, init]) => [path, init?.method])).toEqual([["/__graview/ai", "GET"], ["/__graview/ai", "POST"]]);
  });

  it("a door that names a quick model lends the page a Fast slot, each typed question asked of it as tier fast (Roadmap f-menu-type-anything)", async () => {
    const door = vi.fn(async (_path: string, init?: { method?: string; body?: string }) =>
      init?.method === "POST" ? json(200, { text: '{"row": {"choice": "r2", "confidence": 0.7}}', usage: { inputTokens: 30, outputTokens: 9 } }) : json(200, { configured: true, model: "claude-sonnet-5-5", fast: "claude-haiku-5-5", name: "claude" }),
    );
    const ai = await aiThroughDevServer({ fetch: door });
    expect(ai.fast?.model).toBe("claude-haiku-5-5");
    const decided = await ai.fast!.decide({ typed: "fin" }, { row: { type: "choice", instructions: "Which row?", criteria: { r1: "Rename it", r2: "Finish it" } } });
    expect(decided.answers["row"]).toMatchObject({ type: "choice", choice: "r2", confidence: 0.7 });
    expect(JSON.parse(door.mock.calls.find(([path, init]) => path === "/__graview/ai" && init?.method === "POST")![1]!.body!)).toMatchObject({ tier: "fast" });
    // A door that names none lends none.
    const plain = await aiThroughDevServer({ fetch: async () => json(200, { configured: true, model: "m", name: "claude" }) });
    expect(plain.fast).toBeUndefined();
  });

  it("a decision door holding a key for Jev makes Jev the Fast slot, in place of the quick model, its questions posted through the door", async () => {
    const door = vi.fn(async (path: string, init?: { method?: string; body?: string }) => {
      if (path === "/__graview/decide") return init?.method === "POST" ? { ok: true, status: 200, json: async () => ({}), text: async () => JSON.stringify({ answers: { row: { type: "choice", choice: "r1", confidence: 0.8, probabilities: { r1: 0.8 } } }, usage: { input_tokens: 40, output_tokens: 0 } }) } : json(200, { available: true, model: "jev-latest" });
      return json(200, { configured: true, model: "claude-sonnet-5-5", fast: "claude-haiku-5-5", name: "claude" });
    });
    const ai = await aiThroughDevServer({ fetch: door as never });
    expect(ai.fast?.model).toBe("jev-latest");
    const decided = await ai.fast!.decide({ typed: "fin" }, { row: { type: "choice", instructions: "Which row?", criteria: { r1: "Finish it", none: "None of these rows" } } });
    expect(decided.answers["row"]).toMatchObject({ type: "choice", choice: "r1" });
    const posted = door.mock.calls.find(([path, init]) => path === "/__graview/decide" && init?.method === "POST");
    expect(JSON.parse(posted![1]!.body!)).toMatchObject({ model: "jev-latest", questions: { row: { type: "choice" } } });
    // No key for Jev: the decision door is closed, and the quick model stands in.
    const closed = await aiThroughDevServer({ fetch: (async (path: string) => (path === "/__graview/decide" ? json(200, { available: false }) : json(200, { configured: true, model: "m", fast: "claude-haiku-5-5", name: "claude" }))) as never });
    expect(closed.fast?.model).toBe("claude-haiku-5-5");
  });

  it("a door whose provider takes no turn's tools (xAI, OpenAI) lends a model that answers by completion, with no turn", async () => {
    const ai = await aiThroughDevServer({ fetch: async (path) => (path === "/__graview/ai" ? json(200, { configured: true, provider: "xai", model: "grok-4.7", fast: "grok-4.20-0309-non-reasoning", name: "grok", turns: false }) : json(404, {})) });
    expect(ai.name).toBe("grok");
    expect(ai.complete).toBeDefined();
    expect(ai.turn).toBeUndefined();
    expect(ai.fast?.model).toBe("grok-4.20-0309-non-reasoning");
  });

  it("a door without a key says how to turn it on, in place of the plain sentence", async () => {
    const ai = await aiThroughDevServer({ fetch: async () => json(200, { configured: false, howTo: "Set ANTHROPIC_API_KEY when you start the dev server to turn it on." }) });
    expect(ai.complete).toBeUndefined();
    const reply = await seatResponder<AnySchema>(ai)(store(), "what should I do first?", { places });
    expect(reply.say).toBe("I can answer about what's in this app. Open questions need AI. Set ANTHROPIC_API_KEY when you start the dev server to turn it on.");
  });

  it("no door — a built page, a static host answering with its page — is no AI, said as any product says it", async () => {
    for (const door of [async () => json(404, {}), async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("<!doctype html>"); } }), async () => { throw new TypeError("offline"); }]) {
      const ai = await aiThroughDevServer({ fetch: door });
      expect(ai).toEqual({});
      const reply = await seatResponder<AnySchema>(ai)(store(), "what should I do first?", { places });
      expect(reply.say).toBe(NO_AI_SAID);
    }
  });

  it("a model that fails leaves the graph's answer with a quiet line, never the door's error", async () => {
    const ai = await aiThroughDevServer({
      fetch: async (_path, init) => (init?.method === "POST" ? json(401, { error: "The model refused the key in ANTHROPIC_API_KEY." }) : json(200, { configured: true, model: "m", name: "claude" })),
    });
    const reply = await seatResponder<AnySchema>(ai)(store(), "what should I do first?", { places });
    expect(reply.say).toContain("AI didn't answer just now");
  });
});
