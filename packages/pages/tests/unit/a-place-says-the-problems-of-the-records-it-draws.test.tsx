// @vitest-environment jsdom
import { bindSchema, createSchema, defineNode, Store, type PagesArrangement, type Violation } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { registerDefaultViews } from "@graview/primitives";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A PLACE SAYS THE PROBLEMS OF THE RECORDS IT DRAWS (Roadmap
 * f-problems-in-context). Threat Watch's home said "Rules are broken — see
 * what, and what would fix it" in the warning color for a rule broken on a
 * record the home does not draw. The home says a problem only of a record
 * it draws; a custom home is handed the broken records (`flagged`) to mark
 * where it draws them, and the page says nothing over it; the bar keeps its
 * count, which opens the full list; a rule the app wrote is said in the
 * quiet ink, a rule that could not be judged in the warning color; and the
 * list that draws the broken record marks it there. The markup is the same
 * on a phone and a desk: only the width it is laid out in differs.
 */
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Duties" });
const errand = defineNode("errand", { fields: z.object({ label: z.string(), minutes: z.number() }), plural: "Errands" });
const schema = createSchema([duty, errand]);
const bound = bindSchema(schema);
const tooLong = bound.defineInvariant("too-long", {
  scope: { kind: "errand" },
  evaluate: ({ subject }): Violation[] =>
    subject.minutes > 60 ? [{ invariant: "too-long", subjectId: subject.id, label: "Too long", message: `${subject.label} runs over an hour`, nodeIds: [subject.id], repairs: [] }] : [],
});
const cannotJudge = bound.defineInvariant("cannot-judge", {
  scope: { kind: "errand" },
  evaluate: ({ subject }): Violation[] => {
    if (subject.minutes > 100) throw new Error("it adds a word to a number");
    return [];
  },
});
const store = (minutes = 90, judged = [tooLong]) =>
  new Store({
    schema,
    mutations: [],
    invariants: judged,
    snapshot: {
      nodes: [
        { id: "d1", kind: "duty", label: "School run" },
        { id: "d2", kind: "duty", label: "Laundry" },
        { id: "e1", kind: "errand", label: "Post office", minutes },
      ] as never,
      edges: [],
    },
  });
const views = (pages?: PagesArrangement, home?: ViewComponent<typeof schema>) => {
  const registry = registerDefaultViews(schema, createViews(schema));
  if (pages) registry.arrange?.(pages);
  if (home) registry.home?.(home);
  return registry;
};
const draw = (path: string, context: Partial<PageContext<typeof schema>>) => renderToStaticMarkup(<PagesApp context={{ store: store(), ...context } as PageContext<typeof schema>} initialPath={path} />);
const BANNER = /(A rule is|Rules are) broken — see what/;

describe("a home whose records break no rule, while a kind it leaves off does", () => {
  it("says nothing of the problem, nor that all rules hold, and the bar keeps its count", () => {
    const html = draw("/", { views: views({ hide: ["errand"] }) });
    expect(html).not.toMatch(BANNER);
    expect(html).not.toContain('data-testid="problems-here"');
    expect(html).not.toContain("All rules hold");
    expect(html).toContain('data-testid="standing-link"');
    expect(html).toMatch(/aria-label="1 rule broken/);
  });

  it("is a custom home that is handed the broken records to mark, with nothing said over it", () => {
    let handed: readonly string[] | undefined = ["unset"];
    const Home: ViewComponent<typeof schema> = ({ flagged }) => {
      handed = flagged;
      return <p data-testid="our-home">Our duties</p>;
    };
    const html = draw("/", { views: views({ hide: ["errand"] }, Home) });
    expect(html).toContain('data-testid="our-home"');
    expect(html).not.toMatch(BANNER);
    expect(handed).toEqual(["e1"]);
    expect(html).toMatch(/aria-label="1 rule broken/);
  });

  it("is a custom home with nothing broken anywhere, which is handed nothing to mark", () => {
    let handed: readonly string[] | undefined = ["unset"];
    const Home: ViewComponent<typeof schema> = ({ flagged }) => {
      handed = flagged;
      return <p>Our duties</p>;
    };
    renderToStaticMarkup(<PagesApp context={{ store: store(30), views: views(undefined, Home) } as PageContext<typeof schema>} initialPath="/" />);
    expect(handed).toBeUndefined();
  });
});

describe("a home that draws the broken record", () => {
  it("points to the problem, in the quiet ink, since the rule is the app's own", () => {
    const html = draw("/", { views: views() });
    expect(html).toMatch(/data-testid="problems-here" data-graview-problems-tone="rule"[^>]*color:var\(--graview-ink-muted\)[^>]*>A rule is broken — see what, and what would fix it/);
  });

  it("says a rule that could not be judged in the warning color", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store: store(120, [cannotJudge]), views: views() } as PageContext<typeof schema>} initialPath="/" />);
    expect(html).toMatch(/data-testid="problems-here" data-graview-problems-tone="error"[^>]*color:var\(--graview-warn\)/);
  });
});

describe("the list that draws the broken record", () => {
  it("marks it on its row, though the home leaves its kind off", () => {
    const html = draw("/errands", { views: views({ hide: ["errand"] }) });
    const page = new DOMParser().parseFromString(html, "text/html");
    const row = [...page.querySelectorAll("a.graview-row-title")].find((one) => one.textContent?.includes("Post office"))!;
    expect(row.textContent).toContain("⚠");
  });
});
