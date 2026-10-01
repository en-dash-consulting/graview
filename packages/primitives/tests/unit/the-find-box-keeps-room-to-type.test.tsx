// @vitest-environment jsdom
import { createSchema, defineNode, Store, z } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { registerDefaultViews, Shell } from "../../src/index.js";

/**
 * THE FIND BOX KEEPS ROOM TO TYPE IN. With a talk of a hundred characters
 * focused, the trail's crumb took the bar and left the Find box 23px wide —
 * under one character of room — and Chromium commits text that arrives
 * without a key (an input method, dictation, Playwright's insertText) into
 * a field that narrow with the caret left at the start: "Плинов" was
 * written "вонилП" and found nothing. jsdom lays nothing out, so this holds
 * the two rules that keep the room; `the Find box asked in another script`
 * in scripts/verify-gauntlet.mjs holds the typing in a real browser.
 */
const LONG =
  "Über die Zuverlässigkeit verteilter Systeme: Erfahrungen aus a municipal water utility that grew faster than its database";
const talk = defineNode("talk", { fields: z.object({ label: z.string() }), plural: "Talks" });
const schema = createSchema([talk]);

const bar = () => {
  const store = new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "t1", kind: "talk", label: LONG }] as never, edges: [] } });
  const html = renderToStaticMarkup(
    <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, focusId: "t1", selection: ["t1"] }}>
      <Shell<typeof schema> scheme="light" onScheme={() => {}} />
    </GraviewProvider>,
  );
  return new DOMParser().parseFromString(html, "text/html");
};

describe("the Find box keeps room to type in", () => {
  it("has a floor at a desk, so no name on the bar squeezes it to a sliver", () => {
    const holder = bar().querySelector<HTMLElement>('[data-testid="find"]')!.parentElement!;
    const floor = holder.style.minWidth;
    expect(floor, "the Find box's place on the bar may shrink to nothing").not.toMatch(/^(0(px)?)?$/);
    expect(Number.parseFloat(floor), "a floor of at least a few characters, in rem").toBeGreaterThanOrEqual(5);
  });

  it("the focused record's crumb is capped and truncates, whole in its title", () => {
    const crumb = bar().querySelector<HTMLElement>('[data-testid="focused"]')!;
    expect(crumb.style.maxWidth, "a crumb as wide as its name takes the bar").not.toBe("");
    expect(crumb.getAttribute("title")).toBe(LONG);
    const name = crumb.querySelector<HTMLElement>("span")!;
    expect(name.textContent).toBe(LONG);
    expect(name.style.textOverflow).toBe("ellipsis");
    expect(name.style.overflow).toBe("hidden");
  });
});
