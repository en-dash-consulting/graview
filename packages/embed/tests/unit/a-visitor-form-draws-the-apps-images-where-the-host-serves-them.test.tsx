// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnySchema, GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { useHostAssets } from "@graview/react/provider";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A VISITOR'S FORM DRAWS THE APP'S IMAGES WHERE THE HOST SERVES THEM (Roadmap
 * f-framework-small-fixes-0-1-66). Since 0.1.64 every mount takes
 * `assetsAt`, where a host serving each app under a base answers a path
 * under `/graview/assets/`; `@graview/embed/form` had no such option, so
 * an image the form drew by path was asked for on the host's root.
 */
vi.mock("@graview/pages/visitor-form", () => ({
  // What the form draws by path, as anything under it would: through the host's `assetsAt`.
  VisitorFormPage: () => {
    const at = useHostAssets();
    return <img data-testid="drawn" src={at ? at("/graview/assets/mark.svg") : "/graview/assets/mark.svg"} alt="" />;
  },
}));
const { mount } = await import("../../src/form.js");

const rsvp = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/rsvp.gdd.json"), "utf8"));
const compiled = compileDocument(rsvp);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;
const seed = { nodes: [], edges: [] };

let unmount: (() => void) | undefined;
afterEach(async () => {
  await act(async () => unmount?.());
  document.body.innerHTML = "";
});

describe("a visitor's form", () => {
  it("draws a path under /graview/assets/ at the host's assetsAt, and as named without one", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const first = mount(host, { app, form: "rsvp", principal: "form:t1", seed, fonts: false, assetsAt: (path) => `/a/wedding${path}` });
    unmount = first.unmount;
    expect(host.querySelector("[data-testid=drawn]")?.getAttribute("src")).toBe("/a/wedding/graview/assets/mark.svg");
    await act(async () => first.unmount());
    const second = mount(host, { app, form: "rsvp", principal: "form:t2", seed, fonts: false });
    unmount = second.unmount;
    expect(host.querySelector("[data-testid=drawn]")?.getAttribute("src")).toBe("/graview/assets/mark.svg");
  });
});
