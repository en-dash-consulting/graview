import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scaffoldProject } from "../../src/scaffold/index.js";

/**
 * THE DOCUMENT PATH IS TAUGHT WHERE THE TYPESCRIPT ONE IS. An agent that
 * writes its app as one JSON document — `app.json`, a graview-document —
 * reads what `graview create` wrote and the authoring skills it installed,
 * and found only `defineNode` and `defineApp` there. Each now says where the
 * document's schema is and the three commands that judge and show one.
 */
// As prose reads, whatever the line it wraps at.
const skill = (name: string) => readFileSync(new URL(`../../../skills/skills/${name}/SKILL.md`, import.meta.url), "utf8").replace(/\s+/g, " ");

describe("the scaffold and the skills teach the document path", () => {
  it("says it in the AGENTS.md a new project opens with: the format, its schema, check, describe and preview", () => {
    for (const workspace of [false, true]) {
      const notes = scaffoldProject({ name: "Field Notes", kind: "note", ...(workspace ? { workspace: true } : {}) }).files.find((file) => file.path === "AGENTS.md")!.contents;
      expect(notes).toContain("graview-document");
      expect(notes).toContain("node_modules/@graview/core/dist/document.schema.json");
      expect(notes).toContain("graview check --document app.json");
      expect(notes).toContain("graview describe --document app.json");
      expect(notes).toContain("graview preview app.json --seed seed.json");
    }
  });

  it("says it in the new-app skill: the format, its schema, check, describe and preview", () => {
    const text = skill("graview-new-app");
    for (const said of ["graview-document", "@graview/core/dist/document.schema.json", "graview check --document app.json", "graview describe --document app.json", "graview preview app.json --seed seed.json"]) expect(text).toContain(said);
  });

  it("says a kind, a rule and a seed in the document's own words", () => {
    expect(skill("graview-node-kind")).toContain("document.schema.json");
    expect(skill("graview-node-kind")).toContain("graview check --document app.json");
    expect(skill("graview-invariant")).toContain('"repairs": [{ "act":');
    expect(skill("graview-invariant")).toContain("graview check --document");
    expect(skill("graview-seed")).toContain("graview preview app.json --seed seed.json");
    expect(skill("graview-seed")).toContain("describe --document app.json");
  });
});
