// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Connections } from "../../src/index.js";

/*
 * "+N MORE" ON A CARD IS A BUTTON (Nick, 2026-10-15). A module's card listed
 * eight of its ten findings and then "+2 more", which was a chip with no
 * press behind it: the card said there were two more and offered no way to
 * see them. It opens the group in place — every chip — says it is open,
 * and closes again.
 */
const module_ = defineNode("module", { fields: z.object({ title: z.string() }), label: (n) => n.title });
const finding = defineNode("finding", {
  fields: z.object({ title: z.string() }),
  label: (n) => n.title,
  edges: { in: { to: ["module"], cardinality: "one", description: "the module it was found in", inverse: "the findings in it" } },
});
const schema = createSchema([module_, finding]);

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => host.remove());

describe("+N more on a card", () => {
  it("is a button that opens every chip of its group and closes it again", async () => {
    const findings = Array.from({ length: 10 }, (_, at) => ({ id: `f${at}`, kind: "finding" as const, title: `Finding ${at + 1}` }));
    const store = new Store({
      schema,
      mutations: [],
      snapshot: {
        nodes: [{ id: "m", kind: "module", title: "Hospital Services" }, ...findings],
        edges: findings.map((one) => ({ kind: "in", from: one.id, to: "m" })),
      },
    });
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store} views={createViews(schema)} initialView={EMPTY_VIEW}>
          <Connections id="m" />
        </GraviewProvider>,
      );
    });
    const more = () => host.querySelector<HTMLButtonElement>("[data-graview-more]");
    const chips = () => host.querySelectorAll("[data-graview-pick]").length;
    expect(more()?.tagName).toBe("BUTTON");
    expect(more()?.getAttribute("aria-expanded")).toBe("false");
    expect(more()?.textContent).toBe("+2 more");
    expect(host.querySelector(`#${more()!.getAttribute("aria-controls")}`)).not.toBeNull();
    expect(chips()).toBe(8);

    await act(async () => more()!.click());
    expect(more()?.getAttribute("aria-expanded")).toBe("true");
    expect(more()?.textContent).toBe("Show fewer");
    expect(chips()).toBe(10);

    await act(async () => more()!.click());
    expect(more()?.getAttribute("aria-expanded")).toBe("false");
    expect(chips()).toBe(8);
    await act(async () => root.unmount());
  });

  it("is not drawn where every chip already shows", async () => {
    const store = new Store({
      schema,
      mutations: [],
      snapshot: { nodes: [{ id: "m", kind: "module", title: "Billing" }, { id: "f", kind: "finding", title: "Statements printed twice" }], edges: [{ kind: "in", from: "f", to: "m" }] },
    });
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store} views={createViews(schema)} initialView={EMPTY_VIEW}>
          <Connections id="m" />
        </GraviewProvider>,
      );
    });
    expect(host.querySelector("[data-graview-more]")).toBeNull();
    await act(async () => root.unmount());
  });
});
