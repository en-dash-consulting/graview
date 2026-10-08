import { describe, expect, it } from "vitest";
import { describePlace } from "../../src/describe.js";
import { createSchema, defineApp, defineNode, pageSections, readableFields, Store, z, type AnySchema, type Principal } from "../../src/index.js";
import { compileDocumentWithoutCheck, diffDocuments, editDocument, EDIT_OPS, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * A RECORD'S PAGE ORDERS ITS FACTS AS THE KIND DECLARES THEM, AND CAN BE
 * TOLD OTHERWISE (FR-148).
 *
 * Graview Cloud's workshop: a deliverable declared due, name, status,
 * summary, subject, draft, its record written status, summary, due and
 * then given its draft and subject — and its page read Status, Summary,
 * Due, Draft, Subject line: the order the record's keys were written in.
 * Nothing could set it. `kinds.<kind>.page` (the definition's
 * `display.page`) can, and `set-page-fields` is the edit that sets it.
 */
const workshop = {
  format: "graview-document",
  formatVersion: 1,
  name: "Workshop",
  kinds: {
    deliverable: {
      fields: {
        due: { type: "date" },
        name: { type: "string", required: true },
        status: { type: "enum", options: ["drafting", "sent"], required: true, default: "drafting" },
        summary: { type: "string" },
        subject: { type: "string", label: "Subject line" },
        draft: { type: "text" },
      },
    },
  },
} as unknown as GraviewDocument;

/** The record as Cloud wrote it: three fields, then two more. */
const email = { id: "email", kind: "deliverable", status: "drafting", summary: "The follow-up", due: "2026-10-28", draft: "Hi Todd,\n\nThank you.", subject: "What we agreed", name: "Email to Todd" };

function definitionOf(document: GraviewDocument) {
  const compiled = compileDocumentWithoutCheck(document);
  if (!compiled.ok) throw new Error(compiled.findings.map((finding) => finding.message).join("; "));
  return compiled.app.schema.tryDefinition("deliverable");
}

describe("a record's facts, in order", () => {
  it("follow the kind's declared order, not the order the record was written in", () => {
    expect(readableFields(email, definitionOf(workshop)).map((field) => field.key)).toEqual(["due", "name", "status", "summary", "subject", "draft"]);
  });

  it("follow the kind's page when it says one: its fields first, then each group, the rest under Details", () => {
    const paged = { ...workshop, kinds: { deliverable: { ...workshop.kinds["deliverable"]!, page: { fields: ["subject", "draft"], groups: [{ title: "Schedule", fields: ["due", "status"] }] } } } } as GraviewDocument;
    const definition = definitionOf(paged);
    const fields = readableFields(email, definition);
    expect(fields.map((field) => field.key)).toEqual(["subject", "draft", "due", "status", "name", "summary"]);
    expect(pageSections(definition, fields).map((section) => [section.title ?? null, section.fields.map((field) => field.key)])).toEqual([
      [null, ["subject", "draft"]],
      ["Schedule", ["due", "status"]],
      ["Details", ["name", "summary"]],
    ]);
  });

  it("without groups, the rest follow the first fields in declared order, in one section", () => {
    const paged = { ...workshop, kinds: { deliverable: { ...workshop.kinds["deliverable"]!, page: { fields: ["subject", "draft"] } } } } as GraviewDocument;
    const definition = definitionOf(paged);
    const sections = pageSections(definition, readableFields(email, definition));
    expect(sections).toHaveLength(1);
    expect(sections[0]!.fields.map((field) => field.key)).toEqual(["subject", "draft", "due", "name", "status", "summary"]);
  });

  it("a glance is not a page: what a glance says is still the glance's choice", () => {
    const glanced = { ...workshop, kinds: { deliverable: { ...workshop.kinds["deliverable"]!, glance: ["subject"], page: { fields: ["draft"] } } } } as GraviewDocument;
    expect(readableFields(email, definitionOf(glanced), { glance: true, limit: 2 }).map((field) => field.key)).toEqual(["subject", "due"]);
  });

  it("a page naming a field the kind does not have, or one twice, does not compile", () => {
    const unknown = { ...workshop, kinds: { deliverable: { ...workshop.kinds["deliverable"]!, page: { fields: ["subject", "body"] } } } } as GraviewDocument;
    const findings = compileDocumentWithoutCheck(unknown);
    expect(findings.ok).toBe(false);
    if (findings.ok) return;
    expect(findings.findings[0]).toMatchObject({ code: "page-field", path: "kinds.deliverable.page.fields.1" });
    expect(findings.findings[0]!.message).toMatch(/"body"/);
    const twice = { ...workshop, kinds: { deliverable: { ...workshop.kinds["deliverable"]!, page: { fields: ["subject"], groups: [{ title: "Email", fields: ["subject"] }] } } } } as GraviewDocument;
    const again = compileDocumentWithoutCheck(twice);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.findings[0]!.code).toBe("page-field-twice");
  });

  it("describePlace reads a record's facts in the page's order, each group under its title", () => {
    const paged = { ...workshop, kinds: { deliverable: { ...workshop.kinds["deliverable"]!, page: { fields: ["subject", "draft"], groups: [{ title: "Schedule", fields: ["due"] }] } } } } as GraviewDocument;
    const compiled = compileDocument(paged);
    if (!compiled.ok) throw new Error("did not compile");
    const app = compiled.app;
    const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
    const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [email], edges: [] } as never });
    const said = describePlace(store, owner, "email", { app, today: "2026-10-08" });
    if (!said.ok) throw new Error(said.error);
    const parts = said.description.parts.filter((part) => part.t === "field" || part.t === "heading").map((part) => (part.t === "field" ? part.label : `# ${part.text}`));
    expect(parts).toEqual(["Subject line", "Draft", "# Schedule", "Due", "# Details", "Status", "Summary"]);
    // The draft is said as it is stored: its paragraphs kept.
    expect(said.description.parts.find((part) => part.t === "field" && part.label === "Draft")).toMatchObject({ text: "Hi Todd,\n\nThank you." });
  });
});

