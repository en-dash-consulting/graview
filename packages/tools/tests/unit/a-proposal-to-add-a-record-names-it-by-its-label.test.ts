import { compileDocument } from "@graview/core/check";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { describe, expect, it } from "vitest";
import { describeProposal } from "../../src/index.js";

/**
 * THE OFFER UNDER AN ANSWER NAMES THE RECORD (FR-169). On Graview Cloud's
 * staging, a model asked to "add a new revenue stream for Graview Cloud
 * SaaS" proposed `add-revenue-stream` with the name and `maturity:
 * nascent`, and the offer read "Add a revenue stream: nascent". The person
 * read the maturity as the title. The offer names the new record by its
 * label, then the rest, in whatever order the model sent them.
 */
const CLOUD = {
  format: "graview-document",
  formatVersion: 1,
  name: "Graview Cloud",
  kinds: {
    "revenue-stream": {
      noun: "revenue stream",
      fields: { maturity: { type: "enum", options: ["nascent", "growing", "mature"] }, name: { type: "string", required: true } },
    },
  },
  acts: { "add-revenue-stream": { title: "Add a revenue stream", creates: "revenue-stream" } },
};

describe("a proposal to add a record, offered", () => {
  const compiled = compileDocument(CLOUD);
  if (!compiled.ok) throw new Error("the document compiles");
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: { nodes: [], edges: [] } });
  const proposal = { mutation: "add-revenue-stream", args: { maturity: "nascent", name: "Graview Cloud SaaS" } };

  it("names it by its label, then the rest", () => {
    expect(describeProposal(store, proposal)).toBe("Add a revenue stream: Graview Cloud SaaS (nascent)");
  });

  it("is offered in the words the log keeps once it is taken", () => {
    const offered = describeProposal(store, proposal);
    expect(store.apply({ name: proposal.mutation, args: proposal.args }).ops[0]!.intent).toBe(offered);
  });
});
