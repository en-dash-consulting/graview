// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, suggestionsMayWait, type Author, type Principal } from "@graview/core";
import { stoppedSuggestions, stopSuggesting, suggest, suggestionKind, suggestions } from "@graview/core/tidying";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, type HostNotification } from "@graview/react";
import axe from "axe-core";
import { act, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchInspector, Inbox, registerDefaultViews, Shell } from "../../src/index.js";
import { inboxWords } from "../../src/inbox.js";
import { problemsShown, useSceneGo } from "../../src/seat-move.js";

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
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true, tidying: true };
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

async function face(store: Store<typeof schema>, options: { readonly notifications?: readonly HostNotification[]; readonly principal?: Principal; readonly more?: ReactNode } = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} principal={options.principal ?? nora} {...(options.notifications ? { notifications: options.notifications } : {})}>
        <Shell<typeof schema> scheme="light" onScheme={() => {}} />
        {options.more}
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
    expect(bell()!.getAttribute("aria-label")).toBe("Inbox — 1 new update");
    expect(inboxWords(1, "")).toBe("Inbox — 1 needs you");
    expect(inboxWords(0, "")).toBe("Inbox");
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
    expect(() => suggest(store, [{ name: "rename-vendor", args: { id: "example-sugar", to: "Other" } }], { author: actor, lineage: { basis: "Shorter" } })).toThrow(/may not suggest this kind of thing/);
    // Nothing is left to answer, so the keyboard goes where the last answer has always gone: to what has happened, said in words, with its way back.
    await settled(() => expect($('[data-testid="inbox"]')!.getAttribute("data-tab")).toBe("activity"));
    expect($('[data-testid="diff-log"]')!.textContent).toMatch(/Stopped suggesting “Rename”/);
    expect($('[data-testid="diff-log"] [data-testid="undo-turn"]')).not.toBeNull();
    // And listed under Updates for as long as it stands, after Activity has moved on.
    await act(async () => $('[data-testid="inbox-tab-for-you"]')!.click());
    await settled(() => expect($('[data-testid="suggestions-stopped"]')?.textContent).toMatch(/Stopped suggesting “Rename”/));
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

