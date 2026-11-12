// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { sayIn, Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { composeDesign } from "@graview/core/compose";
import { editDocument, type GraviewDocument } from "@graview/core/document";
import { declaredViews, fetchDeclaredLenses, fetchHomeView } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A BARE APP LOOKS DESIGNED BY DEFAULT (Roadmap f-better-bare-app-defaults),
 * on the routed face. From Graview Cloud's Thanksgiving: a schedule item's
 * row said its time with a field label and the zone; a kind's glance
 * changed its list and not its rows on the home; the home said the app's
 * description under a headline that already said it; and a warning was
 * told by its hue, so an accent near it was refused.
 */
beforeAll(() => Promise.all([fetchDeclaredLenses(), fetchHomeView()]));
afterEach(() => sayIn({}));

// The reader is in New York — the person's zone a host passes — never the machine the test runs on.
const READER = "America/New_York";
const DESCRIPTION = "Who brings what, and when we eat.";
const base = {
  format: "graview-document",
  formatVersion: 1,
  name: "Thanksgiving",
  description: DESCRIPTION,
  // The app's zone is the reader's, so a time is said without it.
  brand: { timeZone: READER, accent: "#b4532a" },
  kinds: {
    dish: { noun: "dish", plural: "dishes", glance: ["course", "status"], fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["planned", "ready"], default: "planned" }, course: { type: "enum", options: ["main", "dessert"] }, bringer: { type: "string" } } },
    moment: { noun: "schedule item", plural: "schedule", fields: { name: { type: "string", required: true }, who: { type: "string" }, at: { type: "datetime", required: true } } },
  },
  acts: { "add-dish": { title: "Add a dish", creates: "dish" }, "add-moment": { title: "Add to the schedule", creates: "moment" } },
  rules: { "dish-is-ready": { title: "Every dish is ready", over: "dish", require: "status == 'ready'", says: "{name} is not ready yet" } },
  roles: ["owner"],
  policy: { grants: [{ roles: ["owner"], mutations: "*" }] },
} as unknown as GraviewDocument;
const snapshot = {
  nodes: [
    { id: "d1", kind: "dish", name: "Turkey", status: "planned", course: "main", bringer: "Ann" },
    { id: "m1", kind: "moment", name: "Dinner", who: "Diana", at: "2026-11-26T14:30:00Z" },
  ],
  edges: [],
};

