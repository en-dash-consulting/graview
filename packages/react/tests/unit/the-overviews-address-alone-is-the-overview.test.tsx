// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, UrlSync, useGraview, useNavigation } from "../../src/index.js";

/**
 * THE OVERVIEW'S ADDRESS ALONE IS THE OVERVIEW, ON A PAGE THAT KEEPS ITS
 * STOP IN THE FRAGMENT (FR-154): the whole-page Shell's `syncUrl`, and the
 * scene an embed draws under address routing. A fragment never reaches a
 * server, so `/places/overview` is what comes back from one — it opens at
 * altitude, and the overview at altitude is written without a fragment.
 * Anywhere else a bare address is the page's own default, as it was.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const store = new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "n1", kind: "note", label: "A note" }], edges: [] } });
const views = createViews(schema);

let go: ReturnType<typeof useNavigation>["go"] | undefined;
function Where() {
  const { view } = useGraview();
  go = useNavigation().go;
  return <pre data-testid="where">{view.overview ? "up" : (view.focusId ?? "nothing")}</pre>;
}

let host: HTMLDivElement;
let root: Root;
const where = () => host.querySelector('[data-testid="where"]')!.textContent;
const at = async (address: string) => {
  window.history.replaceState(null, "", address);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={views}>
        <UrlSync />
        <Where />
      </GraviewProvider>,
    ),
  );
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  window.history.replaceState(null, "", "/");
});

describe("the overview's address with no fragment", () => {
  it("opens at altitude and keeps the address bare", async () => {
    await at("/apps/a1/places/overview");
    expect(where()).toBe("up");
    expect(window.location.href.includes("#")).toBe(false);
  });

  it("opens at altitude when the fragment says nothing", async () => {
    await at("/places/overview#");
    expect(where()).toBe("up");
  });

  it("is respected when the fragment says where it stands", async () => {
    await at("/places/overview#focus=n1");
    expect(where()).toBe("n1");
    expect(window.location.hash).toBe("#focus=n1");
  });

  it("is where Back to the bare address lands: at altitude", async () => {
    await at("/places/overview");
    const up = window.history.length;
    await act(async () => go!({ focusId: "n1", relation: null, expanded: [], pins: {} }));
    expect(window.location.hash).toBe("#focus=n1");
    expect(window.history.length).toBe(up + 1);
    await act(async () => {
      const popped = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
      window.history.back();
      await popped;
    });
    expect(where()).toBe("up");
    expect(window.location.pathname).toBe("/places/overview");
    expect(window.location.href.includes("#")).toBe(false);
  });
});

describe("a bare address that is not the overview's", () => {
  it("opens on the page's own default, as it did", async () => {
    await at("/");
    expect(where()).toBe("nothing");
  });
});
