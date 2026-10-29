import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { blockContextFor, resolveBlocks } from "../../src/blocks.js";
import { parseTemplate, type GraviewDocument } from "../../src/document/index.js";
import { choiceWords, humanizeField, humanizeValue, Store, type AnySchema } from "../../src/index.js";
import { valueWords } from "../../src/words.js";

/**
 * AN OPTION IS SAID BY ITS LABEL, AND KEEPS THE CAPITALS ITS AUTHOR WROTE
 * (Roadmap f-lifelogics-findings, request
 * bug-option-ids-are-made-into-labels-badly-and-describe-lines-and-badges-show-raw-values).
 * On LifeLogics Estimates options with no label read "Open set", "En dash"
 * and "Life logics" — a name lowercased and split — and a kind's describe
 * line and a row's badge said the option's id ("done") where every other
 * face said its label. Now an option written with capitals keeps them, one
 * in lower case is spoken as a key is, and a choice named bare in a
 * describe line, a label or a badge is said by its option's label.
 */
const doc = {
  format: "graview-document",
  formatVersion: 1,
  name: "Estimates",
  kinds: {
    initiative: {
      label: "{name}",
      describe: "{status} by {owner}",
      fields: {
        name: { type: "string", required: true },
        status: { type: "enum", options: ["todo", "done"], optionLabels: { done: "Done by Dec 28" } },
        owner: { type: "enum", options: ["OpenSet", "EnDash", "LifeLogics", "Open Set", "state-sponsored", "inProgress", "SUV"] },
      },
    },
  },
  acts: { "add-initiative": { title: "Add an initiative", creates: "initiative" } },
  policy: { grants: [{ roles: "*", mutations: "*" }] },
} as unknown as GraviewDocument;

function opened() {
  const result = compileDocument(doc, { today: () => "2026-10-28" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings));
  const store = new Store<AnySchema>({ schema: result.app.schema, mutations: [], snapshot: { nodes: [{ id: "i1", kind: "initiative", name: "Pilot", status: "done", owner: "LifeLogics" }], edges: [] } as never });
  return { app: result.app, store };
}

describe("an option with no label", () => {
  it("keeps the capitals its author wrote, and is spoken as a key when written in lower case", () => {
    expect(["OpenSet", "EnDash", "LifeLogics", "Open Set", "En_Dash", "State-Sponsored", "SUV"].map(humanizeValue)).toEqual(["OpenSet", "EnDash", "LifeLogics", "Open Set", "En Dash", "State-Sponsored", "SUV"]);
    expect(["state-sponsored", "inProgress", "cvss", "open_set"].map(humanizeValue)).toEqual(["State sponsored", "In progress", "CVSS", "Open set"]);
    // A field's key is spoken as it was.
    expect(humanizeField("plannedAt")).toBe("Planned at");
  });

  it("is said so on every face that reads the choice", () => {
    const { store } = opened();
    const definition = store.schema.tryDefinition("initiative");
    expect(valueWords(definition, "owner", "LifeLogics")).toBe("LifeLogics");
    expect(choiceWords(store.schema, ["initiative"])["initiative"]!["owner"]).toMatchObject({ OpenSet: "OpenSet", EnDash: "EnDash", "state-sponsored": "State sponsored", inProgress: "In progress" });
  });
});

describe("a choice named bare", () => {
  it("is said by its label in the kind's describe line", () => {
    const { store } = opened();
    expect(store.schema.tryDefinition("initiative")!.describe!(store.graph.getNode("i1") as never)).toBe("Done by Dec 28 by LifeLogics");
  });

  it("is said by its label in a badge and a line of a card", () => {
    const { store } = opened();
    const resolved = resolveBlocks([{ t: "badge", parts: parseTemplate("{status}") }, { t: "text", parts: parseTemplate("{owner} · {status}") }] as never, blockContextFor(store, null, store.graph.getNode("i1") as never));
    expect(resolved.map((block) => (block as { text?: string }).text)).toEqual(["Done by Dec 28", "LifeLogics · Done by Dec 28"]);
  });
});
