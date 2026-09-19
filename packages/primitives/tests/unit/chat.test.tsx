import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ChatPanel, IntelligenceSettings, registerDefaultViews } from "../../src/index.js";

/**
 * The chat's standing contract, at render time. The living conversation is
 * driven in a real browser by scripts/verify-chat.mjs; what belongs here is
 * what must be true before anyone types: closed until asked for, honestly
 * labeled, and openable from the keyboard.
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

describe("the chat before anyone types", () => {
  it("is closed until asked for, and says so accessibly", () => {
    const html = render();
    expect(html).toContain('data-testid="chat"');
    expect(html).toContain('aria-expanded="false"');
    // The panel is not merely hidden — it is not rendered at all.
    expect(html).not.toContain('data-testid="chat-panel"');
    expect(html).not.toContain("Message the seat");
  });

  it("is a real button with a title that says what the seat is for", () => {
    const html = render();
    // A person who has never met the product reads this before clicking.
    expect(html).toContain("Talk to the seat");
    expect(html).toContain("Ask");
  });
});

describe("the rung picker", () => {
  it("offers four rungs, and says of the decision rung that it does not talk", () => {
    const html = renderToStaticMarkup(<IntelligenceSettings config={{ source: "decision" }} onDone={() => {}} />);
    expect(html.match(/name="intelligence-source"/g)).toHaveLength(4);
    expect(html).toContain("Jev (decides, does not talk)");
    expect(html).toContain("the graph still answers the chat");
    /* On the decision rung, the key is optional: the dev server's door holds one. */
    expect(html).toContain('data-testid="chat-decision-key"');
    expect(html).toContain("TYPESAFE_API_KEY");
  });
});
