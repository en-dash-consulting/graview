import { describe, expect, it } from "vitest";
import { checkKitContrast, connectorKitFor, DARK, DEFAULT_KIT, kitVariables, LIGHT, resolveKit } from "../../src/index.js";

/*
 * The kit is declared, so a brand can set any part of it and the rest is as
 * shipped; the theme turns it into custom properties; and its colors are
 * held to a contrast like the text's.
 */
describe("the kit", () => {
  it("is whole with nothing said, and a brand's part lands over the default", () => {
    expect(resolveKit()).toBe(DEFAULT_KIT);
    const kit = resolveKit({ connectors: { all: { route: "orthogonal" }, byEdge: { "tended-by": { color: "#b04a2f", visible: true } } }, grid: { visible: false } });
    expect(kit.connectors.all).toEqual({ route: "orthogonal", visible: true });
    expect(kit.grid).toEqual({ visible: false, size: 64 });
    expect(kit.lattice).toEqual(DEFAULT_KIT.lattice);
    expect(connectorKitFor(kit, "tended-by")).toMatchObject({ route: "orthogonal", color: "#b04a2f" });
    expect(connectorKitFor(kit, "grows-in")).toEqual({ route: "orthogonal", visible: true });
  });

  it("becomes custom properties the theme's rules read: a display for the tags, a multiplier for the grid", () => {
    const css = kitVariables(resolveKit({ tags: { visible: false }, grid: { size: 48 } }));
    expect(css).toContain("--graview-kit-tags: none;");
    expect(css).toContain("--graview-kit-grid: 1;");
    expect(css).toContain("--graview-kit-grid-size: 48px;");
    expect(css).toContain("--graview-kit-lattice: 1;");
    expect(css).toContain('--graview-kit-flag: "⚠";');
  });

  it("holds an explicit connector color to 3:1 against both grounds, and says which edge kind", () => {
    const light = LIGHT;
    const faint = resolveKit({ connectors: { byEdge: { "tended-by": { color: "#f4f4f4" } } } });
    const findings = checkKitContrast(faint, light);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]).toMatchObject({ edgeKind: "tended-by", requires: 3 });
    expect(checkKitContrast(resolveKit({ connectors: { byEdge: { "tended-by": { color: "#1d3f8a" } } } }), light)).toEqual([]);
    expect(checkKitContrast(resolveKit({ connectors: { all: { color: "not a color" } } }), light)[0]?.unreadable).toBe("not a color");
  });
});

import { createSchema, defineApp, defineNode } from "../../src/index.js";
import { checkApp } from "../../src/check.js";
import { z } from "zod";

describe("graview check holds the kit's colors to the ground", () => {
  const schema = createSchema([defineNode("thing", { fields: z.object({ label: z.string() }) })]);
  const brand = { name: "Acme", schemes: { dark: DARK, light: LIGHT } };

  it("names the edge kind, the scheme and the fix when a line would vanish into the ground", () => {
    const app = defineApp({ name: "faint", schema, brand: { ...brand, kit: { connectors: { byEdge: { "tended-by": { color: "#f4f4f4" } } } } } });
    const findings = checkApp(app).findings.filter((f) => f.code === "kit-contrast-below-aa");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.where).toContain("brand.kit.connectors.byEdge.tended-by.color");
    expect(findings[0]!.where).toMatch(/in (light|dark)$/);
    expect(findings[0]!.severity).toBe("error");
    expect(findings[0]!.fix).toContain("kind's own hue");
    // Two failures in one scheme say which ground each is, not "the ground" twice (W-116).
    const light = findings.filter((f) => f.where.endsWith("in light")).map((f) => f.message);
    expect(new Set(light).size).toBe(light.length);
    expect(light.some((message) => message.includes("deep ground"))).toBe(true);
  });

  it("warns once about a color it cannot read, and is clean for a kit that only routes and hides", () => {
    const unreadable = defineApp({ name: "odd", schema, brand: { ...brand, kit: { connectors: { all: { color: "mauve-ish" } } } } });
    expect(checkApp(unreadable).findings.filter((f) => f.code === "kit-color-unreadable")).toHaveLength(1);
    const quiet = defineApp({ name: "quiet", schema, brand: { ...brand, kit: { connectors: { all: { route: "orthogonal" }, byEdge: { x: { visible: false } } }, grid: { visible: false } } } });
    expect(checkApp(quiet).findings.filter((f) => f.code.startsWith("kit-"))).toEqual([]);
  });
});
