import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ChatPanel, registerDefaultViews } from "../../src/index.js";

/**
 * The conversation's standing contract, at render time. The living
 * conversation is driven in a real browser by the harnesses; what belongs
 * here is what must be true before anyone types: drawn in place with its
 * own field when it stands alone, no pill to press, no word "seat".
 */

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
});
const schema = createSchema([person]);
bindSchema(schema);

const store = () =>
  new Store({
    schema,
    mutations: [],
    invariants: [],
    snapshot: { nodes: [{ id: "ana", kind: "person", label: "Ana" }] as never, edges: [] },
  });

const render = (props: { respond?: never } = {}) =>
  renderToStaticMarkup(
    <GraviewProvider
      store={store()}
      views={registerDefaultViews(schema, createViews(schema))}
      initialView={{ ...EMPTY_VIEW, focusId: "ana" }}
    >
      <ChatPanel {...props} />
    </GraviewProvider>,
  );

describe("the conversation before anyone types", () => {
  it("is drawn in place with a field named for asking, and no pill to press first", () => {
    const html = render();
    expect(html).toContain('data-testid="chat-panel"');
    expect(html).toContain('aria-label="Ask"');
    expect(html).not.toContain('data-testid="chat"');
  });

  it("says what it can answer in the reader's words, never the word seat", () => {
    const text = render().replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'");
    expect(text).toContain("Ask what's wrong");
    expect(text.toLowerCase()).not.toContain("seat");
  });
});
