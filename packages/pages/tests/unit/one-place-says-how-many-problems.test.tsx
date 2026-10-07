import { bindSchema, createSchema, defineNode, Store, type Violation } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";

/**
 * ONE PLACE SAYS HOW MANY PROBLEMS THERE ARE (FR-122).
 *
 * Cloud's vendor template on a phone said "3 problems" on the embed's bar,
 * "Problems 3" in the page's tabs and "3 problems — see what is broken"
 * under the home's headline. The count is said once: by the bar above the
 * face when there is one (`standingAbove`), else by the shell's Problems
 * tab. The home says what to do about it, never the number.
 */
const duty = defineNode("duty", { fields: z.object({ label: z.string(), minutes: z.number() }), plural: "Duties" });
const schema = createSchema([duty]);
const bound = bindSchema(schema);
const tooLong = bound.defineInvariant("too-long", {
  scope: { kind: "duty" },
  evaluate: ({ subject }): Violation[] =>
    subject.minutes > 60 ? [{ invariant: "too-long", subjectId: subject.id, label: "Too long", message: `${subject.label} runs over an hour`, nodeIds: [subject.id], repairs: [] }] : [],
});
const store = () =>
  new Store({
    schema,
    mutations: [],
    invariants: [tooLong],
    snapshot: {
      nodes: [
        { id: "a", kind: "duty", label: "School run", minutes: 75 },
        { id: "b", kind: "duty", label: "Shop", minutes: 90 },
        { id: "c", kind: "duty", label: "Laundry", minutes: 120 },
      ] as never,
      edges: [],
    },
  });

/** Every place the page says the number 3 about the problems: a text that names them, or the count on the way to them. */
const saidCount = (html: string) => {
  const tab = [...html.matchAll(/<a [^>]*href="\/problems"[^>]*>(.*?)<\/a>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, " "));
  const elsewhere = html.replace(/<a [^>]*href="\/problems"[^>]*>.*?<\/a>/g, "").replace(/<[^>]+>/g, " ");
  return tab.filter((text) => /(^|\D)3(\D|$)/.test(text)).length + [...elsewhere.matchAll(/(^|\D)3 problems/g)].length;
};

describe("one place says how many problems there are (FR-122)", () => {
  it("says the count once on a standalone face's home: in the Problems tab, and the home points to them without it", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store: store() }} initialPath="/" />);
    expect(saidCount(html)).toBe(1);
    expect(html).toContain('data-testid="problems-count"');
    expect(html).toContain("Rules are broken — see what, and what would fix it");
  });

  it("leaves the count to the bar above an embedded face: the tab names the page, and the home says what to do", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store: store(), embedded: true, standingAbove: true }} initialPath="/" />);
    expect(saidCount(html)).toBe(0);
    expect(html).not.toContain('data-testid="problems-count"');
    // The way to the problems is still a tab, and still a link from the home.
    expect([...html.matchAll(/href="\/problems"/g)].length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Rules are broken — see what, and what would fix it");
  });

  it("says one broken rule in the singular, without a number", () => {
    const one = new Store({ schema, mutations: [], invariants: [tooLong], snapshot: { nodes: [{ id: "a", kind: "duty", label: "School run", minutes: 75 }] as never, edges: [] } });
    const html = renderToStaticMarkup(<PagesApp context={{ store: one, standingAbove: true }} initialPath="/" />);
    expect(html).toContain("A rule is broken — see what, and what would fix it");
    expect(html).not.toMatch(/1 problem/);
  });
});
