// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, z } from "@graview/core";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A KIND'S LIST OPENS AS ITS DECLARATION SAYS (`pages.lists.<kind>.sort` and
 * `.group`): requests grouped by status, the open ones first in the declared
 * order, each sorted by the rank the kind works out; done and declined last,
 * shut, each a button that says what it holds and how many. A person opens
 * one with a press or the keyboard, and the address keeps it open.
 */
const request = defineNode("request", {
  fields: z.object({ label: z.string(), status: z.enum(["new", "considering", "planned", "declined", "done"]), votes: z.number() }),
  plural: "Requests",
  label: (node) => node.label,
  computed: { rank: { expr: "votes * 2", label: "Rank" } },
});
const schema = createSchema([request]);
const records = [
  ["r1", "Work on a plane", "planned", 4],
  ["r2", "Share a board", "new", 9],
  ["r3", "Dark mode", "done", 30],
  ["r4", "A fax button", "declined", 1],
  ["r5", "Calendar feed", "new", 9],
  ["r6", "Big export", "new", 2],
  ["r7", "Reminders", "considering", 5],
  ["r8", "Print a board", "done", 3],
] as const;
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: { nodes: records.map(([id, label, status, votes]) => ({ id, kind: "request", label, status, votes })) as never, edges: [] },
  });
const declared = {
  lists: {
    request: {
      sort: { by: "rank", direction: "desc" as const, then: "label" },
      group: { by: "status", order: ["planned", "new", "considering"], closed: ["done", "declined"] },
    },
  },
};

async function open(path: string, lists: typeof declared | null = declared) {
  const views = createViews(schema);
  if (lists) views.arrange?.(lists);
  const context: PageContext<typeof schema> = { store: store(), views };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath={path} />));
  return { host, close: async () => (await act(async () => root.unmount()), host.remove()) };
}

const groupsOf = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>("[data-testid='list-group']")].map((section) => ({
    head: section.querySelector("h2")!.textContent!.replace(/\s+/g, " ").trim(),
    shut: section.dataset["closed"] === "shut",
    rows: [...section.querySelectorAll("li a[href^='/requests/']")].map((a) => a.getAttribute("href")!.slice("/requests/".length)),
  }));

describe("a kind's list as its declaration opens it", () => {
  it("draws the open groups first in their order, each sorted by the rank, then the closed groups shut and counted", async () => {
    const page = await open("/requests");
    expect(page.host.querySelector("[data-testid='records']")?.getAttribute("data-grouped")).toBe("status");
    expect(groupsOf(page.host)).toEqual([
      { head: "Planned 1", shut: false, rows: ["r1"] },
      // Nine votes each tie on the rank; the tiebreak puts them by name.
      { head: "New 3", shut: false, rows: ["r5", "r2", "r6"] },
      { head: "Considering 1", shut: false, rows: ["r7"] },
      { head: "▸Done · 2 requests", shut: true, rows: [] },
      { head: "▸Declined · 1 request", shut: true, rows: [] },
    ]);
    const toggle = page.host.querySelector<HTMLButtonElement>("[data-testid='list-group-toggle']")!;
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.tabIndex).toBe(0);
    const controlled = page.host.querySelector(`#${toggle.getAttribute("aria-controls")}`);
    expect(controlled?.hasAttribute("hidden")).toBe(true);
    await page.close();
  });

  it("opens a closed group when a person presses it, and closes it again", async () => {
    const page = await open("/requests");
    const toggle = () => page.host.querySelector<HTMLButtonElement>("[data-testid='list-group-toggle']")!;
    await act(async () => toggle().click());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(groupsOf(page.host)[3]).toEqual({ head: "▾Done · 2 requests", shut: false, rows: ["r3", "r8"] });
    expect(page.host.querySelector(`#${toggle().getAttribute("aria-controls")}`)?.hasAttribute("hidden")).toBe(false);
    // The other closed group stays shut.
    expect(groupsOf(page.host)[4]?.shut).toBe(true);
    await act(async () => toggle().click());
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    await page.close();
  });

  it("keeps a closed group open where the address says so, and stands them open while the words narrow the list", async () => {
    const opened = await open("/requests?open=declined");
    expect(groupsOf(opened.host).map((group) => group.shut)).toEqual([false, false, false, true, false]);
    await opened.close();
    const found = await open("/requests?q=board&group=status&sort=rank:desc");
    expect(groupsOf(found.host).map((group) => [group.head, group.rows])).toEqual([
      ["New 1", ["r2"]],
      ["▾Done · 1 request", ["r8"]],
    ]);
    await found.close();
  });

  it("is sorted another way by the address, as a person chose", async () => {
    const page = await open("/requests?sort=label&group=status");
    expect(groupsOf(page.host)[1]?.rows).toEqual(["r6", "r5", "r2"]);
    expect(groupsOf(page.host).at(-1)?.shut).toBe(true);
    await page.close();
  });

  it("is a list in its own order where the declaration says nothing", async () => {
    const page = await open("/requests", null);
    expect(page.host.querySelector("[data-testid='list-group']")).toBeNull();
    expect(page.host.querySelector("[data-testid='list-group-toggle']")).toBeNull();
    await page.close();
  });
});
