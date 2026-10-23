// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { sam, threatApp, threatSeed } from "../../../../scripts/fixtures/threat-app.js";
import { auditView } from "../../src/audit/index.js";
import { clickedOf, keepClicked } from "../../src/host/clicked.js";
import { createGuestHost } from "../../src/host/session.js";
import { createViewRuntime } from "../../src/worker/view-global.js";

/*
 * AN AUDIT OF THE PAGE LEARNS WHAT THE VIEW HEARS A CLICK ON (0.1.48). A
 * view's `graview.on("click", ".more", …)` makes a <div class="more"> a
 * thing a person clicks, which the keyboard must reach; a headless run knew
 * it (the runtime's `listened`), but the live host did not, so an audit of a
 * page had to be handed `clicked` by whoever ran it, and one that was not
 * passed a click-only <div> as plain words. The runtime now tells the host
 * where it hears a click, whenever that moves; the host keeps it on the
 * region; and `auditView` reads it there when it is not handed `clicked`.
 */

function runtime() {
  const sent: { type: string; [key: string]: unknown }[] = [];
  const made = createViewRuntime({
    send: (request) => sent.push(request as never),
    act: () => Promise.resolve({ type: "answer", id: 1, ok: true, intent: "" }),
    navigate: () => {},
    microtask: (task) => queueMicrotask(task),
    now: () => 0,
    threw: (error) => {
      throw error;
    },
    warn: () => {},
    hardening: () => ({ removed: [], stuck: [], sealed: false }),
  });
  return { ...made, sent };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const store = () => new Store<AnySchema>({ schema: threatApp.schema, mutations: (threatApp.mutations ?? []) as never, policy: threatApp.policy!, snapshot: structuredClone(threatSeed) as never });

describe("the view's runtime", () => {
  it("tells the host every selector it hears a click on, once a change, and again when one is let go", async () => {
    const view = runtime();
    view.view.on("click", ".more", () => {});
    const off = view.view.on("click", "[data-only-critical]", () => {});
    view.view.on("click", ".more", () => {});
    view.view.on("input", "input", () => {});
    await settle();
    expect(view.sent.filter((one) => one.type === "clicks")).toEqual([{ type: "clicks", selectors: [".more", "[data-only-critical]"] }]);
    off();
    await settle();
    expect(view.sent.filter((one) => one.type === "clicks").at(-1)).toEqual({ type: "clicks", selectors: [".more"] });
  });
});

describe("the session", () => {
  it("hands on what a view hears a click on, its own nonce only, and only strings", () => {
    const said: (readonly string[])[] = [];
    const session = createGuestHost({ store: store(), principal: sam, view: "watch", nonce: "n", send: () => {}, props: () => ({ view: "watch", edges: [], acts: [] }), onClicks: (selectors) => said.push(selectors) });
    session.receive({ type: "clicks", nonce: "n", selectors: [".more", 7, "x".repeat(600)] });
    session.receive({ type: "clicks", nonce: "wrong", selectors: ["p"] });
    expect(said).toEqual([[".more"]]);
  });
});

describe("an audit of a page", () => {
  const drawn = () => {
    const region = document.createElement("div");
    document.body.append(region);
    const shadow = region.attachShadow({ mode: "open" });
    shadow.innerHTML = '<div data-graview-view-root><div class="more">More about it</div><button type="button" class="toggle">More</button></div>';
    return { region, shadow };
  };

  it("reads what the view hears a click on from the region its host kept it on, when it is not handed clicked", () => {
    const { region, shadow } = drawn();
    keepClicked(region, [".more", ".toggle"]);
    expect(clickedOf(shadow)).toEqual([".more", ".toggle"]);
    expect(clickedOf(shadow.querySelector(".more"))).toEqual([".more", ".toggle"]);
    const found = auditView(shadow, { measure: false });
    expect(found.problems.map((one) => [one.rule, one.at])).toEqual(expect.arrayContaining([["keyboard", "div.more"], ["toggle-state", "button.toggle"]]));
  });

  it("takes clicked when it is handed it, over what the host kept", () => {
    const { region, shadow } = drawn();
    keepClicked(region, [".more"]);
    expect(auditView(shadow, { measure: false, clicked: [] }).problems).toEqual([]);
  });

  it("passes a click-only div as words where no host kept anything, as before", () => {
    const { shadow } = drawn();
    expect(clickedOf(shadow)).toBeUndefined();
    expect(auditView(shadow, { measure: false }).problems).toEqual([]);
  });
});
