import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { stubThinking } from "../../src/inline-ai.js";
import { answerHere } from "../../src/inline-ai.js";
import { jevDecide, jevKeyFromEnvironment, JEV_MODEL } from "../../src/providers/jev.js";

/*
 * THE MENU'S FAST SLOT, ASKED OF JEV ITSELF (Roadmap f-menu-type-anything).
 * Opt-in: it runs only where TYPESAFE_API_KEY (or JEV_API_KEY) is set, and
 * asserts only what a live model's answers must be — typed, among what was
 * offered, recorded as Jev's — never which way it judged.
 */
const key = jevKeyFromEnvironment();

const task = defineNode("task", {
  fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]).optional() }),
  edges: { "blocked-by": { to: ["task"], cardinality: "many" } },
  plural: "Tasks",
});
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "done" });
  },
});
const me: Principal = { kind: "human", id: "u-mo" };

describe.skipIf(!key)("the right-click menu's Fast slot, judged by Jev, live", () => {
  it("answers the menu's Choice over its rows, 'none of these' among them, with one of the options", async () => {
    const decide = jevDecide({ apiKey: key! });
    const decided = await decide({ typed: "complete" }, { row: { type: "choice", instructions: "Which of these menu rows does somebody typing “complete” mean?", criteria: { r1: "Rename it", r2: "Finish it", r3: "Copy link", none: "None of these rows" } } });
    const answer = decided.answers["row"];
    expect(answer?.type).toBe("choice");
    expect(["r1", "r2", "r3", "none"]).toContain(answer?.type === "choice" ? answer.choice : "");
  });

  it("picks a quick ask's context in typed questions, and the entry says Jev picked it", async () => {
    const store = new Store({
      schema,
      mutations: [finish],
      snapshot: {
        nodes: [
          { id: "t-1", kind: "task", label: "Book the van" },
          { id: "t-2", kind: "task", label: "Pack the boxes" },
        ],
        edges: [{ id: "e-1", kind: "blocked-by", from: "t-1", to: "t-2" }],
      } as never,
    });
    const result = await answerHere({ fast: { model: JEV_MODEL, decide: jevDecide({ apiKey: key! }) }, thinking: stubThinking() }, { store, target: { on: "record", id: "t-1" }, principal: me, said: "can I finish this once the boxes are packed?" });
    const sent = result.interaction.context!;
    expect(sent).toMatchObject({ by: "fast", model: JEV_MODEL });
    expect(sent.records.every((id) => id === "t-2")).toBe(true);
    expect(result.interaction.usage?.[0]).toMatchObject({ tier: "fast", model: JEV_MODEL });
  });
});
