import { checkApp, Graph, Store } from "@graview/core";
import { awkwardApp, awkwardGraph } from "@graview/core/testing";
import { kindCardId } from "@graview/layout";
import { describe, expect, it } from "vitest";
import { deriveAffordances } from "../../src/index.js";

/**
 * WHAT A PERSON IS OFFERED, HELD TO PROPERTIES.
 *
 * The rule the framework promises in two skills — an empty kind card offers
 * its own beginnings — held for the examples and stopped one link along the
 * chain, and the only thing that would have caught it is asking the question
 * of a declaration built to have a chain. So it is asked of every shape, on
 * the graph nobody tests against: the empty one.
 */
const store = (options: Parameters<typeof awkwardApp>[0], per = 0) => {
  const app = awkwardApp(options);
  const snapshot = per > 0 ? awkwardGraph(app, per) : { nodes: [], edges: [] };
  return {
    app,
    store: new Store({
      schema: app.schema,
      mutations: app.mutations ?? [],
      snapshot: snapshot as never,
    }),
  };
};

const forKind = (at: Store<never>, kind: string) =>
  deriveAffordances(at as never, [kindCardId(kind)], { kindSelection: [kind] });

describe("a blank graph, for every declaration", () => {
  it("offers a way in wherever the chain says there is one", () => {
    for (const kinds of [1, 3, 8, 12]) {
      const { app, store: at } = store({ kinds, people: false });
      const root = (app.schema.kinds as readonly string[])[0]!;
      const offered = forKind(at as never, root).affordances.map((entry) => entry.mutation);
      expect(offered, `${kinds} kinds: the root offers nothing`).toContain(`add-${root}`);
    }
  });

  /*
   * AND SAYS SO WHERE THERE IS NOT. An act withheld because its picker would
   * be empty is not an act that does not exist, and the difference is the
   * whole onboarding of a blank graph: eight districts, one door, and no
   * explanation for the other seven.
   */
  it("withholds what cannot act yet, and explains every one of them", () => {
    const { app, store: at } = store({ kinds: 8, people: false });
    const kinds = app.schema.kinds as readonly string[];
    for (const kind of kinds.slice(1)) {
      const derived = forKind(at as never, kind);
      expect(derived.affordances.map((entry) => entry.mutation), kind).not.toContain(`add-${kind}`);
      expect(
        derived.observations.some((observation) => observation.id.startsWith("schema:waits:")),
        `${kind} offers nothing and says nothing`,
      ).toBe(true);
    }
  });

  it("opens the next door as each one is walked through", () => {
    const { app, store: at } = store({ kinds: 5, people: false }, 1);
    for (const kind of app.schema.kinds as readonly string[]) {
      const offered = forKind(at as never, kind).affordances.map((entry) => entry.mutation);
      expect(offered, `${kind} stays shut with the whole chain filled`).toContain(`add-${kind}`);
    }
  });

  it("never offers an act whose picker would be empty", () => {
    for (const kinds of [3, 8]) {
      const { app, store: at } = store({ kinds, people: false });
      for (const kind of app.schema.kinds as readonly string[]) {
        for (const affordance of forKind(at as never, kind).affordances) {
          for (const open of affordance.open) {
            if (open.optional === true || open.kinds === undefined) continue;
            expect(
              open.candidates?.length ?? 0,
              `${affordance.mutation} asks for a ${open.kinds.join("/")} and there are none`,
            ).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe("the checker, for every declaration", () => {
  it("finds no fault in a well-formed app of any shape", () => {
    for (const kinds of [1, 4, 10, 14]) {
      for (const people of [true, false]) {
        for (const plurals of ["short", "long"] as const) {
          const result = checkApp(awkwardApp({ kinds, people, plurals }));
          expect(
            result.findings.filter((finding) => finding.severity !== "note").map((finding) => finding.code),
            `${kinds} kinds, people=${people}, ${plurals}`,
          ).toEqual([]);
        }
      }
    }
  });

  it("says out loud what cannot arrive, and only when the app claims to make things", () => {
    const codes = (options: Parameters<typeof awkwardApp>[0]) =>
      checkApp(awkwardApp(options)).findings.map((finding) => finding.code);
    expect(codes({ kinds: 4, unreachable: true })).toContain("blank-graph-unreachable");
    expect(codes({ kinds: 4 })).not.toContain("blank-graph-unreachable");
  });

  it("parses every generated graph the schema it came from", () => {
    for (const kinds of [1, 6, 12]) {
      const app = awkwardApp({ kinds });
      expect(() => Graph.from(app.schema, awkwardGraph(app, 2) as never)).not.toThrow();
    }
  });
});
