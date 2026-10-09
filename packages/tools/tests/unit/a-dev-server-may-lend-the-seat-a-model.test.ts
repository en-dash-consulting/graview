import { placesOf, type AnySchema, type Store } from "@graview/core";
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
  it("a door holding a key lends a model, and each prompt goes through the door", async () => {
    const door = vi.fn(async (_path: string, init?: { method?: string; body?: string }) =>
      init?.method === "POST" ? json(200, { text: '{"say": "Start with the deposit.", "proposals": []}' }) : json(200, { configured: true, model: "claude-sonnet-5-5", name: "claude" }),
    );
    const ai = await aiThroughDevServer({ fetch: door });
    expect(ai.name).toBe("claude");
    expect(ai.complete).toBeDefined();
    const reply = await seatResponder<AnySchema>(ai)(store(), "what should I do first?", { places });
    expect(reply.say).toContain("Start with the deposit");
    expect(reply.via).toBe("ai:claude");
    expect(door.mock.calls.map(([path, init]) => [path, init?.method])).toEqual([["/__graview/ai", "GET"], ["/__graview/ai", "POST"]]);
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
