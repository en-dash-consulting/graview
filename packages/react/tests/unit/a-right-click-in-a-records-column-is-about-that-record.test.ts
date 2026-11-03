// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { holderFrom } from "../../src/picked.js";

/*
 * A RIGHT-CLICK BESIDE THE TARGETS (Roadmap f-make-any-page-better): in a
 * list's column, between its tasks, the menu is about that list; below the
 * columns, where several lists stand side by side, it is about no one list.
 */
function lists(): { host: HTMLElement; gap: Element; below: Element } {
  const host = document.createElement("div");
  host.innerHTML = `
    <div class="grid">
      <section id="someday"><div data-graview-pick="l-someday">Someday</div><div class="gap"></div><div data-graview-pick="t-piano">Pianos</div></section>
      <section id="week"><div data-graview-pick="l-week">This week</div><div data-graview-pick="t-post">Post</div></section>
    </div>
    <div class="below"></div>`;
  document.body.appendChild(host);
  return { host, gap: host.querySelector(".gap")!, below: host.querySelector(".below")! };
}
const holds: Record<string, readonly string[]> = { "l-someday": ["t-piano"], "l-week": ["t-post"] };
const linked = (from: string, to: string) => (holds[from] ?? []).includes(to) || (holds[to] ?? []).includes(from);

describe("a right-click beside the targets", () => {
  it("is about the list whose column it is in", () => {
    const { host, gap } = lists();
    expect(holderFrom(gap, host, linked, "aggregate:list")).toBe("l-someday");
  });

  it("is about no one list where several stand side by side", () => {
    const { host, below } = lists();
    expect(holderFrom(below, host, linked, "aggregate:list")).toBeNull();
  });
});
