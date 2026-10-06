// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EditableValue } from "../../src/index.js";

/**
 * FR-114. A NUMBER EDITED WHERE IT IS SHOWN IS ASKED FOR IN ITS RANGE.
 *
 * The routed face's form, the workbench's answer box and the studio's
 * agent panel put a field's `min`, `max` and `step` on their number inputs;
 * the value edited in place did not, so its spinner stepped to 6 on a field
 * that takes 1 to 5 and apply refused what the control had offered.
 */
const strength = defineNode("strength", { fields: z.object({ name: z.string(), level: z.number().int().min(1).max(5) }), plural: "Strengths" });
const schema = createSchema([strength]);
const { defineMutation } = bindSchema(schema);
const setLevel = defineMutation("set-level", {
  title: "Set the level",
  subject: { kinds: ["strength"], arg: "id" },
  writes: ["level"],
  input: z.object({ id: nodeRef(["strength"]), level: z.number().int().min(1).max(5) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { level: args.level });
  },
});

describe("a number edited in place", () => {
  it("says the field's range on its input", async () => {
    const store = new Store({ schema, mutations: [setLevel], invariants: [], snapshot: { nodes: [{ id: "s1", kind: "strength", name: "Hiring", level: 3 }] as never, edges: [] } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store} views={createViews(schema)}>
          <EditableValue nodeId="s1" field="level" value="3" />
        </GraviewProvider>,
      );
    });
    const opener = host.querySelector<HTMLButtonElement>('button[data-graview-field="level"]');
    expect(opener).not.toBeNull();
    await act(async () => opener!.click());
    const input = host.querySelector<HTMLInputElement>('input[data-graview-field="level"]');
    expect(input?.type).toBe("number");
    expect([input?.min, input?.max, input?.step]).toEqual(["1", "5", "1"]);
    await act(async () => root.unmount());
    host.remove();
  });
});