describe("what the review of #537 found", () => {
  const POLICY = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" as const }] };
  const anonymous: Principal = { kind: "human", id: "anonymous", roles: ["reader"], shared: true };
  const rename = (id: string, to: string) => suggest(storeHolder.store!, [{ name: "rename-vendor", args: { id, to } }], { author: actor, lineage: { basis: "Shorter" } });
  const storeHolder: { store?: Store<typeof schema> } = {};

  it("a seat's move to the problems opens them, and says what it said it did", async () => {
    let go: ReturnType<typeof useSceneGo> | undefined;
    function Seat() {
      go = useSceneGo();
      return null;
    }
    await face(storeOf(), { more: <Seat /> });
    await settled(() => expect(bell()).not.toBeNull());
    expect($('[data-testid="inbox"]')).toBeNull();
    await act(async () => go!({ to: "problems", address: "/problems", said: "Went to the problems." } as never));
    await settled(() => expect($('[data-testid="problems"] [data-testid="inbox-problem"]')).not.toBeNull());
  });

  it("a seat's move to the problems finds them on For you, for a seat the inbox opens on Activity for", async () => {
    let go: ReturnType<typeof useSceneGo> | undefined;
    function Seat() {
      go = useSceneGo();
      return null;
    }
    const store = storeOf([CRUMBS, SUGAR], { policy: POLICY });
    store.applyPrimitives([{ op: "patch-node", id: "example-sugar", before: { label: "Sugar & Spoon" }, after: { label: "Sugar" } } as never], { author: { kind: "system", id: "seed" } as never, intent: "Renamed" });
    await face(store, { principal: reader, more: <Seat /> });
    await settled(() => expect(bell()).not.toBeNull());
    await act(async () => go!({ to: "problems", address: "/problems", said: "Went to the problems." } as never));
    await settled(() => expect($('[data-testid="problems"]')).not.toBeNull());
    expect($('[data-testid="inbox"]')!.getAttribute("data-tab")).toBe("for-you");
  });

  it("a person who skipped to the problems has the keyboard on the first of them", async () => {
    await face(storeOf());
    await settled(() => expect(bell()).not.toBeNull());
    await act(async () => problemsShown(true, { into: true }));
    await settled(() => expect(document.activeElement?.getAttribute("data-testid")).toBe("inbox-problem-words"));
  });

  it("the bell and Needs you agree on a notice the host says needs you and has been read", async () => {
    await face(storeOf([SUGAR]), { notifications: [{ ...REVIEW, read: true }, { id: "second", title: "A workflow failed", needs: true }] });
    await open();
    expect($('[data-testid="inbox-needs-you"]')!.querySelectorAll('[data-testid="inbox-notification"]').length).toBe(2);
    expect(bell()!.getAttribute("data-count")).toBe("2");
  });

  it("keeps counting a needs notice once it has been shown, for a host that marks it read then", async () => {
    const seen: string[][] = [];
    function Host() {
      const [read, setRead] = useState(false);
      return (
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} principal={nora} notifications={[{ ...REVIEW, read }]} onNotificationsSeen={(ids) => (seen.push([...ids]), setRead(true))}>
          <Shell<typeof schema> scheme="light" onScheme={() => {}} />
        </GraviewProvider>
      );
    }
    const store = storeOf([SUGAR]);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<Host />));
    unmount = async () => act(async () => root.unmount());
    await open();
    await settled(() => expect(seen).toEqual([["review"]]));
    expect(bell()!.getAttribute("data-count")).toBe("1");
  });

  it("marks an unread plain notice with the dot and no count, and says so in its name", async () => {
    await face(storeOf([SUGAR]), { notifications: [NEWS] });
    await settled(() => expect(bell()).not.toBeNull());
    expect($('[data-testid="inbox-count"]')).toBeNull();
    expect($('[data-testid="inbox-button"] .graview-bar-badge[data-dot]')).not.toBeNull();
    expect(bell()!.getAttribute("aria-label")).toBe("Inbox — 1 new update");
  });

  it("draws no dot once the notice has been read", async () => {
    await face(storeOf([SUGAR]), { notifications: [{ ...NEWS, read: true }] });
    await settled(() => expect(bell()).not.toBeNull());
    expect($('[data-testid="inbox-button"] .graview-bar-badge[data-dot]')).toBeNull();
  });

  it("counts for a signed-out seat only what it may answer, and stands the rest under Updates", async () => {
    const store = storeOf([SUGAR, { ...CRUMBS, status: "contacted" }], { policy: POLICY });
    storeHolder.store = store;
    rename("example-sugar", "Sweet");
    rename("example-crumbs", "Crumbs");
    await face(store, { principal: anonymous });
    await settled(() => expect(bell()).not.toBeNull());
    await settled(() => expect(bell()!.getAttribute("data-changes")).toBe("0"));
    expect(bell()!.getAttribute("data-count")).toBe("0");
    await act(async () => bell()!.click());
    await settled(() => expect($('[data-testid="inbox-tab-for-you"]')).not.toBeNull());
    await act(async () => $('[data-testid="inbox-tab-for-you"]')!.click());
    await settled(() => expect($('[data-testid="inbox-updates"] [data-testid="suggestion"]')).not.toBeNull());
    expect($('[data-testid="inbox-needs-you"] [data-testid="suggestion"]')).toBeNull();
    expect($('[data-testid="inbox-needs-you-empty"]')).not.toBeNull();
  });

  it("keeps the keyboard on the next row when its only button is Later", async () => {
    const store = storeOf([SUGAR, { ...CRUMBS, status: "contacted" }], { policy: POLICY });
    storeHolder.store = store;
    rename("example-sugar", "Sweet");
    rename("example-crumbs", "Crumbs");
    await face(store, { principal: anonymous });
    await settled(() => expect(bell()).not.toBeNull());
    await act(async () => bell()!.click());
    await settled(() => expect($('[data-testid="inbox-tab-for-you"]')).not.toBeNull());
    await act(async () => $('[data-testid="inbox-tab-for-you"]')!.click());
    await settled(() => expect(document.querySelectorAll('[data-testid="suggestion-not-now"]').length).toBe(2));
    await act(async () => $('[data-testid="suggestion-not-now"]')!.click());
    await settled(() => expect(document.querySelectorAll('[data-testid="suggestion"]').length).toBe(1));
    await settled(() => expect(document.activeElement?.closest('[data-testid="suggestion"]')).not.toBeNull());
    expect($('[data-testid="inbox"]')!.getAttribute("data-tab")).toBe("for-you");
  });

  it("does not offer Suggest again, or the stop, to a seat that may not decide", async () => {
    const store = storeOf([SUGAR], { policy: POLICY });
    const made = suggest(store, [{ name: "rename-vendor", args: { id: "example-sugar", to: "Sweet" } }], { author: actor, lineage: { basis: "Shorter" } })!;
    stopSuggesting(store, made.id, { author: nora });
    await face(store, { principal: reader });
    await settled(() => expect(bell()).not.toBeNull());
    await act(async () => bell()!.click());
    await settled(() => expect($('[data-testid="inbox-tab-for-you"]')).not.toBeNull());
    await act(async () => $('[data-testid="inbox-tab-for-you"]')!.click());
    await settled(() => expect($('[data-testid="inbox-updates"]')).not.toBeNull());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
    expect($('[data-testid="suggestion-suggest-again"]')).toBeNull();
    expect($('[data-testid="suggestions-stopped"]')).toBeNull();
  });

  it("says a refused fix in words, not the store's raw text", async () => {
    const refuses = defineMutation("refuses-outright", { title: "Refuse", subject: { kinds: ["vendor"], arg: "id" }, writes: ["status"], input: z.object({ id: nodeRef(["vendor"]), note: z.string() }), apply() {} });
    const broken = defineInvariant("always-broken", {
      label: "Always",
      description: "Always.",
      scope: { kind: "vendor" },
      repairs: ["refuses-outright"],
      evaluate: ({ subject }) => [{ invariant: "always-broken", subjectId: subject.id, label: "Always", message: `${subject.label} is wrong`, nodeIds: [subject.id], repairs: [{ mutation: "refuses-outright", args: { id: subject.id, note: 5 }, label: "Try it" }] }],
    });
    const store = new Store({ schema, mutations: [refuses], invariants: [broken], snapshot: { nodes: [SUGAR], edges: [] } as never });
    await face(store);
    await open();
    await settled(() => expect($('[data-testid="inbox-problem-fix"]')).not.toBeNull());
    await act(async () => $('[data-testid="inbox-problem-fix"]')!.click());
    await settled(() => expect($('[data-testid="inbox-problem-refused"]')).not.toBeNull());
    expect($('[data-testid="inbox-problem-refused"]')!.textContent).not.toMatch(/Invalid arguments|refuses-outright|"path"|invalid_type/);
  });

  it("says Cloud's example batch, named `examples`, as what it is", async () => {
    const store = storeOf([]);
    store.applyPrimitives([{ op: "add-node", node: SUGAR } as never], { author: { kind: "system", id: "template" } as never, batch: "examples", intent: "Example content from the template — undo to remove it" });
    await face(store);
    await open();
    await settled(() => expect($('[data-batch="examples"]')).not.toBeNull());
    expect($('[data-batch="examples"] [data-graview-activity-words]')!.textContent).toBe("Example records from the template");
    await settled(() => expect($('[data-batch="examples"] [data-testid="undo-turn"]')?.textContent).toBe("Remove examples"));
    await act(async () => $('[data-batch="examples"] [data-testid="undo-turn"]')!.click());
    // What it removes is that batch's records and nothing else.
    await settled(() => expect(store.graph.allNodes()).toEqual([]));
  });

  it("removes the examples and leaves what a person added since", async () => {
    const store = storeOf([{ ...SUGAR, id: "mine", label: "Mine" }]);
    store.applyPrimitives([{ op: "add-node", node: SUGAR } as never], { author: { kind: "system", id: "template" } as never, batch: "examples", intent: "Example content" });
    store.apply({ name: "rename-vendor", args: { id: "mine", to: "Still mine" } }, { author: nora });
    await face(store);
    await open();
    await settled(() => expect($('[data-batch="examples"] [data-testid="undo-turn"]')).not.toBeNull());
    await act(async () => $('[data-batch="examples"] [data-testid="undo-turn"]')!.click());
    await settled(() => expect(store.graph.allNodes().map((node) => node.id)).toEqual(["mine"]));
  });
});

