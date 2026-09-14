// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, aggregateId } from "@graview/layout";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, ResolvedView, Scene, type ViewProps } from "../../src/index.js";

/**
 * A VIEW THAT THROWS DOES NOT TAKE THE SCENE WITH IT.
 *
 * A binding error in an app-authored lens used to produce a black page: no
 * bar, no districts, no way back, because one thrown render unmounts the
 * whole tree. "Fail loudly on a bad binding" is right and the panel is where
 * loud belongs — the rest of the city stays standing while one district says
 * what went wrong.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([zone, task]);

class BindingError extends Error {
  readonly hint = "Bind `area` to a declared field.";
  constructor() {
    super("The grounds map is bound to a field no kind declares: area.");
    this.name = "BindingError";
  }
}

function ThrowingMap(_props: ViewProps<typeof schema>) {
  throw new BindingError();
}
function Tasks({ nodes, label }: ViewProps<typeof schema>) {
  return (
    <section data-testid="tasks">
      <h3>{label}</h3>
      <p>{nodes?.length ?? 0} tasks</p>
    </section>
  );
}

const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "lawn", kind: "zone", label: "Back Lawn" },
        { id: "t1", kind: "task", label: "Mow" },
      ],
      edges: [],
    },
  });

const views = () =>
  createViews(schema)
    .register("zone", { cardinality: "many", fidelity: "full" }, ThrowingMap, { title: "The grounds" })
    .register("zone", { cardinality: "many", fidelity: "summary" }, ThrowingMap, { title: "The grounds" })
    .register("zone", { cardinality: "many", fidelity: "glyph" }, ThrowingMap, { title: "The grounds" })
    .register("task", { cardinality: "many", fidelity: "full" }, Tasks)
    .register("task", { cardinality: "many", fidelity: "summary" }, Tasks)
    .register("task", { cardinality: "many", fidelity: "glyph" }, Tasks);

let host: HTMLDivElement;
let quiet: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  /* The boundary reports to the console on purpose; the test asserts it did. */
  quiet = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  quiet.mockRestore();
  host.remove();
});

describe("a view that throws", () => {
  it("renders the error in its own place, naming the kind and the view", async () => {
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
          <ResolvedView
            node={{
              id: aggregateId("zone"),
              kind: "zone",
              plane: 0,
              x: 0,
              y: 0,
              width: 600,
              height: 400,
              pinned: false,
              aggregate: { kind: "zone", memberIds: ["lawn"], label: "Zones" },
            }}
            mode="scene"
            selected={false}
            fidelity="full"
          />
        </GraviewProvider>,
      );
    });

    const panel = host.querySelector("[data-graview-view-error]");
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain("The grounds");
    expect(panel?.textContent).toContain("bound to a field no kind declares");
    /* The hint the lens skill teaches throwing is the panel's second half. */
    expect(panel?.textContent).toContain("Bind `area` to a declared field.");
    expect(quiet).toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("leaves the rest of the scene mounted and interactive", async () => {
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
          <Scene />
        </GraviewProvider>,
      );
    });

    /* The stage and its view hosts are still mounted around the failure. */
    expect(host.querySelector("[data-graview-view-error]")).not.toBeNull();
    expect(host.querySelector("[data-graview-stage]")).not.toBeNull();
    expect(host.querySelectorAll("[data-graview-view]").length).toBeGreaterThan(1);
    /* The other district drew its own picture rather than going down with it. */
    expect(host.textContent).toContain("Tasks");
    await act(async () => root.unmount());
  });
});
