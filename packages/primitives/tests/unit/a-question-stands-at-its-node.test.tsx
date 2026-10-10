// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { planFrom, type ChatReply } from "@graview/tools";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ChatPanel, PlanReview, registerDefaultViews } from "../../src/index.js";

/**
 * A QUESTION STANDS AT ITS NODE, and the least sure is read first.
 *
 * A split decision travels the seat's own reply as a question naming the
 * node, with its options as presses that land through the same path a
 * proposal does. And a plan whose calls carry a confidence is reviewed
 * least sure first, the number beside each row.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string(), surface: z.enum(["turf", "bed"]).optional() }), plural: "Zones" });
const schema = createSchema([zone]);
const { defineMutation } = bindSchema(schema);
const setSurface = defineMutation("set-surface", {
  title: "Say what the surface is",
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), surface: z.enum(["turf", "bed"]) }),
  apply: (ctx, args) => ctx.patchNode(args.zoneId, { surface: args.surface }),
});
const store = () =>
  new Store({
    schema,
    mutations: [setSurface],
    snapshot: { nodes: [{ id: "lawn", kind: "zone", label: "Back Lawn" }, { id: "border", kind: "zone", label: "Long Border" }] as never, edges: [] },
  });

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

/*
 * WAITED ON, NOT TIMED. The seat answers on a promise and a press settles a
 * frame or more later; a fixed 20 ms was enough on a quiet machine and not
 * under a full run, so each step waits for what it says it waits for —
 * every wait inside act(), so what lands meanwhile is drawn as it lands.
 */
async function until(holds: () => void, within = 4000): Promise<void> {
  for (const end = Date.now() + within; ; ) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    try {
      holds();
      return;
    } catch (error) {
      if (Date.now() > end) throw error;
    }
  }
}

async function mounted(at: Store<typeof schema>, child: React.ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={at} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}>
        {child}
      </GraviewProvider>,
    ),
  );
  return { host, unmount: () => act(async () => root.unmount()) };
}

describe("the chat", () => {
  it("stands a split at its node with the options as presses, and a press lands like a proposal", async () => {
    const at = store();
    const reply: ChatReply = {
      say: "Asked 1 question. 1 question for you.",
      proposals: [],
      questions: [
        {
          id: "field:zone.surface",
          nodeId: "lawn",
          nodeLabel: "Back Lawn",
          asks: "Which surface? What the ground is made of.",
          because: "split",
          confidence: 0.4,
          options: [
            { value: "turf", probability: 0.5, call: { mutation: "set-surface", args: { zoneId: "lawn", surface: "turf" } } },
            { value: "bed", probability: 0.45, call: { mutation: "set-surface", args: { zoneId: "lawn", surface: "bed" } } },
          ],
        },
      ],
    };
    const { host, unmount } = await mounted(at, <ChatPanel respond={async () => reply} />);
    const field = host.querySelector<HTMLInputElement>('[data-testid="chat-draft"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "fill the zones");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => field.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await until(() => expect(host.querySelector('[data-testid="chat-question"]')).not.toBeNull());
    const asked = host.querySelector('[data-testid="chat-question"]')!;
    expect(asked.getAttribute("data-chat-question-node")).toBe("lawn");
    expect(asked.textContent).toContain("Back Lawn: Which surface?");
    expect(asked.textContent).toContain("it could be either");
    const options = [...asked.querySelectorAll<HTMLButtonElement>('[data-testid="chat-option"]')];
    expect(options.map((option) => option.textContent)).toEqual(["turf 50%", "bed 45%"]);
    await act(async () => options[1]!.click());
    await until(() => expect(at.graph.getNode("lawn")!["surface"]).toBe("bed"));
    expect(at.graph.getNode("lawn")!["surface"]).toBe("bed");
    expect(at.log.all().at(-1)?.author).toMatchObject({ kind: "agent", id: "chat" });
    await unmount();
  });
});

describe("the review", () => {
  it("reads the least sure first, with how sure beside each row, and applies in the plan's own order", async () => {
    const at = store();
    const plan = planFrom(at, [
      { mutation: "set-surface", args: { zoneId: "lawn", surface: "turf" }, why: "surface of Back Lawn: turf", confidence: 0.9 },
      { mutation: "set-surface", args: { zoneId: "border", surface: "bed" }, why: "surface of Long Border: bed", confidence: 0.55 },
    ]);
    const { host, unmount } = await mounted(at, <PlanReview plan={plan} />);
    expect(host.querySelector('[data-testid="plan-least-sure"]')).not.toBeNull();
    const rows = [...host.querySelectorAll('[data-testid="plan"] > li')];
    expect(rows.map((row) => row.getAttribute("data-plan-row"))).toEqual(["border", "lawn"]);
    expect(rows.map((row) => row.querySelector('[data-testid="plan-sure"]')?.textContent)).toEqual(["55% sure", "90% sure"]);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="plan-apply"]')!.click());
    expect(at.log.all().map((op) => op.mutation?.args["zoneId"])).toEqual(["lawn", "border"]);
    await unmount();
  });

  it("keeps the plan's own order when nothing carries a confidence", async () => {
    const at = store();
    const plan = planFrom(at, [
      { mutation: "set-surface", args: { zoneId: "lawn", surface: "turf" } },
      { mutation: "set-surface", args: { zoneId: "border", surface: "bed" } },
    ]);
    const { host, unmount } = await mounted(at, <PlanReview plan={plan} />);
    expect(host.querySelector('[data-testid="plan-least-sure"]')).toBeNull();
    expect([...host.querySelectorAll('[data-testid="plan"] > li')].map((row) => row.getAttribute("data-plan-row"))).toEqual(["lawn", "border"]);
    await unmount();
  });
});
