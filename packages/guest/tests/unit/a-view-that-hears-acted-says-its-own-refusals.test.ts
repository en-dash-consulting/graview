// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { sam, threatApp, threatSeed } from "../../../../scripts/fixtures/threat-app.js";
import { createGuestHost } from "../../src/host/session.js";
import { createViewRuntime } from "../../src/worker/view-global.js";

/*
 * A VIEW THAT HEARS `acted` SAYS ITS OWN REFUSALS (Roadmap
 * f-views-work-end-to-end). A refused declarative press is said beside the
 * control by the host, by default, without the view listening for it; a
 * view that does listen takes it over there. So the runtime tells the host
 * where it hears `acted`, with where it hears a click, whenever that moves.
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

describe("the view's runtime", () => {
  it("tells the host where it hears acted, beside where it hears a click, and again when one is let go", async () => {
    const view = runtime();
    view.view.on("click", ".more", () => {});
    const off = view.view.on("acted", "textarea", () => {});
    await settle();
    expect(view.sent.filter((one) => one.type === "clicks").at(-1)).toEqual({ type: "clicks", selectors: [".more"], acted: ["textarea"] });
    off();
    await settle();
    expect(view.sent.filter((one) => one.type === "clicks").at(-1)).toEqual({ type: "clicks", selectors: [".more"] });
  });
});

describe("the session", () => {
  it("hands on where a view hears acted, strings only", () => {
    const said: (readonly string[])[] = [];
    const store = new Store<AnySchema>({ schema: threatApp.schema, mutations: (threatApp.mutations ?? []) as never, policy: threatApp.policy!, snapshot: structuredClone(threatSeed) as never });
    const session = createGuestHost({ store, principal: sam, view: "watch", nonce: "n", send: () => {}, props: () => ({ view: "watch", edges: [], acts: [] }), onClicks: (_, acted) => said.push(acted) });
    session.receive({ type: "clicks", nonce: "n", selectors: [], acted: ["button.save", 7] });
    session.receive({ type: "clicks", nonce: "n", selectors: [] });
    expect(said).toEqual([["button.save"], []]);
  });
});
