// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppBar, type BarStatus } from "../../src/index.js";

/*
 * A HOST'S STATUS SAYS ITSELF ON HOVER AND FOLDS TO ITS MARK ON A PHONE
 * (Roadmap f-bar-status-item). Not a press: its sentence is its hover and
 * its accessible description, a link where the host gives an `href`, and
 * on a phone's bar the bar's own rule hides its word behind its mark.
 */
let host: HTMLDivElement | undefined;
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function bar(status?: BarStatus) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<AppBar brand={undefined} name="Homeflow" home={{ href: "/", current: true }} places={[]} current={null} reach={{}} find={false} tools={null} {...(status ? { status } : {})} />));
  return host;
}

describe("a host's status on the bar", () => {
  it("is its mark and its word, its sentence on hover and as its accessible description, reachable from the keyboard", async () => {
    const at = bar({ label: "Only you", icon: "lock", description: "Only you can open this app." });
    const item = at.querySelector<HTMLElement>('[data-testid="app-status"]')!;
    expect(item.tagName).toBe("SPAN");
    expect(item.tabIndex).toBe(0);
    expect(item.textContent).toBe("Only you");
    expect(item.querySelector("svg")).not.toBeNull();
    expect(item.getAttribute("title")).toBe("Only you can open this app.");
    expect(document.getElementById(item.getAttribute("aria-describedby")!)?.textContent).toBe("Only you can open this app.");
    const result = await axe.run(item, { rules: { region: { enabled: false } } });
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("is a link where the host gives an href", () => {
    const at = bar({ label: "Public", icon: "🌐", description: "Anyone can find and open this app.", href: "/sharing", target: "_top" });
    const item = at.querySelector<HTMLAnchorElement>('[data-testid="app-status"]')!;
    expect(item.tagName).toBe("A");
    expect(item.getAttribute("href")).toBe("/sharing");
    expect(item.getAttribute("target")).toBe("_top");
  });

  it("folds its word behind its mark on a phone's bar by the bar's own rule, and keeps its word with no mark", () => {
    const at = bar({ label: "Workspace", icon: "people", description: "Everyone in the workspace can open this app." });
    expect(at.querySelector("style")?.textContent).toContain(".graview-bar-status[data-icon]>.graview-bar-status-words{position:absolute;width:1px");
    act(() => root?.unmount());
    const plain = bar({ label: "Workspace", description: "Everyone in the workspace can open this app." });
    expect(plain.querySelector('[data-testid="app-status"]')?.hasAttribute("data-icon")).toBe(false);
  });

  it("is not drawn when the host gives none", () => {
    expect(bar().querySelector('[data-testid="app-status"]')).toBeNull();
  });
});
