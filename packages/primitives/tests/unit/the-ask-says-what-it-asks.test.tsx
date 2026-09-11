// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { deriveAffordances, defaultProviders } from "@graview/tools";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Inspector, registerDefaultViews } from "../../src/index.js";

/**
 * AN ASK SAYS WHAT IT IS ASKING, IN WORDS.
 *
 * W-004 gave the strip's text field a label and a placeholder in the app's
 * own words, because the scene had been asking with the declaration's
 * identifier while the pages face asked in English. Two things it did not
 * reach:
 *
 * The CHOICES branch — what a node reference gets — said nothing at all. An
 * act with one far end to fill put bare buttons on the strip ("Ana", "Bo")
 * under no heading: a guess for anyone looking, and nothing whatsoever for
 * anyone listening. And the step counter above a multi-part ask printed the
 * raw key, "dependsOn · 1 of 2", which is the same bug one element higher.
 */
const item = defineNode("item", {
  description: "A thing.",
  fields: z.object({ label: z.string(), status: z.enum(["open", "closed"]) }),
  plural: "Items",
  label: (node) => node.label,
  edges: { "kept-by": { to: ["owner"], description: "who is seeing to it", inverse: "what they are seeing to" } },
});
const owner = defineNode("owner", {
  description: "Someone.",
  fields: z.object({ label: z.string(), email: z.string() }),
  plural: "Owners",
  label: (node) => node.label,
});
const schema = createSchema([item, owner]);
const { defineMutation } = bindSchema(schema);

const addItem = defineMutation("add-item", {
  title: "Add an item",
  creates: ["item"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "item"), kind: "item", label: args.label, status: "open" });
  },
});
const addOwner = defineMutation("add-owner", {
  title: "Add an owner",
  creates: ["owner"],
  input: z.object({ label: z.string().min(1), email: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "owner"), kind: "owner", label: args.label, email: args.email });
  },
});
const keep = defineMutation("keep-item", {
  title: "Hand it to someone",
  subject: { kinds: ["item"], arg: "id" },
  connects: ["kept-by"],
  severs: ["kept-by"],
  input: z.object({ id: nodeRef(["item"]), owner: nodeRef(["owner"]) }),
  apply(ctx, args) {
    ctx.setSingleSource("kept-by", args.id, args.owner);
  },
});

/** Renders the strip over a selection, presses one act, returns the document. */
async function pressing(act_: string, selection: readonly string[]) {
  const store = new Store({ schema, mutations: [addItem, addOwner, keep], invariants: [] });
  store.apply({ name: "add-item", args: { label: "Pay the deposit" } });
  store.apply({ name: "add-owner", args: { label: "Ana", email: "ana@walk.test" } });
  store.apply({ name: "add-owner", args: { label: "Bo", email: "bo@walk.test" } });
  const views = registerDefaultViews(schema, createViews(schema));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(() => {
    root.render(
      <GraviewProvider
        store={store}
        views={views}
        initialView={{ ...EMPTY_VIEW, overview: true, selection }}
      >
        <Inspector />
      </GraviewProvider>,
    );
  });
  const offer = [...host.querySelectorAll("button[data-affordance]")].find(
    (button) => button.getAttribute("data-affordance") === act_,
  );
  if (!offer) throw new Error(`no ${act_} among ${[...host.querySelectorAll("button[data-affordance]")].map((b) => b.getAttribute("data-affordance")).join(", ")}`);
  await act(async () => {
    (offer as HTMLButtonElement).click();
  });
  return { host, root, store };
}

const cleanup = ({ host, root }: { host: HTMLElement; root: { unmount(): void } }) => {
  root.unmount();
  host.remove();
};

describe("the strip's ask", () => {
  it("names the question over a list of candidates, and on each of them", async () => {
    const rendered = await pressing("schema:keep-item", ["item:pay-the-deposit"]);
    const group = rendered.host.querySelector('[role="group"]');
    expect(group, "candidates are a named group").not.toBeNull();
    const label = rendered.host.querySelector(`#${group!.getAttribute("aria-labelledby")}`);
    expect(label?.textContent).toBe("Owner");
    const names = [...group!.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["Owner: Ana", "Owner: Bo"]);
    // And never the declaration's identifier.
    expect(rendered.host.textContent).not.toContain("owner ·");
    cleanup(rendered);
  });

  it("counts the steps of a longer ask in words, not in keys", async () => {
    const rendered = await pressing("schema:add:add-owner", ["kind:owner"]);
    expect(rendered.host.textContent).toContain("Label · 1 of 2");
    expect(rendered.host.textContent).not.toContain("label · 1 of 2");
    cleanup(rendered);
  });

  it("leaves a single text field to name itself, rather than saying it twice", async () => {
    const rendered = await pressing("schema:add:add-item", ["kind:item"]);
    const input = rendered.host.querySelector("input");
    expect(input?.getAttribute("aria-label")).toBe("Label");
    // One "Label", from the field itself — not a heading over it as well.
    expect((rendered.host.textContent ?? "").match(/Label/g)?.length ?? 0).toBe(0);
    cleanup(rendered);
  });
});