async function drawn(document: GraviewDocument, path: string, reader: string | null = READER) {
  const compiled = compileDocument(document, { today: () => "2026-11-11" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, invariants: app.invariants ?? [], snapshot: snapshot as never });
  const host = document_.createElement("div");
  document_.body.appendChild(host);
  const root = createRoot(host);
  const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal: owner, ...(reader ? { timeZone: reader } : {}), ...(app.brand ? { brand: app.brand } : {}) }} initialPath={path} />));
  await act(async () => new Promise((done) => setTimeout(done, 40)));
  return {
    host,
    done: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
const document_ = globalThis.document;
const applied = (document: GraviewDocument, edits: readonly unknown[]) => {
  const out = editDocument(document, edits);
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.document;
};
const text = (element: Element | null | undefined) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
const withHome = (home: unknown[]) => ({ ...base, views: { home } }) as unknown as GraviewDocument;

describe("a derived row whose kind's date is a datetime", () => {
  it("leads its glance with the time as people say it, with no field label and, to a reader in the app's zone, no zone", async () => {
    const { host, done } = await drawn(base, "/schedule");
    const row = host.querySelector('[data-graview-record="m1"]');
    const glance = text(row?.querySelector(".graview-row-glance"));
    expect(glance).toBe("Nov 26, 2026, 9:30 AM · Diana");
    expect(text(row)).not.toMatch(/\bAt\b/);
    await done();
  });
});

describe("a reader elsewhere", () => {
  it("is told the zone the app's time is said on, on the derived row and on a row composeDesign wrote alike", async () => {
    // No zone passed for the person: the page's own clock is theirs, and the app's is another one.
    const wall = (zone: string) => new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(Date.parse("2026-11-26T14:30:00Z"));
    const elsewhere = ["Asia/Tokyo", "Europe/London"].find((zone) => wall(zone) !== wall(Intl.DateTimeFormat().resolvedOptions().timeZone))!;
    const named = /^Nov 2[67], 2026, \d{1,2}:30 [AP]M (GMT\+9|GMT|UTC)$/;
    const tokyo = { ...base, brand: { timeZone: elsewhere } } as unknown as GraviewDocument;
    const derived = await drawn(tokyo, "/schedule", null);
    expect(text(derived.host.querySelector('[data-graview-record="m1"] .graview-row-glance')).replace(/ · Diana$/, "")).toMatch(named);
    await derived.done();
    const edits = composeDesign(tokyo).edits;
    const composed = await drawn(applied(tokyo, [edits.find((edit) => edit.op === "set-view" && (edit as { kind?: string }).kind === "moment")!, { op: "set-home", blocks: [{ headline: "Thursday" }, { list: "all('moment')", as: "row" }] }]), "/", null);
    const row = composed.host.querySelector('[data-graview-listed="m1"]');
    expect(text(row).replace(/^Dinner/, "")).toMatch(named);
    await composed.done();
    // And a reader on the app's clock is said the composed row's time without it.
    const local = await drawn(applied(base, [edits.find((edit) => edit.op === "set-view" && (edit as { kind?: string }).kind === "moment")!, { op: "set-home", blocks: [{ headline: "Thursday" }, { list: "all('moment')", as: "row" }] }]), "/");
    expect(text(local.host.querySelector('[data-graview-listed="m1"]'))).toBe("DinnerNov 26, 2026, 9:30 AM");
    await local.done();
  });
});

describe("a kind's declared glance", () => {
  it("shapes its rows on the home as it does on its list", async () => {
    const list = await drawn(base, "/dishes");
    const onList = text(list.host.querySelector('[data-graview-record="d1"] .graview-row-glance'));
    await list.done();
    expect(onList).toBe("Main Planned");
    const home = await drawn(withHome([{ headline: "Thursday at Diana's" }, { list: "all('dish')", as: "row" }, { list: "all('moment')", as: "row" }]), "/");
    const dish = home.host.querySelector('[data-graview-listed="d1"] [data-testid="record-glance"]');
    // The same facts, in the glance's order: the course, then the status; nothing the glance leaves out (who brings it).
    expect(text(dish)).toBe("Main · Planned");
    expect(text(home.host.querySelector('[data-graview-listed="m1"] [data-testid="record-glance"]'))).toBe("Nov 26, 2026, 9:30 AM · Diana");
    await home.done();
  });
});

describe("the masthead", () => {
  it("says the app's description once, under a headline that says something else", async () => {
    const { host, done } = await drawn(withHome([{ headline: "Thursday at Diana's" }, { list: "all('dish')", as: "row" }]), "/");
    expect([...host.querySelectorAll('[data-testid="app-subtitle"]')].map((line) => line.textContent)).toEqual([DESCRIPTION]);
    expect(host.textContent!.split(DESCRIPTION).length - 1).toBe(1);
    await done();
  });

  it("and not again under a headline that already says it", async () => {
    const { host, done } = await drawn(withHome([{ headline: DESCRIPTION }, { list: "all('dish')", as: "row" }]), "/");
    expect(host.querySelectorAll('[data-testid="app-subtitle"]')).toHaveLength(0);
    expect(host.textContent!.split(DESCRIPTION).length - 1).toBe(1);
    await done();
  });
});

describe("every warning carries a mark and words, so it is not told by hue alone", () => {
  it("a broken rule's standing on the bar, a line in the warning tone, and a record a rule names on the home", async () => {
    const { host, done } = await drawn(withHome([{ headline: "Thursday at Diana's" }, { text: "Two dishes still need someone", tone: "warn" }, { list: "all('dish')", as: "row" }]), "/");
    const standing = host.querySelector('[data-testid="standing-link"]')!;
    expect(standing.querySelector("[data-graview-standing-mark]")?.textContent).toBe("⚠");
    expect(standing.getAttribute("aria-label")).toMatch(/rule.* broken/);
    const line = host.querySelector('.graview-spec-text[data-graview-tone="warn"]')!;
    expect(line.querySelector(".graview-spec-mark")?.textContent).toBe("⚠");
    expect(text(line)).toBe("⚠Warning: Two dishes still need someone");
    const flagged = host.querySelector('[data-graview-listed="d1"]')!;
    expect(flagged.hasAttribute("data-graview-flagged")).toBe(true);
    expect(text(flagged.querySelector(".graview-spec-title"))).toBe("Turkey ⚠");
    expect(flagged.querySelector("[aria-label]")?.getAttribute("aria-label")).toBe("Turkey — implicated in a problem");
    await done();
  });
});
