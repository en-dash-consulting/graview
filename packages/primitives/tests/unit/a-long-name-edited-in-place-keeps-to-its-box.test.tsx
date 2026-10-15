// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EditableValue } from "../../src/index.js";

/*
 * A LONG NAME EDITED IN PLACE KEEPS TO ITS BOX (the tenth walk). The field
 * is as wide as the name in characters, and a callout's name is sixty of
 * them: on a phone, pressing it to rename it made a field a thousand pixels
 * wide, and the page scrolled sideways by 383 under the person typing. The
 * field grows with the name only as far as the box it stands in.
 */
const callout = defineNode("callout", { fields: z.object({ label: z.string() }) });
const schema = createSchema([callout]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename it",
  subject: { kinds: ["callout"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["callout"]), label: z.string() }),
  apply: (ctx, args) => ctx.patchNode(args.id, { label: args.label }),
});

describe("a long name edited in place", () => {
  it("is a field no wider than the box it stands in", async () => {
    const label = "2016/001 · Exhausted runner, the north face of Ridgeline";
    const store = new Store({ schema, mutations: [rename], invariants: [], snapshot: { nodes: [{ id: "c1", kind: "callout", label }] as never, edges: [] } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store} views={createViews(schema)}>
          <EditableValue nodeId="c1" field="label" value={label} />
        </GraviewProvider>,
      );
    });
    await act(async () => host.querySelector<HTMLButtonElement>('button[data-graview-field="label"]')!.click());
    const input = host.querySelector<HTMLInputElement>('input[data-graview-field="label"]')!;
    // The field and the form around it: a grid's item grows to its content's width unless the content gives.
    expect(input.style.maxWidth).toBe("100%");
    expect(input.style.minWidth).toBe("0px");
    expect(input.style.boxSizing).toBe("border-box");
    expect(input.closest("form")!.style.maxWidth).toBe("100%");
    await act(async () => root.unmount());
    host.remove();
  });
});
