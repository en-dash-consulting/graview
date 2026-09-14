// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, aggregateId, fromUrl, toUrl } from "@graview/layout";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, UrlSync, useGraview, type ViewProps } from "../../src/index.js";

/**
 * A PAGE CAN LINK TO A PICTURE, NOT ONLY TO THE SCENE.
 *
 * Every stop in the scene is a URL, and which group view is showing is part
 * of where you are — the map, the regimen, the week are three answers about
 * the same city. The long form says the group and the picture
 * (`focus=aggregate:zone&in.view=grounds-map`), which a page cannot write
 * without knowing how the layout spells an aggregate id.
 *
 * So a stop may name the place alone. The registry knows which group each
 * named place is a picture of, and adoption fills the focus in — which makes
 * `sceneHref + "#view=grounds-map"` a link every page can make, landing on
 * the map rather than on the default view with a note to press a button.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([zone, task]);

const Map_ = ({ label }: ViewProps<typeof schema>) => <p data-testid="map">{label}</p>;
const List = ({ label }: ViewProps<typeof schema>) => <p data-testid="list">{label}</p>;

const views = () =>
  createViews(schema)
    .register("zone", { cardinality: "many", fidelity: "full" }, Map_, { title: "The grounds" })
    .register("zone", { cardinality: "many", fidelity: "summary" }, Map_, { title: "The grounds" })
    .register("task", { cardinality: "many", fidelity: "full" }, List, { title: "The week" })
    .register("task", { cardinality: "many", fidelity: "summary" }, List, { title: "The week" });

const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: { nodes: [{ id: "lawn", kind: "zone", label: "Back Lawn" }], edges: [] },
  });

function Where() {
  const { view } = useGraview();
  return <pre data-testid="where">{JSON.stringify({ focusId: view.focusId, within: view.within })}</pre>;
}

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  host.remove();
  window.history.replaceState(null, "", "/");
});

const land = async (hash: string) => {
  window.history.replaceState(null, "", hash);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
        <UrlSync />
        <Where />
      </GraviewProvider>,
    );
  });
  const where = JSON.parse(host.querySelector('[data-testid="where"]')!.textContent!);
  await act(async () => root.unmount());
  return where as { focusId: string | null; within?: Record<string, string> };
};

describe("a fragment that names a place", () => {
  it("is read as the picture that place is, in short or in full", () => {
    expect(fromUrl("#view=the-grounds").within).toEqual({ view: "the-grounds" });
    expect(fromUrl("#in.view=the-grounds").within).toEqual({ view: "the-grounds" });
    /* The long form is what the scene mints, so it wins when both are said. */
    expect(fromUrl("#view=the-week&in.view=the-grounds").within).toEqual({ view: "the-grounds" });
  });

  it("opens the scene on that view, with the group it is a picture of in focus", async () => {
    const where = await land("#view=the-grounds");
    expect(where.focusId).toBe(aggregateId("zone"));
    expect(where.within).toEqual({ view: "the-grounds" });
  });

  it("names the other picture's group when the other picture is asked for", async () => {
    const where = await land("#view=the-week");
    expect(where.focusId).toBe(aggregateId("task"));
  });

  it("leaves a stop that already says where it is alone", async () => {
    const where = await land(`#focus=${aggregateId("task")}&in.view=the-grounds`);
    expect(where.focusId).toBe(aggregateId("task"));
  });

  it("says nothing about a place nothing was registered under", async () => {
    const where = await land("#view=a-picture-that-was-renamed");
    /* Not a crash and not a lie: the stop keeps what it said and lands home. */
    expect(where.focusId).toBeNull();
  });

  it("writes the picture back into the address in the form the scene mints", async () => {
    expect(toUrl({ ...EMPTY_VIEW, focusId: aggregateId("zone"), within: { view: "the-grounds" } })).toBe(
      "#focus=aggregate%3Azone&in.view=the-grounds",
    );
  });
});
