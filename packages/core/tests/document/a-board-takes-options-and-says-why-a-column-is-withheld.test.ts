import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GraviewDocument } from "../../src/document/index.js";
import { editDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";
import { declaredLenses, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { columnChoices } from "../../src/describe.js";

/**
 * A BOARD MOVES WITHOUT BUTTONS, AND TAKES ITS OPTIONS AS DATA (Roadmap
 * f-board-move-without-buttons, f-lens-search-filter).
 *
 * The card's menu says "Move to ›" with every other column: the ones this
 * seat may move it to, and the ones withheld, each with the reason a press
 * would have met. And a declared board takes `search`, `filters`, `move`,
 * `collapsed`, `cap` and `hidden` — through `add-lens` as through the
 * declaration — each held to what the kind has, a stray said and left out.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as GraviewDocument;
const vendors = read("vendor-steps.gdd.json");
const tasks = read("tasks.gdd.json");

function compiled(doc: unknown): { app: GraviewApp<AnySchema>; findings: readonly { code: string; path: string; severity: string }[] } {
  const result = compileDocument(doc, { today: () => "2026-10-06" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return { app: result.app as GraviewApp<AnySchema>, findings: result.findings.map((f) => ({ ...f, code: f.code.replace(/^check:/, "") })) };
}

const OWNER: Principal = { kind: "human", id: "o1", roles: ["owner"] };
const VIEWER: Principal = { kind: "human", id: "v1", roles: ["viewer"] };

describe("the columns a card could go to, for one seat", () => {
  const { app } = compiled(vendors);
  const store = new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: { nodes: [{ id: "v-out", kind: "vendor", name: "Petal Pushers", status: "declined" }], edges: [] } as never,
  });
  const card = store.graph.getNode("v-out") as never;

  it("offers the move where the step's condition holds, and strikes the others with the step's own refusal or that nothing reaches them", () => {
    const choices = columnChoices(store, OWNER, card, "status");
    expect(choices.map((choice) => [choice.to, choice.move?.call.name ?? null])).toEqual([
      ["researching", null],
      ["contacted", "reopen"],
      ["booked", null],
    ]);
    expect(choices[0]?.why).toBe("Nothing in this app moves a vendor to Researching.");
    expect(choices[2]?.why).toContain("Petal Pushers was declined; reopen them first");
  });

  it("withholds every column from a viewer, with the policy's words", () => {
    const choices = columnChoices(store, VIEWER, card, "status");
    expect(choices.every((choice) => choice.move === undefined && typeof choice.why === "string" && choice.why.length > 0)).toBe(true);
    expect(choices.find((choice) => choice.to === "contacted")?.why).not.toContain("Nothing in this app");
  });
});

describe("a declared board's options", () => {
  const withOptions = (options: Record<string, unknown>) => ({ ...tasks, lenses: [{ name: "columns", title: "The board", bindings: { task: { column: "status" } }, options }] });

  it("hands the board search, filters, move, collapsed, cap and hidden, with nothing to say", () => {
    const options = { search: ["label", "due"], filters: ["status", "assigned-to"], move: true, collapsed: ["done"], cap: 5, hidden: ["todo"] };
    const { app, findings } = compiled(withOptions(options));
    expect(findings.filter((f) => f.code.startsWith("lens-"))).toEqual([]);
    expect(declaredLenses(app).drawn[0]?.options).toMatchObject(options);
  });

  it("says a field the kind lacks, a column the field lacks and a cap that is not a count, and leaves each out", () => {
    const { app, findings } = compiled(withOptions({ search: ["label", "colour"], collapsed: ["later"], cap: 0, move: "yes" }));
    expect(findings.filter((f) => f.code === "lens-option").map((f) => f.path).sort()).toEqual(["lenses.0.options.cap", "lenses.0.options.collapsed", "lenses.0.options.move", "lenses.0.options.search"]);
    const drawn = declaredLenses(app).drawn[0]!.options;
    expect(drawn["search"]).toEqual(["label"]);
    expect(drawn["collapsed"]).toBeUndefined();
    expect(drawn["cap"]).toBeUndefined();
    expect(drawn["move"]).toBeUndefined();
  });

  it("takes them through add-lens, and refuses a column the field does not have", () => {
    const { lenses: _none, pages: _first, ...bare } = tasks as GraviewDocument & { lenses?: unknown; pages?: unknown };
    const added = editDocument(bare as GraviewDocument, [{ op: "add-lens", title: "Work", lens: "columns", bindings: { task: { column: "status" } }, options: { search: ["label"], filters: ["status"], collapsed: ["done"], cap: 10 } }]);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(declaredLenses(compiled(added.document).app).drawn[0]?.options).toMatchObject({ search: ["label"], filters: ["status"], collapsed: ["done"], cap: 10 });
    const refused = editDocument(bare as GraviewDocument, [{ op: "add-lens", title: "Work", lens: "columns", bindings: { task: { column: "status" } }, options: { hidden: ["later"] } }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings[0]?.path).toBe("edits.0.options.hidden");
  });

  it("keeps a renamed field in what Find looks in and what the chips filter by", () => {
    const start = withOptions({ search: ["label", "due"], filters: ["due"] }) as GraviewDocument;
    const renamed = editDocument(start, [{ op: "rename-field", kind: "task", field: "due", to: "deadline" }]);
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect((renamed.document.lenses as { options?: Record<string, unknown> }[])[0]?.options).toMatchObject({ search: ["label", "deadline"], filters: ["deadline"] });
  });
});
