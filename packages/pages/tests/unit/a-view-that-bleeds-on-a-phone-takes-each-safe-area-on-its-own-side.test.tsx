// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, markBleeds, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { PagesApp } from "../../src/index.js";

/**
 * A VIEW THAT BLEEDS ON A PHONE TAKES EACH SAFE AREA ON ITS OWN SIDE
 * (Roadmap f-bleed-phone-rule-rtl). The phone's rule for `bleed: true` said
 * its margins as `margin-inline`, the left inset first: in a page that reads
 * right to left the start is the right, so the left inset was kept on the
 * right. The insets are the device's, not the text's, so each margin is
 * named for its side, as `bleed: "full"`'s are. jsdom lays nothing out, so
 * this holds the rule the page emits; `verify-address` measures it at phone
 * width in both directions (aViewThatBleedsOnAPhoneKeepsEachSafeAreaOnItsSideInEitherDirection).
 */
const store = () => new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
const drawing = markBleeds((() => <p>drawn</p>) as unknown as ViewComponent<AnySchema>);

async function phoneRule(): Promise<string> {
  const registry = registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema));
  registry.home?.(drawing);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: registry as never, principal: nick }} initialPath="/" />));
  const rule = host.querySelector('[data-graview-bleed=""] > style')?.textContent ?? "";
  await act(async () => root.unmount());
  host.remove();
  return rule;
}

describe("a view that bleeds on a phone takes each safe area on its own side", () => {
  it("the left inset on the left and the right inset on the right, whichever way the page reads", async () => {
    const rule = await phoneRule();
    expect(rule).toContain("@media (max-width:680px)");
    expect(rule).toMatch(/margin-left:min\(0px,calc\(env\(safe-area-inset-left,0px\) - var\(--graview-gutter,20px\)\)\)/);
    expect(rule).toMatch(/margin-right:min\(0px,calc\(env\(safe-area-inset-right,0px\) - var\(--graview-gutter,20px\)\)\)/);
    expect(rule).not.toContain("margin-inline");
  });
});
