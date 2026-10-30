import type { AnySchema, Principal, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createTodoUiStore } from "../apps/todo/src/ui/app.js";
import { answerHere } from "../packages/tools/src/inline-ai.js";
import { jevDecide, jevKeyFromEnvironment, JEV_MODEL } from "../packages/tools/src/providers/jev.js";
import type { ThinkingProvider } from "../packages/tools/src/ai.js";

/*
 * THE ASSIGN PLAN, TIMED ON REAL JEV (Roadmap f-menu-type-anything). Opt-in:
 * it runs only where TYPESAFE_API_KEY (or JEV_API_KEY) is set, and — for the
 * light model's open answer — XAI_API_KEY. It says the times it measured and
 * asserts only what a live answer must be: the tasks the list holds, the
 * person, a link the app lacks, decided by Jev with no Thinking model asked.
 * The target is the plan on the card in about two seconds.
 */
const key = jevKeyFromEnvironment();
const xai = process.env["XAI_API_KEY"];
const nora: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const never: ThinkingProvider = { model: "never", think: async () => { throw new Error("the Thinking slot was asked"); } };

/** xAI's light model, asked as the dev server's door would ask it. */
const grokLight: ThinkingProvider = {
  model: "grok-4.20-0309-non-reasoning",
  think: async ({ system, prompt }) => {
    const answer = await fetch("https://api.x.ai/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${xai}` }, body: JSON.stringify({ model: "grok-4.20-0309-non-reasoning", messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }) });
    const body = (await answer.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    return { text: body.choices?.[0]?.message?.content ?? "", usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 } };
  },
};

describe.skipIf(!key)("the assign plan, on real Jev", () => {
  it("decides “assign all these to Sam” on This week over the graph, with no Thinking model, and says how long it took", async () => {
    const store = createTodoUiStore("2026-09-01") as unknown as Store<AnySchema>;
    const started = Date.now();
    const result = await answerHere({ fast: { model: JEV_MODEL, decide: jevDecide({ apiKey: key! }) }, thinking: never }, { store, target: { on: "record", id: "week" }, principal: nora, said: "assign all these to Sam" });
    const total = Date.now() - started;
    console.log(`LIVE TIMINGS assign plan: ${total} ms in all; stages ${JSON.stringify(result.interaction.stages)}`);
    expect(result.reading?.which).toBe("held");
    expect(result.missing).toMatchObject({ need: { link: { on: "task", to: "person" } }, who: "Sam" });
    expect(result.interaction.stages?.map((one) => one.stage)).toEqual(["fast"]);
  });

  it("revises the plan on a reply that says the tasks, not the list", async () => {
    const store = createTodoUiStore("2026-09-01") as unknown as Store<AnySchema>;
    const started = Date.now();
    const result = await answerHere({ fast: { model: JEV_MODEL, decide: jevDecide({ apiKey: key! }) }, thinking: never }, { store, target: { on: "record", id: "week" }, principal: nora, said: "no, not lists.. i want to assign the tasks in this list to sam", follows: { said: "assign all these to Sam", answer: "Lists can't be assigned to a person.", reading: "itself" } } as never);
    console.log(`LIVE TIMINGS reply: ${Date.now() - started} ms in all; stages ${JSON.stringify(result.interaction.stages)}`);
    expect(result.reading?.which).toBe("held");
    expect(result.missing).toMatchObject({ need: { link: { on: "task", to: "person" } }, who: "Sam" });
  });

  it.skipIf(!xai)("words an open answer with the light model, and says how long", async () => {
    const store = createTodoUiStore("2026-09-01") as unknown as Store<AnySchema>;
    const started = Date.now();
    const result = await answerHere({ fast: { model: JEV_MODEL, decide: jevDecide({ apiKey: key! }) }, light: grokLight, thinking: never }, { store, target: { on: "record", id: "week" }, principal: nora, said: "what is left to do this week?" });
    const total = Date.now() - started;
    console.log(`LIVE TIMINGS open answer: ${total} ms in all; stages ${JSON.stringify(result.interaction.stages)}`);
    expect(result.interaction.stages?.some((one) => one.stage === "light")).toBe(true);
    expect(result.interaction.stages?.some((one) => one.stage === "thinking")).toBe(false);
  });
});
