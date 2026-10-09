// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { GraviewProvider, useGraview } from "../../src/context.js";
import { createSeatTalk, seatTalkKey, useSeatDrawn, type SeatTalk } from "../../src/seat-talk.js";
import { createViews } from "../../src/view-registry.js";

/**
 * THE CONVERSATION IS THE APP'S, NOT THE FACE'S.
 *
 * The provider holds the seat's turns, what became of each proposal,
 * whether it is open and at which foot — so a face switch keeps them. A
 * face that is a page of its own reads them back from the tab's session; a
 * provider drawn inside another takes the outer one's.
 */
afterEach(() => sessionStorage.clear());

describe("the seat's conversation", () => {
  it("is kept for the tab under the app's name, and read back by the next page", () => {
    const first = createSeatTalk("Things");
    first.setTurns(() => [{ role: "person", text: "what is late" }, { role: "seat", text: "Pay the deposit." }]);
    first.settle("1:0", { state: "applied", said: "Finish it" });
    first.setOpen(true);
    first.setSide("right");
    expect(sessionStorage.getItem(seatTalkKey("Things"))).not.toBeNull();
    const next = createSeatTalk("Things").get();
    expect(next.turns.map((turn) => turn.text)).toEqual(["what is late", "Pay the deposit."]);
    expect(next.outcomes.get("1:0")).toEqual({ state: "applied", said: "Finish it" });
    expect(next.open).toBe(true);
    expect(next.side).toBe("right");
    // Another app in the same tab keeps its own.
    expect(createSeatTalk("Field notes").get().turns).toEqual([]);
  });

  it("starts fresh where the tab may not remember, or what it kept is not a conversation", () => {
    sessionStorage.setItem(seatTalkKey("Things"), "{not json");
    expect(createSeatTalk("Things").get().turns).toEqual([]);
    sessionStorage.clear();
    const memoryOnly = createSeatTalk(null);
    memoryOnly.setTurns(() => [{ role: "person", text: "hello" }]);
    expect(sessionStorage.length).toBe(0);
  });

  it("opens with a question asked from elsewhere, which is taken once", () => {
    const talk = createSeatTalk(null);
    talk.ask("  what is late  ");
    expect(talk.get().open).toBe(true);
    expect(talk.takePending()).toBe("what is late");
    expect(talk.takePending()).toBeNull();
  });

  it("counts the seats drawn, so Find offers to ask only where one is", () => {
    const talk = createSeatTalk(null);
    const gone = talk.drawn();
    const other = talk.drawn();
    expect(talk.get().drawn).toBe(2);
    gone();
    other();
    expect(talk.get().drawn).toBe(0);
  });
});

describe("the provider's conversation", () => {
  const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
  const schema = createSchema([task]);
  const store = () => new Store({ schema, mutations: [], invariants: [] });

  it("is one under a provider drawn inside another, and re-renders a reader of 'drawn' only when that changes", async () => {
    let outer: SeatTalk | undefined;
    let inner: SeatTalk | undefined;
    let renders = 0;
    let seated: boolean | undefined;
    function Outer() {
      outer = useGraview().seatTalk;
      return null;
    }
    function Inner() {
      inner = useGraview().seatTalk;
      seated = useSeatDrawn(inner);
      renders += 1;
      return null;
    }
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store()} views={createViews(schema)} initialView={EMPTY_VIEW}>
          <Outer />
          <GraviewProvider store={store()} views={createViews(schema)} initialView={EMPTY_VIEW}>
            <Inner />
          </GraviewProvider>
        </GraviewProvider>,
      ),
    );
    expect(inner).toBe(outer);
    expect(seated).toBe(false);
    const before = renders;
    await act(async () => inner!.setTurns(() => [{ role: "person", text: "hello" }]));
    expect(renders).toBe(before);
    let gone: () => void = () => {};
    await act(async () => {
      gone = inner!.drawn();
    });
    expect(seated).toBe(true);
    await act(async () => gone());
    expect(seated).toBe(false);
    await act(async () => root.unmount());
    host.remove();
  });
});
