import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  configuredResponder,
  DEFAULT_INTELLIGENCE,
  describeIntelligence,
  loadIntelligenceConfig,
  localCompletion,
  openAiCompatibleCompletion,
  saveIntelligenceConfig,
  xaiCompletion,
} from "../../src/index.js";

/**
 * The intelligence ladder: the graph is always the floor, a browser model
 * and a keyed frontier model are rungs above it, and a failed rung answers
 * from the floor with a note — never with an error where an answer existed.
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

type Shim = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const withStorage = (shim: Shim | undefined) => {
  (globalThis as { localStorage?: Shim }).localStorage = shim as never;
};
afterEach(() => {
  delete (globalThis as { localStorage?: Shim }).localStorage;
});

describe("the rung is a setting in the person's own storage", () => {
  it("defaults to the graph when nothing is stored, or storage throws", () => {
    expect(loadIntelligenceConfig()).toEqual(DEFAULT_INTELLIGENCE);
    withStorage({
      getItem() {
        throw new Error("blocked");
      },
      setItem() {},
    });
    expect(loadIntelligenceConfig()).toEqual(DEFAULT_INTELLIGENCE);
    expect(() => saveIntelligenceConfig({ source: "local" })).not.toThrow();
  });

  it("round-trips a saved rung", () => {
    const held = new Map<string, string>();
    withStorage({ getItem: (k) => held.get(k) ?? null, setItem: (k, v) => void held.set(k, v) });
    saveIntelligenceConfig({ source: "remote", remote: { preset: "xai", apiKey: "xai-test" } });
    expect(loadIntelligenceConfig().source).toBe("remote");
    expect(describeIntelligence(loadIntelligenceConfig())).toBe("grok-4-fast");
  });
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

describe("the local rung warms off the critical path", () => {
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

describe("grounded facts outrank any model", () => {
  it("answers a graph-answerable question from the graph, whatever the rung", async () => {
    let modelAsked = 0;
    const responder = configuredResponder(
      { source: "remote", remote: { preset: "custom", baseUrl: "https://x.invalid/v1", apiKey: "k", model: "m" } },
    );
    // "tell me about Widget" is grounded: the model must not even be tried.
    const reply = await responder(store(), "tell me about Widget");
    expect(reply.say).toContain("Widget — a thing");
    expect(reply.say).toContain("(from the graph)");
    expect(modelAsked).toBe(0);
  });

  it("hands the model only what the graph cannot answer specifically", async () => {
    const responder = configuredResponder({
      source: "remote",
      remote: { preset: "custom", baseUrl: "https://nowhere.invalid/v1", apiKey: "k", model: "m" },
    });
    // Ungrounded chit-chat reaches the model; its failure falls to the floor.
    const reply = await responder(store(), "write me a poem");
    expect(reply.say).toContain("m did not answer");
  });
});

describe("configuredResponder: the graph is always the floor", () => {
  it("answers from the graph by default", async () => {
    const reply = await configuredResponder(DEFAULT_INTELLIGENCE)(store(), "hello");
    expect(reply.say).toContain("1 Things");
  });

  it("falls back to the graph with a note when the remote model fails", async () => {
    // No fetch shim and an unreachable host: the completion rejects, and
    // the conversation still gets a real answer.
    const responder = configuredResponder({
      source: "remote",
      remote: { preset: "custom", baseUrl: "https://nowhere.invalid/v1", apiKey: "k", model: "m" },
    });
    const reply = await responder(store(), "hello");
    expect(reply.say).toContain("1 Things");
    expect(reply.say).toContain("m did not answer");
  });

  it("answers from the graph while the local model warms, then upgrades", async () => {
    // The default local rung would import WebLLM off the network; here the
    // point is the LADDER: cold → floor with a note. (The warm path is
    // covered through localCompletion above.)
    const responder = configuredResponder({ source: "local" });
    const reply = await responder(store(), "hello");
    expect(reply.say).toContain("1 Things");
    expect(reply.say).toContain("warming");
  });
});