describe("set-page-fields", () => {
  it("is one of the edits Graview knows", () => {
    expect(EDIT_OPS).toContain("set-page-fields");
  });

  it("sets the kind's page, says it in words, and the diff says it too", () => {
    const outcome = editDocument(workshop, [{ op: "set-page-fields", kind: "deliverable", fields: ["subject", "draft"], groups: [{ title: "Schedule", fields: ["due", "status"] }] }]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.document.kinds["deliverable"]!.page).toEqual({ fields: ["subject", "draft"], groups: [{ title: "Schedule", fields: ["due", "status"] }] });
    expect(outcome.said.join(" ")).toBe(`A deliverable's page shows subject and draft first and due and status under "Schedule", and the rest under "Details".`);
    expect(diffDocuments(workshop, outcome.document).sentences).toContain("How a deliverable's page orders its facts changes.");
    expect(compileDocument(outcome.document).ok).toBe(true);
  });

  it("empty takes the choice away: the declared order again", () => {
    const set = editDocument(workshop, [{ op: "set-page-fields", kind: "deliverable", fields: ["draft"] }]);
    if (!set.ok) throw new Error("refused");
    const cleared = editDocument(set.document, [{ op: "set-page-fields", kind: "deliverable", fields: [], groups: null }]);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect("page" in cleared.document.kinds["deliverable"]!).toBe(false);
    expect(cleared.said.join(" ")).toMatch(/in the order the kind declares them/);
  });

  it("a field the kind does not have is refused by name, at its place, with the ones it has", () => {
    const outcome = editDocument(workshop, [{ op: "set-page-fields", kind: "deliverable", fields: ["subject"], groups: [{ title: "Body", fields: ["body"] }] }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]!.path).toBe("edits.0.groups.0.fields.0");
    expect(outcome.findings[0]!.message).toMatch(/"body"/);
    expect(outcome.findings[0]!.fix).toMatch(/draft/);
  });

  it("a name twice, two groups of one title, a kind the app does not have and an unknown key are refused", () => {
    expect(editDocument(workshop, [{ op: "set-page-fields", kind: "deliverable", fields: ["draft", "draft"] }]).ok).toBe(false);
    expect(editDocument(workshop, [{ op: "set-page-fields", kind: "deliverable", fields: [], groups: [{ title: "A", fields: ["due"] }, { title: "a", fields: ["status"] }] }]).ok).toBe(false);
    expect(editDocument(workshop, [{ op: "set-page-fields", kind: "venue", fields: ["name"] }]).ok).toBe(false);
    expect(editDocument(workshop, [{ op: "set-page-fields", kind: "deliverable", fields: ["draft"], order: [] }]).ok).toBe(false);
  });

  it("follows a field renamed, and lets one removed go", () => {
    const set = editDocument(workshop, [{ op: "set-page-fields", kind: "deliverable", fields: ["subject", "draft"], groups: [{ title: "Schedule", fields: ["due"] }] }]);
    if (!set.ok) throw new Error("refused");
    const renamed = editDocument(set.document, [{ op: "rename-field", kind: "deliverable", field: "draft", to: "body" }]);
    if (!renamed.ok) throw new Error("rename refused");
    expect(renamed.document.kinds["deliverable"]!.page).toEqual({ fields: ["subject", "body"], groups: [{ title: "Schedule", fields: ["due"] }] });
    expect(renamed.said.join(" ")).toMatch(/deliverable's page/);
    const removed = editDocument(renamed.document, [{ op: "remove-field", kind: "deliverable", field: "due" }]);
    if (!removed.ok) throw new Error("remove refused");
    expect(removed.document.kinds["deliverable"]!.page).toEqual({ fields: ["subject", "body"] });
  });

  it("is what a TypeScript declaration's display.page says, written as a document", () => {
    const deliverable = defineNode("deliverable", {
      fields: z.object({ name: z.string(), subject: z.string().optional(), draft: z.string().max(20_000).optional(), due: z.string().optional() }),
      display: { page: { fields: ["subject", "draft"], groups: [{ title: "Schedule", fields: ["due"] }] } },
    });
    const { document } = toDocument(defineApp({ name: "Workshop", schema: createSchema([deliverable]) }));
    expect(document.kinds["deliverable"]!.page).toEqual({ fields: ["subject", "draft"], groups: [{ title: "Schedule", fields: ["due"] }] });
  });
});
