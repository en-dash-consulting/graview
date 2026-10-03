// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ActivityRail, ChatPanel, registerDefaultViews } from "../../src/index.js";

/**
 * TWO SEATS ON ONE STORE, and what each is told.
 *
 * The chat proposed "Add an item" to a helper who may not add one — an apply
 * button, refused on press — because the responder proposes from the graph
 * and nothing asked the policy until the store did. And the activity rail
 * called the keeper's work "you" to the helper: any human was "you".
 */
const item = defineNode("item", { fields: z.object({ label: z.string() }), plural: "Items" });
const schema = createSchema([item]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-item", {
  title: "Add an item",
  description: "Bring one in.",
  creates: ["item"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "item"), kind: "item", label: args.label });
  },
});
const keeper: Principal = { kind: "human", id: "kai", roles: ["keeper"] };
const helper: Principal = { kind: "human", id: "hana", roles: ["helper"] };
const guarded = () =>
  new Store({
    schema,
    mutations: [add],
    invariants: [],
    policy: { roles: ["keeper", "helper"], grants: [{ roles: ["keeper"], mutations: "*" }] } as never,
  });

// jsdom has no scrollTo; the chat scrolls its log on every turn.
(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

async function mounted(element: React.ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, unmount: () => act(async () => root.unmount()) };
}
const provider = (store: Store<typeof schema>, principal: Principal, child: React.ReactElement) => (
  <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} principal={principal}>
    {child}
  </GraviewProvider>
);

describe("the chat under a policy", () => {
  it("withholds a proposal the seat may not take, with the policy's reason, rather than offering a press that refuses", async () => {
    const store = guarded();
    const respond = async () => ({ say: "I can do that.", proposals: [{ mutation: "add-item", args: { label: "Sneak one in" }, why: "test" }], grounded: true });
    const { host, unmount } = await mounted(provider(store, helper, <ChatPanel respond={respond as never} />));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="chat"]')!.click());
    const field = host.querySelector<HTMLInputElement>('[aria-label="Message the seat"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "add an item");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      field.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(host.querySelector('[data-testid="chat-apply"]'), "no press that would refuse").toBeNull();
    const withheld = host.querySelector('[data-testid="chat-withheld"]');
    // Said in the act's own words, as the activity rail would say it.
    expect(withheld?.textContent).toContain("Sneak one in");
    expect(withheld?.textContent).toContain("Not permitted");
    await unmount();
  });
});

describe("the rail with two seats", () => {
  // FR-06 and FR-17: an agent acting for a person is both of them, by their own names, with the channel it came through.
  it("reads \"Claude, for kai\" for an agent acting for a person, and says what it came through", async () => {
    const store = guarded();
    store.apply({ name: "add-item", args: { label: "Pay the deposit" } }, { author: { kind: "agent", id: "agent:claude:acct_7", name: "Claude", onBehalfOf: keeper }, via: "mcp:Claude" });
    const asHelper = await mounted(provider(store, helper, <ActivityRail calls={[]} seat={null} />));
    await act(async () => asHelper.host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    expect(asHelper.host.querySelector('[data-testid="diff-log"] li strong')?.textContent).toBe("Claude, for kai, via Claude");
    await asHelper.unmount();
  });


  it("says \"you\" only for the person at the keyboard, and names the other seat", async () => {
    const store = guarded();
    store.apply({ name: "add-item", args: { label: "Pay the deposit" } }, { author: keeper });
    const asHelper = await mounted(provider(store, helper, <ActivityRail calls={[]} seat={null} />));
    await act(async () => asHelper.host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    const row = asHelper.host.querySelector('[data-testid="diff-log"] li strong')?.textContent;
    expect(row).toBe("kai");
    await asHelper.unmount();
    const asKeeper = await mounted(provider(store, keeper, <ActivityRail calls={[]} seat={null} />));
    await act(async () => asKeeper.host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    expect(asKeeper.host.querySelector('[data-testid="diff-log"] li strong')?.textContent).toBe("you");
    await asKeeper.unmount();
  });

  it("names the other seat by the name it is offered under, not by its id (W-114)", async () => {
    const store = guarded();
    store.apply({ name: "add-item", args: { label: "Pay the deposit" } }, { author: keeper });
    const seats = [
      { label: "Kai, the keeper", principal: keeper },
      { label: "Hana, helping", principal: helper },
    ];
    const asHelper = await mounted(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} principal={helper} seats={seats}>
        <ActivityRail calls={[]} seat={null} />
      </GraviewProvider>,
    );
    await act(async () => asHelper.host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    expect(asHelper.host.querySelector('[data-testid="diff-log"] li strong')?.textContent).toBe("Kai, the keeper");
    await asHelper.unmount();
  });
});
