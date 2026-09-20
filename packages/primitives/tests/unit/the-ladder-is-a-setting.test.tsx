// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ChatPanel } from "../../src/chat.js";
import { LadderSetting } from "../../src/ladder.js";

/**
 * THE LADDER IS A SETTING: one row in the profile, four short pills, a key
 * field only when the rung needs one — and the chat has no gear of its own.
 */
const thing = defineNode("thing", { fields: z.object({ label: z.string() }), plural: "Things" });
const schema = createSchema([thing]);
const store = () => new Store({ schema, snapshot: { nodes: [{ id: "a", kind: "thing", label: "A" }] as never, edges: [] } });

async function mounted(children: React.ReactNode) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store()} views={createViews(schema)} initialView={EMPTY_VIEW}>
        {children}
      </GraviewProvider>,
    ),
  );
  return { host, unmount: async () => { await act(async () => root.unmount()); host.remove(); } };
}

describe("the ladder is a setting", () => {
  it("offers the four rungs as pills with the current one pressed, and a key field only when a rung needs one", async () => {
    const { host, unmount } = await mounted(<LadderSetting />);
    const pills = [...host.querySelectorAll('[data-testid^="setting-intelligence-"][aria-pressed]')];
    expect(pills.map((pill) => pill.getAttribute("data-testid"))).toEqual([
      "setting-intelligence-graph",
      "setting-intelligence-local",
      "setting-intelligence-decision",
      "setting-intelligence-remote",
    ]);
    expect(host.querySelector('[data-testid="setting-intelligence-graph"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[data-testid="intelligence-key"]')).toBeNull();
    expect(host.querySelector('[data-testid="intelligence-decision-key"]')).toBeNull();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="setting-intelligence-decision"]')!.click());
    expect(host.querySelector('[data-testid="setting-intelligence-decision"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[data-testid="intelligence-decision-key"]')).not.toBeNull();
    // One sentence on screen; the rest is a tooltip.
    const why = host.querySelector('[data-testid="setting-intelligence-why"]')?.textContent ?? "";
    expect(why.split(/(?<=\.)\s/).length).toBe(1);

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="setting-intelligence-remote"]')!.click());
    expect(host.querySelector('[data-testid="intelligence-key"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="intelligence-model"]')).not.toBeNull();
    await unmount();
  });

  it("leaves the chat with no gear and no pane of its own", async () => {
    const { host, unmount } = await mounted(<ChatPanel />);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="chat"]')!.click());
    expect(host.querySelector('[data-testid="chat-panel"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="chat-settings"]')).toBeNull();
    expect(host.querySelector('[data-testid="chat-settings-form"]')).toBeNull();
    await unmount();
  });
});
