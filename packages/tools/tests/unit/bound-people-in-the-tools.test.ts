import { createSchema, defineNode, Store, type AnySchema, type Principal } from "@graview/core";
import { bindPerson } from "@graview/core/binding";
import { aiContextOf } from "@graview/core/catalog";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { factsOf } from "../../src/facts.js";
import { createToolRuntime, nodeState } from "../../src/index.js";
import { dream, NONE_FITS, NONE_OF_THESE, type DreamModel, type SystemOneAnswer } from "../../src/tidy.js";

/*
 * BOUND PEOPLE, AS THE TOOLS SAY THEM (Roadmap
 * f-binding-dry-run-and-seat-rules). An app whose people are bound to the
 * accounts that joined is said as its records and their fields, by every
 * tool and to every seat: the host, the person, an agent for them and
 * anybody else.
 */
const person = defineNode("person", { people: true, description: "Somebody on the team.", fields: z.object({ label: z.string(), email: z.string().optional() }) });
const task = defineNode("task", { fields: z.object({ label: z.string(), notes: z.string().optional() }), edges: { owner: { to: ["person"], cardinality: "one" } } });
const schema = createSchema([person, task]);
const NOW = "2026-11-15T09:00:00.000Z";

const host: Principal = { kind: "system", id: "host" };
const ada: Principal = { kind: "human", id: "acct-ada-7f3", roles: ["member"] };
const bea: Principal = { kind: "human", id: "acct-bea-9c1", roles: ["member"] };
const forAda: Principal = { kind: "agent", id: "helper", onBehalfOf: ada } as Principal;
const ACCOUNT = /acct-|\$seat/;

function team(): Store<AnySchema> {
  const store = new Store<AnySchema>({
    schema,
    now: () => NOW,
    snapshot: {
      nodes: [
        { id: "person:ada", kind: "person", label: "Ada Lovelace", email: "ada@example.com" },
        { id: "person:ada-2", kind: "person", label: "Ada Lovelace" },
        { id: "person:bea", kind: "person", label: "Bea Smith" },
        { id: "task:plan", kind: "task", label: "Plan the offsite", notes: "Ada said Tuesday" },
      ] as never,
      edges: [{ kind: "owner", from: "task:plan", to: "person:ada" }],
    },
  });
  bindPerson(store, ada, "person:ada", { author: host });
  bindPerson(store, bea, "person:bea", { author: host });
  store.apply({ name: "edit-task", args: { id: "task:plan", notes: "Tuesday it is" } }, { author: ada });
  return store;
}

/** A System One model that answers unsure of everything, and keeps every state it was handed. */
function listening() {
  const states: unknown[] = [];
  const model: DreamModel = {
    model: "jev-latest",
    async decide(state, questions) {
      states.push(state);
      const answers: Record<string, SystemOneAnswer> = {};
      for (const [key, question] of Object.entries(questions)) {
        if (question.type === "noul") answers[key] = { type: "noul", noul: 0.1 };
        else if (question.type === "score") answers[key] = { type: "score", score: 0.1, confidence: 0.9, probabilities: { "0": 0.9, "1": 0.1, "2": 0 }, legend: {} };
        else {
          const none = NONE_OF_THESE in question.criteria ? NONE_OF_THESE : NONE_FITS;
          answers[key] = { type: "choice", choice: none, confidence: 0.9, probabilities: { [none]: 0.9 } };
        }
      }
      return { answers, usage: { inputTokens: 100, outputTokens: 0 } };
    },
  };
  return { model, states };
}

describe("a bound person, as the tools say them", () => {
  it("is their record and its fields to the app's own actor", async () => {
    const store = team();
    const { model, states } = listening();
    const report = await dream(store, { now: NOW, model, cache: false, olderThanDays: 0, quietHours: 0 });
    expect(states.length).toBeGreaterThan(0);
    expect(JSON.stringify(states)).toContain("Ada Lovelace");
    expect(JSON.stringify(states)).not.toMatch(ACCOUNT);
    expect(JSON.stringify(report)).not.toMatch(ACCOUNT);
  });

  it("is their record and its fields in a record's state and its facts, whoever asks", () => {
    const store = team();
    expect(JSON.stringify(nodeState(store, "person:ada"))).not.toMatch(ACCOUNT);
    for (const principal of [host, ada, bea, forAda]) {
      expect(JSON.stringify(factsOf(store, principal, ["person:ada", "person:bea", "task:plan"], "2026-11-15"))).not.toMatch(ACCOUNT);
      for (const target of [{ on: "record", id: "person:ada" }, { on: "record", id: "task:plan" }, { on: "list", kind: "person" }] as const) {
        const state = aiContextOf(store, target, { principal });
        expect(JSON.stringify(state)).not.toMatch(ACCOUNT);
      }
    }
    // Who changed the task is said as the person.
    expect(aiContextOf(store, { on: "record", id: "task:plan" }, { principal: host }).recent.map((one) => one.by)).toContain("Ada Lovelace");
  });

  it("is their record and its fields in what an agent reads, previews and does, whoever it is", async () => {
    for (const author of [host, ada, bea, forAda]) {
      const store = team();
      const tools = createToolRuntime(store, { author });
      for (const [name, args] of [
        ["get_node", { id: "person:ada" }],
        ["get_graph", {}],
        ["search_graph", { query: "Ada" }],
        ["preview_mutation", { mutation: "edit-person", args: { id: "person:ada", email: "lovelace@example.com" } }],
        ["preview_mutation", { mutation: "remove-person", args: { id: "person:ada" } }],
        ["edit-person", { id: "person:ada", email: "lovelace@example.com" }],
        ["archive-person", { id: "person:bea" }],
      ] as const) {
        const read = await tools.call(name, args as never);
        expect(read.ok, `${name} as ${author.id}`).toBe(true);
        expect(JSON.stringify(read), `${name} as ${author.id}`).not.toMatch(ACCOUNT);
      }
    }
  });
});
