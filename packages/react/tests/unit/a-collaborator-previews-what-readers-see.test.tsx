// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, type Principal } from "@graview/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, useGraph } from "../../src/index.js";

/**
 * A COLLABORATOR PREVIEWS WHAT READERS SEE (Roadmap f-publishing-lifecycle).
 * In an app that publishes, a working seat is served the head; `as` on the
 * provider — or `?as=published` in the page's address — serves it the app
 * as readers are served it, the last publish, to look before publishing.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-note", {
  title: "Add a note",
  creates: ["note"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "n"), kind: "note", label: args.label } as never);
  },
});
const editor: Principal = { kind: "human", id: "eve", roles: ["editor"] };

const store = () => {
  const made = new Store({
    schema,
    mutations: [add],
    policy: { grants: [{ roles: ["editor"], mutations: "*" }] },
    publishing: { mode: "on-publish", working: ["editor"] },
    snapshot: { nodes: [{ id: "n0", kind: "note", label: "Published" }], edges: [] } as never,
  });
  made.apply({ name: "add-note", args: { label: "Draft" } }, { author: editor });
  return made;
};

function Labels() {
  const graph = useGraph();
  return <pre data-testid="labels">{graph.map((node) => String(node.label)).sort().join(",")}</pre>;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  history.replaceState(null, "", "/");
});

const drawn = (element: React.ReactElement) => {
  act(() => root.render(element));
  return host.querySelector("[data-testid=labels]")!.textContent;
};

describe("a collaborator in an app that publishes", () => {
  it("is shown the head as it is edited", () => {
    expect(drawn(<GraviewProvider store={store()} views={createViews(schema)} principal={editor}><Labels /></GraviewProvider>)).toBe("Draft,Published");
  });

  it("is shown what readers see when the provider is asked as published", () => {
    expect(drawn(<GraviewProvider store={store()} views={createViews(schema)} principal={editor} as="published"><Labels /></GraviewProvider>)).toBe("Published");
  });

  it("is shown what readers see with ?as=published in the address", () => {
    history.replaceState(null, "", "/?as=published");
    expect(drawn(<GraviewProvider store={store()} views={createViews(schema)} principal={editor}><Labels /></GraviewProvider>)).toBe("Published");
  });
});
