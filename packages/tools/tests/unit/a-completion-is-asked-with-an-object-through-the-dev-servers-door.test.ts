import { AI_BRIDGE_PATH } from "@graview/core";
import { describe, expect, it } from "vitest";
import { aiThroughDevServer } from "../../src/dev-ai.js";
import type { CompletionRequest } from "../../src/intelligence.js";

/**
 * A COMPLETION IS ASKED WITH AN OBJECT, AND ANSWERS ONE. Through the dev
 * server's door the page posts the words, the framing and the pictures
 * (`{ prompt, system, images }`), gives up on the post when its signal
 * does, and reads back the text and what the call used.
 */
type Posted = { url: string; method?: string; body?: string; signal?: AbortSignal };

function door(answer: unknown) {
  const posted: Posted[] = [];
  const fetch = async (url: string, init?: { method?: string; body?: string; signal?: AbortSignal }) => {
    posted.push({ url, ...init });
    if (init?.method === "GET") return { ok: true, status: 200, json: async () => ({ configured: true, model: "claude-sonnet-5-5", name: "claude" }) };
    return { ok: true, status: 200, json: async () => answer };
  };
  return { posted, fetch };
}

describe("a completion through the dev server's door", () => {
  it("posts the words, the framing and the pictures, and answers the text and its usage", async () => {
    const { posted, fetch } = door({ text: "A receipt.", usage: { inputTokens: 40, outputTokens: 3 } });
    const ai = await aiThroughDevServer({ fetch });
    const controller = new AbortController();
    const request: CompletionRequest = { prompt: "What is this?", system: "Read receipts.", images: [{ mediaType: "image/png", data: "iVBORw0KGgo=" }], signal: controller.signal };
    const reply = await ai.complete!(request);
    expect(reply).toEqual({ text: "A receipt.", usage: { inputTokens: 40, outputTokens: 3 } });
    const post = posted.find((one) => one.method === "POST")!;
    expect(post.url).toBe(AI_BRIDGE_PATH);
    expect(JSON.parse(post.body!)).toEqual({ prompt: "What is this?", system: "Read receipts.", images: [{ mediaType: "image/png", data: "iVBORw0KGgo=" }] });
    expect(post.signal).toBe(controller.signal);
  });

  it("asks with the words alone when nothing else is given, and answers no usage the door did not say", async () => {
    const { posted, fetch } = door({ text: "Hello." });
    const ai = await aiThroughDevServer({ fetch });
    expect(await ai.complete!({ prompt: "hi" })).toEqual({ text: "Hello." });
    expect(JSON.parse(posted.find((one) => one.method === "POST")!.body!)).toEqual({ prompt: "hi" });
  });
});
