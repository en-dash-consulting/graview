import { readableFields, Store } from "@graview/core";
import { awkwardApp, awkwardGraph } from "@graview/core/testing";
import { describe, expect, it } from "vitest";
import { recordFacts } from "../../src/index.js";

/**
 * A RECORD'S PAGE SAYS EVERY FIELD IT HOLDS.
 *
 * The seventh walk's car has sixteen fields, and its page stopped at the
 * tenth: Condition was the last thing a shopper read, and the price, the
 * mileage, the features and the history were not there and not missed by
 * anything, because the examples' records hold two to five. A glance (a
 * card, a chip) chooses a few; the record is where every one is read and
 * changed, so it keeps them all — and so does what the assistant answers
 * from, which read the same capped list.
 */
describe("a record with more fields than a glance shows", () => {
  const app = awkwardApp({ kinds: 2, fields: 16, people: false, chain: false });
  const store = new Store({ schema: app.schema, mutations: app.mutations, snapshot: awkwardGraph(app, 2) });

  it("states every one on its page", () => {
    for (const node of store.graph.allNodes()) {
      const held = Object.keys(node).filter((key) => key !== "id" && key !== "kind" && key !== "label");
      expect(held).toHaveLength(15);
      const facts = recordFacts(store as never, node.id)!;
      expect(facts.fields.map((field) => field.key)).toEqual(expect.arrayContaining(held));
    }
  });

  it("is read whole unless a glance asks for fewer", () => {
    const node = store.graph.allNodes()[0]!;
    const definition = store.schema.tryDefinition(node.kind as string);
    expect(readableFields(node as never, definition)).toHaveLength(15);
    expect(readableFields(node as never, definition, { limit: 3 })).toHaveLength(3);
  });
});
