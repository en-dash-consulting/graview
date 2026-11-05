// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { BetterPanel, type BetterPanelProps } from "../../src/better-panel.js";

/*
 * THE BETTER UI PANEL SAYS A THING ONCE (Roadmap f-better-ui-draws-first-time):
 * kept by a host whose note already says it was kept ("Kept until this page
 * reloads."), the bubble does not say "Kept." before it again; and where
 * two drafts failed the same way, it offers Keep anyway and Stop rather
 * than only "— fixing".
 */
const nothing = () => undefined;
const base: BetterPanelProps = { name: "Home", scope: "This changes how Home looks for everyone in this app.", phase: "open", talk: [], steps: [], since: 0, working: false, ask: nothing, just: nothing, point: nothing, stop: nothing, compare: nothing, keep: nothing, discard: nothing, close: nothing };

async function drawn(props: Partial<BetterPanelProps>) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<BetterPanel {...base} {...props} />));
  return { host, unmount: async () => (await act(async () => root.unmount()), host.remove()) };
}

describe("the Better UI panel", () => {
  it("says kept once, in the host's words where they say it", async () => {
    const said = await drawn({ phase: "kept", kept: { note: "Kept until this page reloads." } });
    expect(said.host.querySelector('[data-testid="better-kept"] p')?.textContent).toBe("Kept until this page reloads.");
    await said.unmount();
    const plain = await drawn({ phase: "kept", kept: {} });
    expect(plain.host.querySelector('[data-testid="better-kept"] p')?.textContent).toBe("Kept.");
    await plain.unmount();
    const other = await drawn({ phase: "kept", kept: { note: "Everyone sees it now." } });
    expect(other.host.querySelector('[data-testid="better-kept"] p')?.textContent).toBe("Kept. Everyone sees it now.");
    await other.unmount();
  });

  it("offers Keep anyway and Stop once two drafts failed the same way, and Stop alone where the draft never drew", async () => {
    const pressed: string[] = [];
    const stuck = await drawn({ phase: "stuck", stuck: { keepAnyway: () => pressed.push("keep"), stop: () => pressed.push("stop") } });
    const buttons = [...stuck.host.querySelectorAll<HTMLButtonElement>('[data-testid="better-stuck"] button')];
    expect(buttons.map((one) => one.textContent)).toEqual(["Keep anyway", "Stop"]);
    await act(async () => buttons.forEach((one) => one.click()));
    expect(pressed).toEqual(["keep", "stop"]);
    await stuck.unmount();
    const never = await drawn({ phase: "stuck", stuck: { stop: nothing } });
    expect([...never.host.querySelectorAll('[data-testid="better-stuck"] button')].map((one) => one.textContent)).toEqual(["Stop"]);
    await never.unmount();
  });
});
