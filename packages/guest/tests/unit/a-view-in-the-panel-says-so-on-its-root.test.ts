// @vitest-environment jsdom
import { sanitizeStylesheet } from "@graview/core/css";
import { describe, expect, it } from "vitest";
import { followInPanel, IN_PANEL } from "../../src/host/in-panel.js";

const settle = () => new Promise((done) => setTimeout(done, 0));

describe("a worker view drawn on the one face's panel says so on its own root, and not on a full page", () => {
  it("carries data-graview-in-panel from the page onto the view's root as the page moves into the panel and out", async () => {
    const page = document.createElement("div");
    const region = document.createElement("div");
    page.append(region);
    document.body.append(page);
    const shadow = region.attachShadow({ mode: "open" });
    const root = document.createElement("div");
    root.setAttribute("data-graview-view-root", "");
    shadow.append(root);
    const stop = followInPanel(region, () => shadow.querySelector("[data-graview-view-root]"));
    expect(root.hasAttribute(IN_PANEL)).toBe(false);
    page.setAttribute(IN_PANEL, "");
    await settle();
    expect(root.hasAttribute(IN_PANEL)).toBe(true);
    page.removeAttribute(IN_PANEL);
    await settle();
    expect(root.hasAttribute(IN_PANEL)).toBe(false);
    stop();
    page.setAttribute(IN_PANEL, "");
    await settle();
    expect(root.hasAttribute(IN_PANEL)).toBe(false);
    page.remove();
  });

  it("is said at once when the view is drawn inside the panel already", () => {
    const page = document.createElement("div");
    page.setAttribute(IN_PANEL, "");
    const region = document.createElement("div");
    page.append(region);
    document.body.append(page);
    const root = document.createElement("div");
    region.attachShadow({ mode: "open" }).append(root);
    const stop = followInPanel(region, () => root);
    expect(root.hasAttribute(IN_PANEL)).toBe(true);
    stop();
    page.remove();
  });

  it("is a word a view's stylesheet may read, beside a container query on its own width", () => {
    const css = "[data-graview-in-panel] .card { padding: 12px; } .wrap { container-type: inline-size; } @container (max-width: 480px) { .card { padding: 8px; } }";
    const kept = sanitizeStylesheet(css).css;
    expect(kept).toContain("[data-graview-in-panel]");
    expect(kept).toContain("@container");
  });
});
