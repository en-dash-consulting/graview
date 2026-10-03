// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { PermissionDeniedError, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { ActivityRail, registerDefaultViews } from "@graview/primitives";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createGuestHost } from "../../src/host/index.js";
import type { GuestAnswer } from "../../src/protocol.js";
import { bethan, inbox, schema, showroom, staff } from "./showroom.js";

/**
 * A GUEST'S REQUESTED ACT IS REFUSED BY POLICY EXACTLY AS THE VIEWER'S
 * CLICK WOULD BE, AND IS ATTRIBUTED TO THE VIEW IN THE RAIL (FR-04). The
 * host never acts as the guest: it applies what was asked through the
 * store, as the viewer, and the op says it came through the view.
 */
const answers = (said: readonly unknown[]) => said.filter((one): one is GuestAnswer => (one as GuestAnswer).type === "answer");
const clicked = (principal: Principal, call: { name: string; args: Record<string, unknown> }): string | undefined => {
  try {
    showroom().apply(call, { author: principal, via: "web" });
    return undefined;
  } catch (error) {
    return (error as PermissionDeniedError).refusal.message;
  }
};

describe("an act a guest asks for", () => {
  it("is applied as the viewer, through the view", () => {
    const store = showroom();
    const { said, send } = inbox();
    const host = createGuestHost({ store, principal: bethan, view: "enquiry-card", nonce: "n", send });
    host.receive({ type: "act", nonce: "n", id: 1, name: "ask", args: { shopperId: "shopper:bethan", label: "Is it still there?" } });
    expect(answers(said)).toEqual([{ type: "answer", id: 1, ok: true, intent: "Ask “Is it still there?”" }]);
    const op = store.log.all().at(-1)!;
    expect(op.author).toBe(bethan);
    expect(op.via).toBe("view:enquiry-card");
  });

  it("is refused with the policy's own sentence, exactly as the viewer's click would be", () => {
    const cases: Array<[Principal, { name: string; args: Record<string, unknown> }]> = [
      // Not hers to ask for: another shopper's record, which she may not see.
      [bethan, { name: "ask", args: { shopperId: "shopper:freya", label: "Sneak" } }],
      // An act her roles do not grant.
      [bethan, { name: "retire-car", args: { carId: "car:golf" } }],
      // A stranger with no grant at all.
      [{ kind: "human", id: "browsing", roles: [] }, { name: "ask", args: { shopperId: "shopper:bethan", label: "Hi" } }],
    ];
    for (const [principal, call] of cases) {
      const store = showroom();
      const before = store.snapshot();
      const { said, send } = inbox();
      createGuestHost({ store, principal, view: "card", nonce: "n", send }).receive({ type: "act", nonce: "n", id: 7, ...call });
      const click = clicked(principal, call);
      expect(click, `${call.name} is refused to a click`).toBeDefined();
      expect(answers(said)).toEqual([{ type: "answer", id: 7, ok: false, reason: "refused", message: click }]);
      expect(store.snapshot()).toEqual(before);
    }
  });

  it("says no more than that an act failed when the act itself throws", () => {
    const store = showroom();
    const { said, send } = inbox();
    createGuestHost({ store, principal: staff, view: "card", nonce: "n", send }).receive({ type: "act", nonce: "n", id: 2, name: "retire-car", args: { carId: 42 } });
    expect(answers(said)).toEqual([{ type: "answer", id: 2, ok: false, reason: "failed", message: "The act could not be applied." }]);
  });
});

describe("the rail", () => {
  it("says the change came through the guest view, by the viewer", async () => {
    const store = showroom();
    createGuestHost({ store, principal: staff, view: "recipe-card", nonce: "n", send: () => {} }).receive({
      type: "act",
      nonce: "n",
      id: 1,
      name: "ask",
      args: { shopperId: "shopper:bethan", label: "Test drive?" },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} principal={staff}>
          <ActivityRail calls={[]} seat={null} />
        </GraviewProvider>,
      ),
    );
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    expect(host.querySelector('[data-testid="diff-log"] li strong')?.textContent).toBe("you, via recipe-card");
    await act(async () => root.unmount());
  });
});
