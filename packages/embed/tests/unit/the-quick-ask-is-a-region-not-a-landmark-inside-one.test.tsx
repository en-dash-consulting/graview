// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, Store, z } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { PagesApp, type PageContext } from "@graview/pages";
import { registerDefaultViews, Shell } from "@graview/primitives";
import { createViews, GraviewProvider } from "@graview/react";
import { stubFast } from "@graview/tools/inline-ai";
import axe from "axe-core";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, preload } from "../../src/index.js";

// Every face fetched before the first mount, so each draws in the commit `mount` makes (FR-57).
beforeAll(() => preload());

/**
 * FR-40: WHAT ASKS IS A REGION, NOT A LANDMARK INSIDE ONE.
 *
 * The seat was an `<aside>` — a complementary landmark — drawn inside the
 * Shell's main and inside an embed's own region, and what it held were
 * asides inside IT. axe's `landmark-complementary-is-top-level` failed on
 * every hosted app at every size and scheme. The quick ask that replaced
 * it (Roadmap f-quick-ask-framework) stands beside what it is about, so it
 * is a region there named "Ask about <the thing>", and holds no aside.
 */
const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  edges: { "assigned-to": { to: ["duty"], description: "who does the run" } },
});
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Runs" });
const schema = createSchema([person, duty]);
const app = defineApp({ name: "Field notes", schema, mutations: [] });
const snapshot = {
  nodes: [
    { id: "ana", kind: "person", label: "Ana" },
    { id: "morning", kind: "duty", label: "Morning run" },
  ],
  edges: [{ kind: "assigned-to", from: "ana", to: "morning" }],
} as never;
const store = () => new Store({ schema, mutations: [], invariants: [], snapshot });
const ai = { fast: stubFast() };
const views = () => registerDefaultViews(schema, createViews(schema));

const LANDMARK = "main, nav, aside, header, footer, form[aria-label], section[aria-label], section[aria-labelledby], [role=main], [role=navigation], [role=complementary], [role=region], [role=banner], [role=contentinfo], [role=search], [role=form]";
const isLandmark = (el: Element) => {
  const role = el.getAttribute("role");
  // An explicit role that is not a landmark's takes the element out of the landmarks.
  if (role !== null && !["main", "navigation", "complementary", "region", "banner", "contentinfo", "search", "form"].includes(role)) return false;
  return el.matches(LANDMARK);
};
const isComplementary = (el: Element) => el.matches("aside:not([role]), [role=complementary]");

/** Every complementary landmark with a landmark above it, said by its name. */
const nested = (root: Element) =>
  [...root.querySelectorAll("*")]
    .filter(isComplementary)
    .filter((el) => {
      for (let up = el.parentElement; up; up = up.parentElement) if (isLandmark(up)) return true;
      return false;
    })
    .map((el) => el.getAttribute("aria-label") ?? el.getAttribute("data-testid") ?? el.tagName);

const axeSays = async (root: Element) => {
  const result = await axe.run(root, { runOnly: { type: "rule", values: ["landmark-complementary-is-top-level"] } });
  return result.violations.flatMap((violation) => violation.nodes.map((node) => node.target.join(" ")));
};

const click = async (host: Element, testid: string) => {
  const button = host.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`);
  if (button) await act(async () => button.click());
  return button !== null;
};

async function rendered(tree: ReactNode, run: (host: HTMLElement) => Promise<void>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(tree));
  try {
    await run(host);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
}

/** Opens the quick ask with ⌘K and waits for its card, which is fetched when it is first opened. */
const openQuickAsk = async (host: Element) => {
  for (let turn = 0; turn < 200 && !host.querySelector("[data-graview-quick-ask]"); turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  if (!host.querySelector("[data-graview-quick-ask]")) return false;
  await act(async () => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true })));
  for (let turn = 0; turn < 200 && !host.querySelector('[data-testid="quick-ask"]'); turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  return host.querySelector('[data-testid="quick-ask"]') !== null;
};

describe("the quick ask is a region, not a landmark inside one", () => {
  it("in the Shell, with the quick ask, the key, the profile and the activity all open", async () => {
    await rendered(
      <GraviewProvider store={store()} views={views()} initialView={{ ...EMPTY_VIEW, focusId: aggregateId("duty"), overview: true }} initialSelection={["ana"]} brand={{ name: "Field notes" } as never} ai={ai}>
        <Shell<typeof schema> scheme="light" onScheme={() => {}} remembers />
      </GraviewProvider>,
      async (host) => {
        expect(await click(host, "profile-button")).toBe(true);
        expect(await click(host, "activity-button")).toBe(true);
        expect(await click(host, "lines-key")).toBe(true);
        expect(await openQuickAsk(host)).toBe(true);
        const asking = host.querySelector('[data-testid="quick-ask"]');
        expect(asking?.getAttribute("role")).toBe("region");
        expect(asking?.getAttribute("aria-label")).toBe("Ask about Ana");
        expect(nested(host)).toEqual([]);
        expect(await axeSays(host)).toEqual([]);
      },
    );
  });

  for (const face of ["scene", "graview", "pages"] as const) {
    it(`in an embed's ${face} face, which is a region of its own`, async () => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      let handle: EmbedHandle | undefined;
      await act(async () => {
        handle = mount(host, { app, fonts: false, face, seed: snapshot, label: "The notes", ai } as unknown as EmbedOptions);
      });
      try {
        expect(await openQuickAsk(host)).toBe(true);
        await click(host, "profile-button");
        expect(host.querySelector('[data-testid="quick-ask"]')?.getAttribute("role")).toBe("region");
        expect(nested(host)).toEqual([]);
        expect(await axeSays(host)).toEqual([]);
      } finally {
        await act(async () => handle!.unmount());
        host.remove();
        sessionStorage.clear();
      }
    });
  }

  it("on the pages face, with the quick ask open", async () => {
    await rendered(<PagesApp context={{ store: store(), views: views(), ai } as PageContext<typeof schema>} initialPath="/runs/morning" />, async (host) => {
      expect(await openQuickAsk(host)).toBe(true);
      expect(host.querySelector('[data-testid="quick-ask"]')?.getAttribute("role")).toBe("region");
      expect(nested(host)).toEqual([]);
      expect(await axeSays(host)).toEqual([]);
    });
  });
});
