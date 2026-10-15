// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { toUrl } from "@graview/layout/view";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, useGoTo, useGraview, type GoTo } from "../../src/index.js";

/**
 * ON THE SCENE, A FILTERED LIST IS THE KIND'S STOP NARROWED THE SAME WAY.
 * A view's `navigate({ place: "features", where: { stage: "building" } })`
 * goes to the kind's district with `in.filter=stage:building` — the word
 * the stop's arranging line reads, as a page reads `?filter=` — and a lens
 * to its picture narrowed the same way. A destination gone to without a
 * filter is not narrowed by the last one.
 */
const feature = defineNode("feature", { fields: z.object({ label: z.string(), stage: z.enum(["idea", "building"]) }), plural: "Features" });
const schema = createSchema([feature]);
const store = new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "f1", kind: "feature", label: "Billing", stage: "building" }], edges: [] } });
const views = createViews(schema);
views.register("feature", { cardinality: "many", fidelity: "full" }, () => null, { title: "The board", hidden: true });

let goTo: GoTo | undefined;
let fragment = "";
function Where() {
  const { view } = useGraview();
  goTo = useGoTo();
  fragment = toUrl(view).replace(/^#/, "");
  return null;
}

describe("going somewhere narrowed, on the scene", () => {
  it("goes to the kind's stop narrowed, to a lens narrowed, and leaves an unnarrowed one unnarrowed", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={views}>
          <Where />
        </GraviewProvider>,
      ),
    );
    await act(async () => goTo!.list("feature", { filter: "stage:building" }));
    expect(new URLSearchParams(fragment).get("focus")).toBe("aggregate:feature");
    expect(new URLSearchParams(fragment).get("in.filter")).toBe("stage:building");
    // A lens kept off the lists is a stop all the same, narrowed as asked.
    await act(async () => goTo!.place("the-board", { filter: "stage:idea" }));
    expect(new URLSearchParams(fragment).get("in.filter")).toBe("stage:idea");
    expect(fragment).toMatch(/view=the-board/);
    await act(async () => goTo!.list("feature"));
    expect(new URLSearchParams(fragment).get("in.filter")).toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });
});
