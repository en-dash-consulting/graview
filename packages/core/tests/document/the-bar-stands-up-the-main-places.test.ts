import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";
import { createSchema, defineNode, MOST_STANDING, primaryOf, supportingKinds, z } from "../../src/index.js";

/**
 * THE BAR STANDS UP THE MAIN PLACES (FR-145, ranked).
 *
 * Nick, on the todo app's pages: ten words of equal weight on the bar —
 * Home, Lists, Tasks, Rules, Reasons, People, Invitations and three
 * pictures. The main kinds and their pictures stand; what supports them
 * folds into "More". A declaration says which with `pages.primary`, and
 * when it says nothing the framework works it out from the declaration.
 */
const list = defineNode("list", { fields: z.object({ label: z.string() }), edges: { holds: { to: ["task"] } } });
const task = defineNode("task", { fields: z.object({ label: z.string() }), edges: { waitsFor: { to: ["task"] } } });
const reason = defineNode("reason", { fields: z.object({ text: z.string() }), edges: { explains: { to: ["task", "list"] } } });
const rule = defineNode("rule", { fields: z.object({ label: z.string() }) });
const user = defineNode("user", { fields: z.object({ label: z.string() }) });
const schema = createSchema([list, task, reason, rule, user]);

describe("the kinds that support the others", () => {
  it("are a note about several kinds that nothing points at, a kind the home leaves off, and a module's kept for its keepers", () => {
    const supporting = supportingKinds(schema, { hide: ["rule"] }, ["user"]);
    expect([...supporting].sort()).toEqual(["reason", "rule", "user"]);
  });

  it("are never a kind something else points at, nor one whose ties name one kind each", () => {
    const supporting = supportingKinds(schema, undefined);
    expect(supporting.has("list")).toBe(false);
    expect(supporting.has("task")).toBe(false);
    // A kind with no ties at all is a main kind until the declaration says otherwise.
    expect(supporting.has("rule")).toBe(false);
  });
});

describe("pages.primary", () => {
  const places = [{ kind: "task", title: "The week", as: "the-week" }];

  it("names kinds by name or plural and pictures by title", () => {
    const said = primaryOf({ primary: ["list", "tasks", "The week"] }, schema, places as never);
    expect([...said!.kinds].sort()).toEqual(["list", "task"]);
    expect([...said!.places]).toEqual(["task|the-week"]);
    expect(primaryOf(undefined, schema, places as never)).toBeUndefined();
    expect(MOST_STANDING).toBe(6);
  });

  const document = JSON.parse(readFileSync(new URL("./fixtures/every-lens.gdd.json", import.meta.url), "utf8"));
  it("is a document's key too, and graview check says what it names that is not there", () => {
    const result = compileDocument({ ...document, pages: { primary: ["volunteer", "ghost", "home"] } }, { today: () => "2026-09-01" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.app.pages?.primary).toEqual(["volunteer", "ghost", "home"]);
    expect(result.findings.filter((finding) => finding.code === "check:pages-primary-unknown").map((finding) => finding.path)).toEqual(["pages.primary.1", "pages.primary.2"]);
  });

  it("is set by arrange-pages, which refuses a word that names nothing, and says what it did", () => {
    const changed = editDocument(document, [{ op: "arrange-pages", primary: ["volunteer", "The floor"] }]);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect((changed.document.pages as { primary?: unknown }).primary).toEqual(["volunteer", "The floor"]);
    expect(changed.said.join(" ")).toContain("beside Home");
    expect(editDocument(document, [{ op: "arrange-pages", primary: ["ghost"] }]).ok).toBe(false);
  });
});