describe("the way back to a stop", () => {
  const POLICY = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" as const }] };
  const rename = (id: string, to: string) => ({ name: "rename-vendor", args: { id, to } });

  it("stands behind a checkpoint on a local store, with no suggestion left in the log", async () => {
    const store = storeOf([SUGAR, { ...CRUMBS, status: "contacted" }]);
    const stopped = stopSuggesting(store, suggest(store, [rename("example-sugar", "Sweet")], { author: actor, lineage: { basis: "Shorter" } })!.id, { author: nora });
    store.apply(rename("example-crumbs", "One"), { author: nora });
    store.apply(rename("example-crumbs", "Two"), { author: nora });
    store.compact(store.checkpoint({ keepOps: 1, keepDays: 0 })!);
    expect(store.log.all().some((op) => op.suggests !== undefined)).toBe(false);
    await face(store);
    await open();
    await act(async () => $('[data-testid="inbox-tab-for-you"]')!.click());
    await settled(() => expect($('[data-testid="suggestions-stopped"]')?.textContent).toMatch(/Stopped suggesting/));
    await act(async () => $('[data-testid="suggestion-suggest-again"]')!.click());
    await settled(() => expect(stoppedSuggestions(store)).toEqual([]));
    expect(stopped.batch).toBeTruthy();
  });

  it("does not offer a seat the server would refuse an Undo of it in Activity, and its gate loads the tray", async () => {
    const store = storeOf([SUGAR, { ...CRUMBS, status: "contacted" }], { policy: POLICY });
    const stopped = stopSuggesting(store, suggest(store, [rename("example-sugar", "Sweet")], { author: actor, lineage: { basis: "Shorter" } })!.id, { author: nora });
    await face(store, { principal: reader });
    await settled(() => expect(bell()).not.toBeNull());
    await act(async () => bell()!.click());
    await settled(() => expect($(`[data-batch="${stopped.batch}"]`)).not.toBeNull());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
    expect($(`[data-batch="${stopped.batch}"] [data-testid="undo-turn"]`)).toBeNull();
  });

  it("holds the rule that the gate loads the tray where the suggestion has gone and its stop has not", () => {
    const store = storeOf([SUGAR]);
    expect(suggestionsMayWait(store)).toBe(false);
    stopSuggesting(store, suggest(store, [rename("example-sugar", "Sweet")], { author: actor, lineage: { basis: "Shorter" } })!.id, { author: nora });
    expect(suggestionsMayWait(store)).toBe(true);
  });

  it("holds that a lift in the log alone loads the tray too", () => {
    const store = storeOf([SUGAR]);
    expect(suggestionsMayWait(store)).toBe(false);
    store.log.append({ id: "lift", seq: store.log.length, batch: "undo:a:1", author: nora, intent: "Undo: stopped", mutation: null, primitives: [], reads: [], writes: [], at: "2026-11-01T00:00:00.000Z", undoes: "gone", lineage: { basis: "x", liftedStop: true } } as never);
    expect(suggestionsMayWait(store)).toBe(true);
  });

  it("is listed, and lifted, from what the host says when the page's log no longer holds it", async () => {
    const store = storeOf([SUGAR, { ...CRUMBS, status: "contacted" }]);
    store.stopsServed = { stops: [{ batch: "undo:far:1", words: "Stopped suggesting “Rename”", kinds: [suggestionKind(rename("x", "y"))] }], kinds: [] };
    suggest(store, [rename("example-sugar", "Sweet")], { author: actor, lineage: { basis: "Shorter" } });
    expect(suggestions(store)).toEqual([]);
    await face(store);
    await settled(() => expect(bell()).not.toBeNull());
    expect(bell()!.getAttribute("data-count")).toBe("0");
    await act(async () => bell()!.click());
    await settled(() => expect($('[data-testid="inbox-tab-for-you"]')).not.toBeNull());
    await act(async () => $('[data-testid="inbox-tab-for-you"]')!.click());
    await settled(() => expect($('[data-testid="suggestions-stopped"]')?.textContent).toMatch(/Stopped suggesting/));
    await act(async () => $('[data-testid="suggestion-suggest-again"]')!.click());
    await settled(() => expect(suggestions(store)).toHaveLength(1));
    expect($('[data-testid="suggestions-stopped"]')).toBeNull();
  });

  it("keeps a kind a seat may not be told of out of its tray and off its bell", async () => {
    const store = storeOf([SUGAR, { ...CRUMBS, status: "contacted" }]);
    store.stopsServed = { stops: [], kinds: [suggestionKind(rename("x", "y"))] };
    suggest(store, [rename("example-sugar", "Sweet")], { author: actor, lineage: { basis: "Shorter" } });
    expect(suggestions(store)).toEqual([]);
    expect(stoppedSuggestions(store)).toEqual([]);
  });
});

describe("the bell, drawn where no AppBar is", () => {
  it("brings its own look", async () => {
    const store = storeOf([SUGAR]);
    store.apply({ name: "rename-vendor", args: { id: "example-sugar", to: "One" } }, { author: nora });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} principal={nora} notifications={[REVIEW]}><Inbox /></GraviewProvider>));
    unmount = async () => act(async () => root.unmount());
    await settled(() => expect(bell()).not.toBeNull());
    const css = [...host.querySelectorAll("style")].map((one) => one.textContent).join("");
    expect(css).toMatch(/\.graview-bar-badge\{position:absolute/);
    expect(css).toMatch(/\.graview-bar-tool\{/);
    expect($('[data-testid="app-bar"]')).toBeNull();
  });
});
