// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, Scene, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews } from "../../src/index.js";

/**
 * A VALUE WITH NOWHERE TO BREAK STAYS IN ITS CELL.
 *
 * A dealership's staff member has an email address, one word of 38
 * characters. The editable value was a button as wide as its word, so it
 * ran out of its cell and under the next column of the card — her address
 * sat beneath the chips of her appointments. jsdom has no layout, so this
 * holds the two declarations that keep it in: never wider than the cell,
 * and free to break anywhere.
 */
const person = defineNode("person", {
  fields: z.object({ label: z.string(), email: z.string(), badge: z.string() }),
  plural: "People",
});
const schema = createSchema([person]);
const { defineMutation } = bindSchema(schema);
const reach = defineMutation("change-email", {
  title: "Change the address",
  subject: { kinds: ["person"], arg: "id" },
  writes: ["email"],
  input: z.object({ id: nodeRef(["person"]), email: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { email: args.email });
  },
});

describe("a field's value on a card", () => {
  it("is never wider than its cell and breaks anywhere, editable or not", async () => {
    const store = new Store({
      schema,
      mutations: [reach],
      invariants: [],
      snapshot: {
        nodes: [{ id: "p1", kind: "person", label: "Mei Lin Chow", email: "mei.lin.chow@springfieldmotors.example", badge: "WDC0G4JB1JF012345WDC0G4JB1JF012345" }] as never,
        edges: [],
      },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, focusId: "p1" }}>
          <Scene renderer="dom" />
        </GraviewProvider>,
      );
    });
    const editable = host.querySelector<HTMLElement>('[data-graview-editable][data-graview-field="email"]');
    expect(editable, "the address is offered for editing").not.toBeNull();
    expect(editable!.style.maxWidth).toBe("100%");
    expect(editable!.style.overflowWrap).toBe("anywhere");
    const fixed = host.querySelector<HTMLElement>('[data-graview-readonly][data-graview-field="badge"]');
    if (fixed) expect(fixed.style.overflowWrap).toBe("anywhere");
    await act(async () => root.unmount());
    host.remove();
  });
});
