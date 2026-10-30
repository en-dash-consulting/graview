// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineInvariant, defineMutation, defineNode, Store, z, type Policy, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, type ViewProps } from "@graview/react";
import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { preloadArrangeLists, registerDefaultViews } from "../../src/index.js";
import { barPanes } from "../../src/bar-panes-door.js";

/*
 * GOING INTO A DISTRICT ON A PHONE READS CLEAN (Nick, in Things' rules on a
 * phone: "looks reallllly rough"). Narrow, the stop is its head — the name,
 * the count, one line of what they are — then one line of problems that
 * filters, then the records; Find, Filter, Arrange and the kind's acts are
 * behind one "⋯". The author's "derived from the declaration" and "Keep as
 * a lens" reach only a seat that may change the app, and never a phone.
 */

const rule = defineNode("rule", {
  fields: z.object({ label: z.string(), kept: z.boolean() }),
  plural: "Rules",
  description: "Something every list and task is held to.",
});
const schema = createSchema([rule]);
type S = typeof schema;
const keepIt = defineMutation("keep-it", {
  title: "Keep it",
  subject: { kinds: ["rule"] },
  input: z.object({}),
  describe: () => "Keep it",
  apply() {},
} as never);
const holds = defineInvariant("it-holds", {
  label: "Nothing overdue",
  scope: { kind: "rule" },
  evaluate({ subject }: { subject: { id: string; label: string; kept: boolean } }) {
    return subject.kept ? [] : [{ invariant: "it-holds", subjectId: subject.id, label: subject.label, message: `${subject.label} is broken`, nodeIds: [subject.id], repairs: [] }];
  },
} as never);
/** A policy with a keeper who may do everything, and a member who may only keep a rule. */
const policy: Policy = {
  roles: ["keeper", "member"],
  grants: [
    { roles: ["keeper"], mutations: "*" },
    { roles: ["member"], mutations: ["keep-it"] },
  ],
} as Policy;
const keeper: Principal = { kind: "human", id: "k", roles: ["keeper"] };
const member: Principal = { kind: "human", id: "m", roles: ["member"] };

let host: HTMLDivElement;
let root: Root;
let width = 1200;
beforeAll(async () => {
  await preloadArrangeLists();
  await barPanes.load();
  await import("../../src/kind-stop.js");
});
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  // jsdom lays nothing out: the stop is as wide as the test says.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const w = this.getAttribute("data-testid") === "kind-stop" ? width : 0;
    return { x: 0, y: 0, left: 0, top: 0, right: w, bottom: 0, width: w, height: 0, toJSON: () => ({}) } as DOMRect;
  });
});
afterEach(async () => {
  await act(async () => root.render(null));
  host.remove();
  vi.restoreAllMocks();
});

async function goInto(principal: Principal, wide: number) {
  width = wide;
  const s = new Store<S>({
    schema,
    mutations: [keepIt as never],
    invariants: [holds as never],
    policy,
    snapshot: {
      nodes: [
        { id: "r1", kind: "rule", label: "A list is not a heap", kept: true },
        { id: "r2", kind: "rule", label: "Nothing done before what it waits for", kept: false },
        { id: "r3", kind: "rule", label: "Nothing overdue", kept: false },
      ] as never,
      edges: [],
    },
  });
  const views = registerDefaultViews(schema, createViews(schema));
  const Group = views.lookup("rule" as never, { cardinality: "many", fidelity: "full" }) as ComponentType<ViewProps<S>>;
  const nodes = s.graph.nodesOfKind("rule" as never);
  const flagged = s.violations().flatMap((violation) => violation.nodeIds);
  await act(async () => {
    root.render(
      <GraviewProvider store={s} views={views} principal={principal} initialView={{ ...EMPTY_VIEW, focusId: "aggregate:rule" }}>
        <Group nodes={nodes as never} label="Rules" cardinality="many" fidelity="full" mode="scene" selected={false} focused flagged={flagged} />
      </GraviewProvider>,
    );
  });
  for (let tick = 0; tick < 5 && !host.querySelector('[data-testid="kind-stop"]'); tick++) await act(async () => new Promise((done) => setTimeout(done, 10)));
}
const q = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe("a district gone into on a phone reads content first", () => {
  it("says its name, count and purpose, one line of problems, and then every record, with its tools behind one control", async () => {
    await goInto(keeper, 360);
    const stop = q("kind-stop")!;
    expect(stop.hasAttribute("data-graview-narrow")).toBe(true);
    expect(q("kind-stop-count")?.textContent).toBe("3 rules · Something every list and task is held to.");
    // The tools are behind the one control, shut: no Filter, Arrange or Find, no standalone "Acts…".
    expect(q("kind-arrange")).toBeNull();
    expect(q("kind-stop-acts")).toBeNull();
    expect(q("kind-stop-tools-open")?.getAttribute("aria-expanded")).toBe("false");
    // Problems are one line, naming the rules, with one press that filters.
    const problems = q("kind-stop-problems")!;
    expect(problems.textContent).toContain("2 problems");
    expect(problems.textContent).toContain("Nothing overdue");
    expect(problems.querySelector("[aria-expanded]")).toBeNull();
    expect(q("kind-stop-only-problems")?.textContent).toBe("Show");
    // Every record it counts is a row.
    expect(host.querySelectorAll('[data-testid="kind-stop-table"] tbody tr')).toHaveLength(3);
    // Opened, the one control holds Find, Filter, Arrange and the kind's acts.
    await act(async () => q("kind-stop-tools-open")!.click());
    expect(q("kind-stop-tools")?.querySelector('[data-testid="kind-stop-acts"]')?.textContent).toBe("Acts…");
    // "Show" keeps the two with a problem, and says how to have them all back.
    await act(async () => q("kind-stop-only-problems")!.click());
    expect(host.querySelectorAll('[data-testid="kind-stop-table"] tbody tr')).toHaveLength(2);
    expect(q("kind-stop-only-problems")?.textContent).toBe("Show all");
  });

  it("tells no reader on a phone of the declaration, not even the one who may change it", async () => {
    await goInto(keeper, 360);
    expect(host.textContent).not.toMatch(/derived from the declaration/i);
    expect(q("kind-stop-keep")).toBeNull();
  });

  it("tells the declaration only to a seat that may change the app, at a desk", async () => {
    await goInto(keeper, 1200);
    expect(q("kind-stop")?.hasAttribute("data-graview-narrow")).toBe(false);
    expect(q("kind-stop-derived")?.textContent).toMatch(/derived from the declaration/);
    expect(q("kind-stop-keep")?.textContent).toBe("Keep as a lens");
    await act(async () => root.render(null));
    root = createRoot(host);
    await goInto(member, 1200);
    expect(host.textContent).not.toMatch(/derived from the declaration/i);
    expect(q("kind-stop-keep")).toBeNull();
  });
});
