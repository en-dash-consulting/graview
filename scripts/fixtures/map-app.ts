/**
 * AN ARCHITECTURE MAP (0.1.42), in the shape of TrueNorth's recon app: the
 * zones of a codebase and what each depends on. Its map is the
 * graview-worker-view skill's worked example, a worker view that pans and
 * zooms an SVG's viewBox by the wheel, a pinch and a drag
 * (`gestures: true`): a test and the harness read the skill's own file
 * (`MAP_EXAMPLE`), so the example and what they drive are one script.
 */
import type { AnySchema, GraviewApp, Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";

export const mapDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Recon",
  description: "The zones of a codebase and what each depends on, drawn as a map to find a way around.",
  roles: ["engineer"],
  policy: { grants: [{ roles: ["engineer"], mutations: "*" }] },
  kinds: {
    zone: {
      noun: "zone",
      plural: "zones",
      description: "A part of the codebase that changes together.",
      fields: { name: { type: "string", required: true } },
      edges: { dependsOn: { to: ["zone"], description: "a zone it imports from" } },
    },
  },
  acts: { "add-zone": { title: "Add a zone", creates: "zone" } },
};

const compiled = compileDocument(mapDocument);
if (!compiled.ok) throw new Error(`the map compiles: ${JSON.stringify(compiled.findings.filter((one) => one.severity === "error"))}`);
export const mapApp = compiled.app as GraviewApp<AnySchema>;

export const mapSeed = {
  nodes: ["core", "layout", "render", "tools", "pages", "ship"].map((name) => ({ id: `zone:${name}`, kind: "zone", name })),
  edges: [
    { kind: "dependsOn", from: "zone:layout", to: "zone:core" },
    { kind: "dependsOn", from: "zone:render", to: "zone:layout" },
    { kind: "dependsOn", from: "zone:tools", to: "zone:core" },
    { kind: "dependsOn", from: "zone:pages", to: "zone:tools" },
    { kind: "dependsOn", from: "zone:ship", to: "zone:core" },
  ],
};

export const ada: Principal = { kind: "human", id: "person:ada", roles: ["engineer"] };

/** Where the skill's worked map is, from the repository's root. */
export const MAP_EXAMPLE = "packages/skills/skills/graview-worker-view/examples/a-map-that-pans-and-zooms.js";

/** The manifest a worked example opens with, read off its comment. */
export function manifestOf(source: string): Record<string, unknown> {
  return Function(`return (${/manifest: (\{[\s\S]*?\n\/\/ \})/.exec(source)![1]!.replace(/^\/\/ ?/gm, "")});`)() as Record<string, unknown>;
}
