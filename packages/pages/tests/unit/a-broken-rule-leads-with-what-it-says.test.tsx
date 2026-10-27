// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { fetchDeclaredLenses, fetchHomeView } from "@graview/primitives";
import { act } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { rendered } from "./the-review.js";

/**
 * A BROKEN RULE LEADS WITH WHAT IT SAYS. On a record's page, a rule's box
 * read "number of blocks with phase = now 2 ≠ 0" under its title, and the
 * sentence the rule's author wrote in `says` was only a tooltip. The
 * sentence leads; the shape it was judged by is a detail, one press away.
 */
beforeAll(() => Promise.all([fetchDeclaredLenses(), fetchHomeView()]));

describe("a broken rule leads with what it says", () => {
  it("says the rule's own sentence first, its title under it, and keeps the expression as a disclosed detail", async () => {
    const { host, done } = await rendered("/findings/f1");
    // The words the rule's shape is drawn in arrive when a problem is drawn.
    await act(async () => new Promise((ready) => setTimeout(ready, 200)));
    const box = host.querySelector('[data-testid="record-violations"] [data-testid="problem-line"]')!;
    expect(box).not.toBeNull();
    const first = box.firstElementChild!;
    expect(first.getAttribute("data-testid")).toBe("problem-says");
    expect(first.textContent).toBe("The headline inside a nested group is drawn at the page title's size is still planned for now: move it to later or fix it.");
    expect(box.textContent).toContain("Nothing is left for now");
    const judged = box.querySelector<HTMLDetailsElement>('details[data-testid="problem-judged"]');
    expect(judged?.open).toBe(false);
    expect(judged?.querySelector("[data-graview-rule-line]")).not.toBeNull();
    await done();
  });

  it("stands in a box with one hairline all round and the warning tint, never a thick border on one side (FR-236)", async () => {
    const { host, done } = await rendered("/findings/f1");
    await act(async () => new Promise((ready) => setTimeout(ready, 200)));
    const box = host.querySelector<HTMLElement>('[data-testid="record-violations"]')!;
    const style = box.getAttribute("style") ?? "";
    expect(style).toMatch(/(^|; )border: 1px solid var\(--graview-edge\);/);
    expect(style).not.toMatch(/border-(left|right|top|bottom)/);
    expect(box.style.background).toBe("var(--graview-panel-warning)");
    expect(box.style.borderRadius).toBe("var(--graview-radius, 12px)");
    await done();
  });
});
