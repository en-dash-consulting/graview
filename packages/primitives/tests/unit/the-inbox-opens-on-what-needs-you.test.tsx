// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author, type Principal } from "@graview/core";
import { suggest, suggestions } from "@graview/core/tidying";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, type HostNotification } from "@graview/react";
import axe from "axe-core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchInspector, registerDefaultViews, Shell } from "../../src/index.js";
import { inboxWords } from "../../src/inbox.js";

beforeAll(() => fetchInspector());

/**
 * THE INBOX OPENS ON WHAT NEEDS YOU (Roadmap f-inbox-needs-you-first).
 * "Kinda confusing and hard to find what I need": the bell counted Activity,
 * which asks nothing of anyone; it could open on Activity with two
 * suggestions waiting; For you was one undivided list; and a broken rule was
 * an orange dot saying `quote = —`.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string(), status: z.string(), quote: z.number().optional() }), plural: "Vendors" });
const schema = createSchema([vendor]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const setQuote = defineMutation("set-quote", {
  title: "Set the quote",
  subject: { kinds: ["vendor"], arg: "id" },
  writes: ["quote"],
  input: z.object({ id: nodeRef(["vendor"]), quote: z.number() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { quote: args.quote });
  },
});
const unbook = defineMutation("unbook", {
  title: "Unbook",
  subject: { kinds: ["vendor"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["vendor"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "contacted" });
  },
});
const rename = defineMutation("rename-vendor", {
  title: "Rename",
  subject: { kinds: ["vendor"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["vendor"]), to: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.to });
  },
});
const quoted = defineInvariant("booked-needs-quote", {
  label: "A booked vendor has a quote",
  description: "Committing without a number is how budgets drift.",
  scope: { kind: "vendor" },
  repairs: ["unbook"],
  evaluate({ subject }) {
    return subject.status === "booked" && subject.quote === undefined
      ? [
          {
            invariant: "booked-needs-quote",
            subjectId: subject.id,
            label: "A booked vendor has a quote",
            message: `${subject.label} is booked but has no quote`,
            nodeIds: [subject.id],
            repairs: [{ mutation: "set-quote", args: { id: subject.id }, missing: ["quote"], label: "Add the quote" }, { mutation: "unbook", args: { id: subject.id }, label: "Unbook it" }],
          },
        ]
      : [];
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nora: Principal = { kind: "human", id: "nora", name: "Nora", roles: ["keeper"] };
const reader: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };
const CRUMBS = { id: "example-crumbs", kind: "vendor", label: "Crumbs Bakery", status: "booked" };
const SUGAR = { id: "example-sugar", kind: "vendor", label: "Sugar & Spoon", status: "contacted", quote: 450 };

const storeOf = (nodes: readonly object[] = [CRUMBS, SUGAR], options: object = {}) => new Store({ schema, mutations: [setQuote, unbook, rename], invariants: [quoted], snapshot: { nodes, edges: [] } as never, ...options });

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function settled(holds: () => void): Promise<void> {
  for (const end = Date.now() + 4000; ; ) {
    await act(async () => {
      await vi.dynamicImportSettled();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    try {
      holds();
      return;
    } catch (error) {
      if (Date.now() > end) throw error;
    }
  }
}

async function face(store: Store<typeof schema>, options: { readonly notifications?: readonly HostNotification[]; readonly principal?: Principal } = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} principal={options.principal ?? nora} {...(options.notifications ? { notifications: options.notifications } : {})}>
        <Shell<typeof schema> scheme="light" onScheme={() => {}} />
      </GraviewProvider>,
    ),
  );
  unmount = async () => act(async () => root.unmount());
  return host;
}

const $ = <E extends Element = HTMLElement>(selector: string) => document.querySelector<E>(selector);
const bell = () => $<HTMLButtonElement>('[data-testid="inbox-button"]');
const NEWS: HostNotification = { id: "news", title: "The newsletter went out" };
const REVIEW: HostNotification = { id: "review", title: "Ada proposed a change to review", needs: true };

async function open() {
  await settled(() => expect(bell()).not.toBeNull());
  await act(async () => bell()!.click());
  await settled(() => expect($('[data-testid="inbox"] [role="tablist"]')).not.toBeNull());
}

describe("the bell", () => {
  it("counts what needs this person and not what has happened", async () => {
    const store = storeOf();
    store.apply({ name: "rename-vendor", args: { id: "example-sugar", to: "Sugar" } }, { author: nora });
    store.apply({ name: "rename-vendor", args: { id: "example-sugar", to: "Spoon" } }, { author: nora });
    suggest(store, [{ name: "rename-vendor", args: { id: "example-sugar", to: "Sweet" } }], { author: actor, lineage: { basis: "Shorter" } });
    await face(store, { notifications: [NEWS, REVIEW] });
    // One suggestion, one broken rule, one host notice marked as needing them; not two changes, and not the news.
    await settled(() => expect(bell()!.getAttribute("data-count")).toBe("3"));
    expect($('[data-testid="inbox-count"]')!.textContent).toBe("3");
    expect(bell()!.getAttribute("aria-label")).toBe("Inbox — 3 need you: 1 rule broken");
    expect(bell()!.getAttribute("aria-label")).not.toMatch(/change/);
    await open();
    // What has happened is counted on its own tab, and only there.
    expect($('[data-testid="inbox-tab-activity"]')!.textContent).toBe("Activity2");
  });

  it("says nothing of a count where nothing needs this person", async () => {
    const store = storeOf([SUGAR]);
    store.apply({ name: "rename-vendor", args: { id: "example-sugar", to: "Sugar" } }, { author: nora });
    await face(store, { notifications: [NEWS] });
    await settled(() => expect(bell()).not.toBeNull());
    expect(bell()!.getAttribute("data-count")).toBe("0");
    expect($('[data-testid="inbox-count"]')).toBeNull();
    expect(bell()!.getAttribute("aria-label")).toBe("Inbox");
    expect(inboxWords(1, "")).toBe("Inbox — 1 needs you");
  });
});

describe("where it opens", () => {
  it("opens on For you while something there needs you, wherever it was left", async () => {
    const store = storeOf();
    store.apply({ name: "rename-vendor", args: { id: "example-sugar", to: "Sugar" } }, { author: nora });
    await face(store);
    await open();
    expect($('[data-testid="inbox"]')!.getAttribute("data-tab")).toBe("for-you");
    await act(async () => $('[data-testid="inbox-tab-activity"]')!.click());
    expect($('[data-testid="inbox"]')!.getAttribute("data-tab")).toBe("activity");
    await act(async () => bell()!.click());
    await act(async () => bell()!.click());
    await settled(() => expect($('[data-testid="inbox"]')?.getAttribute("data-tab")).toBe("for-you"));
  });

  it("opens on Activity where nothing needs you, and it has something to say", async () => {
    const store = storeOf([SUGAR]);
    store.apply({ name: "rename-vendor", args: { id: "example-sugar", to: "Sugar" } }, { author: nora });
    await face(store);
    await open();
    expect($('[data-testid="inbox"]')!.getAttribute("data-tab")).toBe("activity");
  });
});

describe("For you", () => {
  it("is split into Needs you and Updates, each saying so in a line when it is empty", async () => {
    await face(storeOf([SUGAR]), { notifications: [NEWS] });
    await open();
    await act(async () => $('[data-testid="inbox-tab-for-you"]')!.click());
    const needs = $('[data-testid="inbox-needs-you"]')!;
    const updates = $('[data-testid="inbox-updates"]')!;
    expect(needs.querySelector("h3")!.textContent).toBe("Needs you");
    expect(updates.querySelector("h3")!.textContent).toBe("Updates");
    expect(needs.querySelector('[data-testid="inbox-needs-you-empty"]')!.textContent).toBe("Nothing needs you right now.");
    expect(updates.textContent).toContain("The newsletter went out");
  });

  it("puts what the host marks as needing you under Needs you, and the rest under Updates", async () => {
    await face(storeOf([SUGAR]), { notifications: [NEWS, REVIEW] });
    await open();
    expect($('[data-testid="inbox-needs-you"]')!.textContent).toContain("Ada proposed a change to review");
    expect($('[data-testid="inbox-needs-you"]')!.textContent).not.toContain("newsletter");
    expect($('[data-testid="inbox-updates"]')!.textContent).toContain("The newsletter went out");
    expect($('[data-testid="inbox-updates-empty"]')).toBeNull();
  });

  it("has no serious accessibility problem", async () => {
    const store = storeOf();
    suggest(store, [{ name: "rename-vendor", args: { id: "example-sugar", to: "Sweet" } }], { author: actor, lineage: { basis: "Shorter" } });
    await face(store, { notifications: [NEWS, REVIEW] });
    await open();
    await settled(() => expect($('[data-testid="suggestion"]')).not.toBeNull());
    const found = await axe.run($('[data-testid="inbox"]')!, { rules: { "color-contrast": { enabled: false } } });
    expect(found.violations.map((one) => one.id)).toEqual([]);
  });
});

describe("a broken rule", () => {
  it("is said in words under Needs you, by the record's name, with its fix, and no dot stands by the person", async () => {
    await face(storeOf());
    await open();
    await settled(() => expect($('[data-testid="inbox-problem"]')).not.toBeNull());
    const row = $('[data-testid="inbox-problem"]')!;
    expect(row.closest('[data-testid="inbox-needs-you"]')).not.toBeNull();
    expect(row.querySelector('[data-testid="inbox-problem-words"]')!.textContent).toBe("Crumbs Bakery is booked but has no quote");
    expect(row.textContent).not.toMatch(/=|—|example-crumbs|booked-needs-quote/);
    expect([...row.querySelectorAll('[data-testid="inbox-problem-fix"]')].map((one) => one.textContent)).toEqual(["Add the quote", "Unbook it"]);
    expect($('[data-testid="standing"]')).toBeNull();
  });

  it("takes a fix that needs nothing more at a press, and the keyboard stays in the inbox", async () => {
    const store = storeOf();
    await face(store);
    await open();
    await settled(() => expect($('[data-testid="inbox-problem-fix"]')).not.toBeNull());
    const unbooks = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="inbox-problem-fix"]')].find((one) => one.textContent === "Unbook it")!;
    unbooks.focus();
    await act(async () => unbooks.click());
    await settled(() => expect(store.violations()).toEqual([]));
    await settled(() => expect($('[data-testid="inbox-problem"]')).toBeNull());
    await settled(() => expect(document.activeElement?.closest('[data-testid="inbox"]')).not.toBeNull());
    expect(document.activeElement?.tagName).not.toBe("BODY");
  });

  it("opens the acts on what it is about, for a fix that asks for something", async () => {
    const store = storeOf();
    await face(store);
    await open();
    await settled(() => expect($('[data-testid="inbox-problem-fix"]')).not.toBeNull());
    await act(async () => $('[data-testid="inbox-problem-fix"]')!.click());
    await settled(() => expect($('[data-affordance^="invariant:"]')?.textContent).toContain("Add the quote"));
  });

  it("does not ask anything of a seat that may not fix it: it is an Update, without a button", async () => {
    const policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] };
    const store = storeOf([CRUMBS], { policy });
    store.apply({ name: "rename-vendor", args: { id: "example-crumbs", to: "Crumbs Bakery" } }, { author: { kind: "system", id: "seed" } as never });
    await face(store, { principal: reader });
    await settled(() => expect(bell()).not.toBeNull());
    expect(bell()!.getAttribute("data-count")).toBe("0");
    await act(async () => bell()!.click());
    await settled(() => expect($('[data-testid="inbox-tab-for-you"]')).not.toBeNull());
    await act(async () => $('[data-testid="inbox-tab-for-you"]')!.click());
    await settled(() => expect($('[data-testid="inbox-updates"] [data-testid="inbox-problem"]')).not.toBeNull());
    expect($('[data-testid="inbox-problem-fix"]')).toBeNull();
  });

  it("leaves the dot that says all is well where every rule holds", async () => {
    await face(storeOf([SUGAR]));
    await settled(() => expect($('[data-testid="standing"]')).not.toBeNull());
  });
});

describe("Activity", () => {
  it("says what taking back several would do in words, not a plus sign", async () => {
    const store = storeOf([SUGAR]);
    store.apply({ name: "rename-vendor", args: { id: "example-sugar", to: "One" } }, { author: nora });
    store.apply({ name: "rename-vendor", args: { id: "example-sugar", to: "Two" } }, { author: nora });
    await face(store);
    await open();
    await settled(() => expect(document.querySelectorAll('[data-testid="undo-turn"]').length).toBe(2));
    const words = [...document.querySelectorAll('[data-testid="undo-turn"]')].map((one) => one.textContent);
    expect(words).toEqual(["Undo", "Undo 2 changes"]);
  });

  it("labels the way to see the app as it was", async () => {
    const store = storeOf([SUGAR]);
    store.apply({ name: "rename-vendor", args: { id: "example-sugar", to: "One" } }, { author: nora });
    await face(store);
    await open();
    await settled(() => expect($('[data-testid="show-past"]')).not.toBeNull());
    expect($('[data-testid="show-past"]')!.textContent).toBe("As it was");
  });

  it("says a template's example batch as what it is, with Remove examples", async () => {
    const store = storeOf([]);
    store.applyPrimitives([{ op: "add-node", node: SUGAR } as never], { author: { kind: "system", id: "template:vendor-shortlist" } as never, batch: "examples:vendor-shortlist:abc", intent: "Example content from Vendor shortlist" });
    await face(store);
    await open();
    await settled(() => expect($('[data-testid="undo-turn"]')).not.toBeNull());
    const row = $('[data-batch="examples:vendor-shortlist:abc"]')!;
    expect(row.querySelector("[data-graview-activity-words]")!.textContent).toBe("Example records from the template");
    expect(row.querySelector('[data-testid="undo-turn"]')!.textContent).toBe("Remove examples");
    await act(async () => row.querySelector<HTMLButtonElement>('[data-testid="undo-turn"]')!.click());
    await settled(() => expect(store.graph.allNodes()).toEqual([]));
  });
});

describe("Don't suggest this kind of thing", () => {
  const two = () => {
    const store = storeOf([SUGAR, { ...CRUMBS, status: "contacted" }]);
    suggest(store, [{ name: "rename-vendor", args: { id: "example-sugar", to: "Sweet" } }], { author: actor, lineage: { basis: "Shorter" } });
    suggest(store, [{ name: "rename-vendor", args: { id: "example-crumbs", to: "Crumbs" } }], { author: actor, lineage: { basis: "Shorter" } });
    return store;
  };

  it("stands beside No, and stops every suggestion of the kind, for good and with its way back", async () => {
    const store = two();
    await face(store);
    await open();
    await settled(() => expect($('[data-testid="suggestion-stop-kind"]')).not.toBeNull());
    expect($('[data-testid="suggestion-stop-kind"]')!.textContent).toBe("Don't suggest this kind of thing");
    await act(async () => $('[data-testid="suggestion-stop-kind"]')!.click());
    await settled(() => expect(suggestions(store)).toEqual([]));
    expect(() => suggest(store, [{ name: "rename-vendor", args: { id: "example-sugar", to: "Other" } }], { author: actor, lineage: { basis: "Shorter" } })).toThrow(/may not make this again/);
    // Nothing is left to answer, so the keyboard goes where the last answer has always gone: to what has happened, said in words, with its way back.
    await settled(() => expect($('[data-testid="inbox"]')!.getAttribute("data-tab")).toBe("activity"));
    expect($('[data-testid="diff-log"]')!.textContent).toMatch(/Stopped suggesting things like/);
    expect($('[data-testid="diff-log"] [data-testid="undo-turn"]')).not.toBeNull();
    // And listed under Updates for as long as it stands, after Activity has moved on.
    await act(async () => $('[data-testid="inbox-tab-for-you"]')!.click());
    await settled(() => expect($('[data-testid="suggestions-stopped"]')?.textContent).toMatch(/Stopped suggesting things like/));
    await act(async () => $('[data-testid="suggestion-suggest-again"]')!.click());
    await settled(() => expect(suggestions(store)).toHaveLength(2));
  });

  it("is not offered to a seat that only votes", async () => {
    const policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] };
    const store = storeOf([SUGAR], { policy });
    suggest(store, [{ name: "rename-vendor", args: { id: "example-sugar", to: "Sweet" } }], { author: actor, lineage: { basis: "Shorter" } });
    await face(store, { principal: reader });
    await open();
    await settled(() => expect($('[data-testid="suggestion-accept"]')).not.toBeNull());
    expect($('[data-testid="suggestion-stop-kind"]')).toBeNull();
  });
});
