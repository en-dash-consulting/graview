// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../../src/domain/chapters.js";
import { seedbedDesign } from "../../src/ui/design.js";

/**
 * THE KEYBOARD COMES BACK TO THE ACT, on the design a reader copies.
 *
 * A design's act is a button that opens its form in place and closes it
 * when it is done — and closing unmounts the form, which takes focus to
 * <body> with it. So an act taken from the keyboard on the routed face's
 * product design ended at the top of the document, the way the scene's
 * strip once did (W-053) and the in-place editor did (W-070). The button
 * that opened the form never left; it is where the keyboard belongs.
 */
describe("an act on the design", () => {
  it("puts the keyboard back on the button that opened its form", async () => {
    const chapter = CHAPTERS[12]!;
    const store = new Store({
      schema: chapter.app.schema,
      mutations: chapter.app.mutations ?? [],
      invariants: chapter.app.invariants ?? [],
      snapshot: chapter.seed as never,
      ...(chapter.app.policy ? { policy: chapter.app.policy } : {}),
      ...(chapter.app.modules ? { modules: chapter.app.modules } : {}),
      ...(chapter.principal ? { principal: chapter.principal } : {}),
    } as never);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <PagesApp
          context={{ store, principal: chapter.principal } as never}
          registry={seedbedDesign(store.schema) as never}
          initialPath="/gardeners/june"
        />,
      );
    });
    // June may take on a plot: the act from her end, with a plot to choose.
    const button = [...host.querySelectorAll<HTMLButtonElement>('[data-testid="record-actions"] button')].find((b) => b.textContent?.trim() === "Take on a plot");
    expect(button, "the act is offered from her end").toBeDefined();
    await act(async () => {
      button!.focus();
      button!.click();
    });
    const form = host.querySelector<HTMLFormElement>('[data-testid="record-actions"] form');
    expect(form, "pressing it opens the form in place").not.toBeNull();
    const picker = form!.querySelector<HTMLSelectElement>("select");
    expect(picker).not.toBeNull();
    const option = [...picker!.options].find((o) => o.value !== "");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(picker!, option!.value);
      picker!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(host.querySelector('[data-testid="refused"]')?.textContent ?? "", "no refusal").toBe("");
    expect(store.log.all().length, "the act applied").toBeGreaterThan(0);
    expect(host.querySelector('[data-testid="record-actions"] form'), "the form closed").toBeNull();
    /*
     * June has taken on the last plot, so the act is no longer offered and
     * its button is gone: the keyboard lands on the heading the acts stood
     * under, never on <body>.
     */
    expect(document.activeElement, "the keyboard is not on the document").not.toBe(document.body);
    expect(document.activeElement?.textContent?.trim(), "the keyboard is where the acts were").toBe("Their plots");
    await act(async () => root.unmount());
  });
});
