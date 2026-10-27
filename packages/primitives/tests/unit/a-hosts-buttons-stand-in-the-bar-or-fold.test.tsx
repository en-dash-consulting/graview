// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppBar, type BarAction } from "../../src/index.js";

/**
 * A HOST'S BUTTONS STAND IN THE APP BAR (FR-227, Roadmap
 * f-host-buttons-in-the-app-bar).
 *
 * Graview Cloud's "Send feedback" could sit only in the person's menu
 * (`hostActions`) or the right-click menu, two taps from a reader, and a
 * host may float nothing over an app (FR-72). `barActions` draws a host's
 * presses on the bar itself, on both faces: beside the tools where the bar
 * has their width over a phone's, folded into one control where it does
 * not. Each is a button named by its label, its icon hidden from the
 * reader, and none is drawn when the host gives none.
 */
let host: HTMLDivElement | undefined;
let root: Root | undefined;
const realRect = Element.prototype.getBoundingClientRect;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = undefined;
  Element.prototype.getBoundingClientRect = realRect;
  vi.restoreAllMocks();
});

/** The bar as wide as a desk, or as a phone: jsdom lays nothing out, so the bar's box is said for it. */
function barAs(width: number) {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const wide = this.classList.contains("graview-bar") ? width : 0;
    return { x: 0, y: 0, left: 0, top: 0, right: wide, bottom: 0, width: wide, height: 0, toJSON: () => ({}) } as DOMRect;
  };
}

function drawn(actions: readonly BarAction[] | undefined) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <AppBar
        brand={undefined}
        name="Field notes"
        home={{ href: "/", current: true }}
        places={[]}
        current={null}
        reach={{}}
        find={false}
        tools={<span data-testid="standing">All rules hold</span>}
        {...(actions ? { actions } : {})}
      />,
    ),
  );
  return host;
}

const feedback = vi.fn();
const share = vi.fn();
const actions: readonly BarAction[] = [
  { label: "Send feedback", icon: "✉", onSelect: feedback },
  { label: "Share", onSelect: share },
];

describe("a host's buttons on the app bar (FR-227)", () => {
  it("stand on a desk's bar, in the order given, each named by its label with its icon hidden, and run their onSelect", async () => {
    barAs(1440);
    const bar = drawn(actions);
    const buttons = [...bar.querySelectorAll<HTMLButtonElement>('[data-testid="app-bar"] [data-testid="host-bar-action"]')];
    expect(buttons.map((button) => button.textContent)).toEqual(["✉Send feedback", "Share"]);
    // The accessible name is the label alone: the mark is hidden from the reader.
    expect(buttons.map((button) => [...button.querySelectorAll("span:not([aria-hidden])")].map((span) => span.textContent).join(""))).toEqual(["Send feedback", "Share"]);
    expect(buttons[0]!.querySelector("[aria-hidden]")?.textContent).toBe("✉");
    for (const button of buttons) expect(button.tabIndex).toBe(0);
    // Standing, there is no overflow control.
    expect(bar.querySelector('[data-testid="host-bar-actions-open"]')).toBeNull();
    act(() => buttons[0]!.click());
    expect(feedback).toHaveBeenCalledTimes(1);
    expect(share).not.toHaveBeenCalled();
    // Before the person's own tools.
    const ids = [...bar.querySelectorAll("[data-testid]")].map((one) => one.getAttribute("data-testid"));
    expect(ids.indexOf("host-bar-action")).toBeLessThan(ids.indexOf("standing"));
    const result = await axe.run(bar, { rules: { region: { enabled: false } } });
    expect(result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  it("fold into one control on a phone's bar, which names them and lists each as a button that runs and closes it", async () => {
    barAs(320);
    const bar = drawn(actions);
    // Nothing stands on the row: every button is behind the one control, in its pane, hidden until it opens.
    expect(bar.querySelector('[data-testid="host-bar-actions-standing"]')).toBeNull();
    for (const button of bar.querySelectorAll('[data-testid="host-bar-action"]')) expect(button.closest('[data-testid="host-bar-actions"]')?.hasAttribute("hidden")).toBe(true);
    const more = bar.querySelector<HTMLButtonElement>('[data-testid="app-bar"] [data-testid="host-bar-actions-open"]')!;
    expect(more).not.toBeNull();
    expect(more.getAttribute("aria-label")).toBe("More — Send feedback, Share");
    expect(more.tabIndex).toBe(0);
    act(() => more.click());
    const pane = bar.querySelector<HTMLElement>('[data-testid="host-bar-actions"]')!;
    expect(pane.hasAttribute("hidden")).toBe(false);
    const buttons = [...pane.querySelectorAll<HTMLButtonElement>('[data-testid="host-bar-action"]')];
    expect(buttons.map((button) => button.textContent)).toEqual(["✉Send feedback", "Share"]);
    act(() => buttons[1]!.click());
    expect(share).toHaveBeenCalledTimes(1);
    expect(pane.hasAttribute("hidden")).toBe(true);
    const result = await axe.run(bar, { rules: { region: { enabled: false } } });
    expect(result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  it("are not there when the host gives none", () => {
    barAs(1440);
    const bar = drawn(undefined);
    expect(bar.querySelector('[data-testid="host-bar-action"]')).toBeNull();
    expect(bar.querySelector('[data-testid="host-bar-actions-open"]')).toBeNull();
    expect(bar.querySelector('[data-testid="host-bar-actions"]')).toBeNull();
  });
});
