import { bindSchema, createSchema, defineNode, Store, type Violation } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";

/**
 * THE PROBLEMS NARROW TO ONE KIND. A district's "⚠ n" beside its name at
 * the City opened every problem of the app, and on a rich app the ones it
 * counted were lost among the rest. `/problems?kind=<kind>` is the problems
 * that name one of that kind's records — as many as the chip counts — and
 * the rules about the kind, with the way to every problem beside them.
 */
const duty = defineNode("duty", { fields: z.object({ label: z.string(), minutes: z.number() }), plural: "Duties" });
const room = defineNode("room", { fields: z.object({ label: z.string(), size: z.number() }), plural: "Rooms" });
const schema = createSchema([duty, room]);
const bound = bindSchema(schema);
const tooLong = bound.defineInvariant("too-long", {
  label: "A duty takes an hour at most",
  scope: { kind: "duty" },
  evaluate: ({ subject }): Violation[] =>
    subject.minutes > 60 ? [{ invariant: "too-long", subjectId: subject.id, label: "Too long", message: `${subject.label} runs over an hour`, nodeIds: [subject.id], repairs: [] }] : [],
});
const tooSmall = bound.defineInvariant("too-small", {
  label: "A room is big enough",
  scope: { kind: "room" },
  evaluate: ({ subject }): Violation[] =>
    subject.size < 10 ? [{ invariant: "too-small", subjectId: subject.id, label: "Too small", message: `${subject.label} is too small`, nodeIds: [subject.id], repairs: [] }] : [],
});
const store = () =>
  new Store({
    schema,
    mutations: [],
    invariants: [tooLong, tooSmall],
    snapshot: {
      nodes: [
        { id: "a", kind: "duty", label: "School run", minutes: 75 },
        { id: "b", kind: "duty", label: "Shop", minutes: 90 },
        { id: "r", kind: "room", label: "Box room", size: 6 },
      ] as never,
      edges: [],
    },
  });

describe("the problems narrow to one kind", () => {
  it("lists only the problems that name a record of the kind, and the rules about it", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store: store() }} initialPath="/problems?kind=duty" />);
    expect(html).toContain('data-graview-problems-of="duty"');
    expect(html).toContain("What is broken in duties");
    expect(html).toContain("School run runs over an hour");
    expect(html).toContain("Shop runs over an hour");
    expect(html).not.toContain("Box room is too small");
    expect(html).toContain('data-graview-rule="too-long"');
    expect(html).not.toContain('data-graview-rule="too-small"');
    // The way to every problem, counted.
    expect(html).toMatch(/data-testid="problems-every"[^>]*>See every problem \(3\)/);
  });

  it("is every problem with no kind, or with a kind the app does not have", () => {
    for (const path of ["/problems", "/problems?kind=nothing"]) {
      const html = renderToStaticMarkup(<PagesApp context={{ store: store() }} initialPath={path} />);
      expect(html, path).not.toContain("data-graview-problems-of");
      expect(html, path).toContain("Box room is too small");
      expect(html, path).toContain("Shop runs over an hour");
      expect(html, path).not.toContain('data-testid="problems-every"');
    }
  });
});
