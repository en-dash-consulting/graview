// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW, withFocus } from "@graview/layout";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, UrlSync, useGraview } from "../../src/index.js";

/**
 * CHANGING THE SEAT IS NOT GOING SOMEWHERE.
 *
 * A page focused on a record its new seat may not see falls back to where
 * the app opens — the stop is resolved, not traveled to. Pushed, that
 * fallback put an entry in the history whose Back landed on the record's
 * address, which the seat cannot see, which fell back again: a Back that
 * went nowhere. A seat change replaces the stop it resolves.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const memo = defineNode("memo", { fields: z.object({ label: z.string() }), plural: "Memos" });
const schema = createSchema([note, memo]);

const store = () =>
  new Store({
    schema,
    mutations: [],
    policy: {
      grants: [],
      sees: [
        { roles: "*", kinds: ["note"] },
        { roles: ["staff"], kinds: ["memo"] },
      ],
    },
    snapshot: {
      nodes: [
        { id: "n1", kind: "note", label: "Open note" },
        { id: "m1", kind: "memo", label: "Staff memo" },
      ],
      edges: [],
    },
  });

const staff: Principal = { kind: "human", id: "sam", roles: ["staff"] };
const guest: Principal = { kind: "human", id: "gil", roles: ["guest"] };

function Where() {
  const { view } = useGraview();
  return <pre data-testid="where">{view.focusId ?? ""}</pre>;
}

let host: HTMLDivElement;
let root: Root;
const shared = store();
const views = createViews(schema);
const draw = (principal: Principal) =>
  root.render(
    <GraviewProvider store={shared} views={views} principal={principal} initialView={withFocus(EMPTY_VIEW, "m1")}>
      <UrlSync />
      <Where />
    </GraviewProvider>,
  );

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  window.history.replaceState(null, "", "/");
});

describe("a seat that cannot see the focused record", () => {
  it("resolves the stop in place: no history entry, and the address says where the page now is", async () => {
    await act(async () => draw(staff));
    expect(host.querySelector('[data-testid="where"]')!.textContent).toBe("m1");
    expect(window.location.hash).toContain("m1");
    const entries = window.history.length;

    await act(async () => draw(guest));
    const where = host.querySelector('[data-testid="where"]')!.textContent;
    expect(where).not.toBe("m1");
    expect(window.location.hash).not.toContain("m1");
    expect(window.history.length).toBe(entries);
  });

  it("still pushes a stop for travel the person makes after the seat changed", async () => {
    await act(async () => draw(staff));
    await act(async () => draw(guest));
    const entries = window.history.length;
    function Go() {
      const { setView } = useGraview();
      return <button data-testid="go" onClick={() => setView((stop) => withFocus(stop, "n1"))} />;
    }
    await act(async () =>
      root.render(
        <GraviewProvider store={shared} views={views} principal={guest} initialView={withFocus(EMPTY_VIEW, "m1")}>
          <UrlSync />
          <Where />
          <Go />
        </GraviewProvider>,
      ),
    );
    await act(async () => (host.querySelector('[data-testid="go"]') as HTMLButtonElement).click());
    expect(host.querySelector('[data-testid="where"]')!.textContent).toBe("n1");
    expect(window.history.length).toBe(entries + 1);
  });
});
