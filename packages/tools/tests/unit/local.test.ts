import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { localCompletion, NO_AI, openAiCompatibleCompletion, seatResponder, xaiCompletion } from "../../src/index.js";

/**
 * The models a host can give a seat: the graph always answers first, a
 * model in the browser and a remote one sit behind it, and a model that
 * fails leaves the graph's answer with a quiet line — never an error where
 * an answer existed.
 */

const thing = defineNode("thing", { fields: z.object({ label: z.string() }), plural: "Things" });
const schema = createSchema([thing]);
const bound = bindSchema(schema);
const rename = bound.defineMutation("rename", {
  title: "Rename it",
  description: "Change the label.",
  subject: { kinds: ["thing"], arg: "id" },
  input: z.object({ id: z.string(), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const store = () =>
  new Store({
    schema,
    mutations: [rename],
    invariants: [],
    snapshot: { nodes: [{ id: "a", kind: "thing", label: "Widget" }] as never, edges: [] },
  });

describe("a remote model is one fetch", () => {
  it("speaks the OpenAI-compatible shape and returns the content", async () => {
    let seen: { url?: string; auth?: string; body?: Record<string, unknown> } = {};
    const complete = openAiCompatibleCompletion({
      baseUrl: "https://example.test/v1/",
      apiKey: "k",
      model: "m",
      fetch: async (url, init) => {
        seen = { url, auth: init.headers["authorization"], body: JSON.parse(init.body) };
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "hi" } }] }),
          text: async () => "",
        };
      },
    });
    expect(await complete("prompt words")).toBe("hi");
    expect(seen.url).toBe("https://example.test/v1/chat/completions");
    expect(seen.auth).toBe("Bearer k");
    expect(seen.body).toEqual({ model: "m", messages: [{ role: "user", content: "prompt words" }] });
  });

  it("xAI is a preset of the same shape", async () => {
    let url = "";
    const complete = xaiCompletion({
      apiKey: "xai-k",
      fetch: async (u) => {
        url = u;
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "grok says" } }] }),
          text: async () => "",
        };
      },
    });
    expect(await complete("x")).toBe("grok says");
    expect(url).toBe("https://api.x.ai/v1/chat/completions");
  });

  it("says the status plainly when the provider refuses", async () => {
    const complete = xaiCompletion({
      apiKey: "bad",
      fetch: async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => "no" }),
    });
    await expect(complete("x")).rejects.toThrow(/401/);
  });
});

describe("the on-device model warms off the critical path", () => {
  it("reports warming then ready, and answers once warm", async () => {
    const states: string[] = [];
    const local = localCompletion({
      onStatus: (status) => states.push(status.state),
      load: async () => ({
        chat: {
          completions: {
            create: async () => ({ choices: [{ message: { content: "local words" } }] }),
          },
        },
      }),
    });
    expect(local.ready()).toBe(false);
    await expect(local.complete("x")).rejects.toThrow(/not warm/);
    local.warm();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(local.ready()).toBe(true);
    expect(states).toEqual(["warming", "ready"]);
    expect(await local.complete("x")).toBe("local words");
  });
});

/*
 * AN UNREACHABLE PROVIDER, WITHOUT THE NETWORK. These tests asked a real
 * fetch for https://nowhere.invalid and waited for DNS to give up — under
 * a second here, past the five-second limit on a CI runner (PR #17). The
 * provider not answering is the point; how long a resolver takes is not.
 */
function unreachable(): void {
  vi.stubGlobal("fetch", async () => {
    throw new TypeError("fetch failed: getaddrinfo ENOTFOUND nowhere.invalid");
  });
}
afterEach(() => {
  vi.unstubAllGlobals();
});

const remote = (baseUrl: string) => ({ complete: openAiCompatibleCompletion({ baseUrl, apiKey: "k", model: "m" }) });

describe("grounded facts outrank any model", () => {
  it("answers a graph-answerable question from the graph, with no note, whatever the host gave", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    // "tell me about Widget" is grounded: the model must not even be tried.
    const reply = await seatResponder<typeof schema>(remote("https://x.invalid/v1"))(store(), "tell me about Widget");
    expect(reply.say).toContain("Widget — a thing");
    expect(reply.say).not.toContain("AI");
    expect(reply.via).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hands the model only what the graph cannot answer specifically", async () => {
    unreachable();
    // Ungrounded chit-chat reaches the model; its failure leaves the graph's answer.
    const reply = await seatResponder<typeof schema>(remote("https://nowhere.invalid/v1"))(store(), "write me a poem");
    expect(reply.say).toContain("AI didn't answer just now, so this is from the app alone.");
  });
});

describe("seatResponder: the graph always answers first", () => {
  it("answers from the graph when the host gave no model", async () => {
    const reply = await seatResponder<typeof schema>(NO_AI)(store(), "tell me about Widget");
    expect(reply.say).toContain("Widget — a thing");
    expect(reply.via).toBeUndefined();
  });

  it("falls back to the graph with a quiet line when the model fails", async () => {
    unreachable();
    const reply = await seatResponder<typeof schema>(remote("https://nowhere.invalid/v1"))(store(), "hello");
    expect(reply.say).toContain("1 Things");
    expect(reply.say).toContain("AI didn't answer just now");
    expect(reply.via).toBeUndefined();
  });

  it("answers from the graph, saying AI isn't available, where the browser cannot run the on-device model the host turned on", async () => {
    // Node has no WebGPU and no Prompt API: the bring-up fails at once, and the seat says so rather than "getting ready" forever.
    const reply = await seatResponder<typeof schema>({ onDevice: { model: `no-webgpu-${Date.now()}` } })(store(), "hello");
    expect(reply.say).toContain("1 Things");
    expect(reply.say).toContain("AI isn't available in this browser, so this is from the app alone.");
    expect(reply.via).toBeUndefined();
  });
});
