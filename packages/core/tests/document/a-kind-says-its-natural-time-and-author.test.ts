import { describe, expect, it } from "vitest";
import { checkApp, compileDocument } from "../../src/check.js";
import { describeApp } from "../../src/check.js";
import { diffDocuments, editDocument, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { createSchema, defineApp, defineNode, isoDate, readableFields, Store, z } from "../../src/index.js";
import { describePlace, resolveFor } from "../../src/describe.js";

/**
 * A KIND CAN SAY WHICH FIELD IS ITS NATURAL TIME AND WHICH ITS AUTHOR.
 * `fieldRoles` was not a document key at 0.1.20, so n-dx could not declare a
 * commit's `committedAt` its time nor its `author` who made it: commits had
 * no declared order, and the Runs timeline bound its date in the lens. A
 * kind's `fieldRoles` — `when` and `who`, and any role a lens binds — is in
 * the document as in `defineNode`; a list opens newest first by `when`, a
 * glance leads with `who` and `when`, a timeline or calendar that binds no
 * start draws at `when`; and `graview check` refuses a role naming no field,
 * a `when` that is no date and a `who` that is no name.
 */
const document = (roles: Record<string, string> = { when: "committedAt", who: "author" }, patch: Record<string, unknown> = {}): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "History",
    kinds: {
      commit: {
        fields: {
          sha: { type: "string", required: true },
          subject: { type: "string" },
          author: { type: "string" },
          committedAt: { type: "datetime" },
          lines: { type: "integer" },
          reverted: { type: "boolean" },
        },
        label: "{subject}",
        fieldRoles: roles,
      },
    },
    ...patch,
  }) as unknown as GraviewDocument;

const codes = (doc: GraviewDocument) => compileDocument(doc).findings.filter((f) => f.severity === "error").map((f) => `${f.code}:${f.path}`);

describe("a document kind's field roles", () => {
  it("are the compiled definition's fieldRoles, as defineNode's are", () => {
    const compiled = compileDocument(document());
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    expect(compiled.app.schema.tryDefinition("commit")?.fieldRoles).toEqual({ when: "committedAt", who: "author" });
  });

  it("lead an unchosen glance with who made the record and when, before the fields as declared", () => {
    const compiled = compileDocument(document());
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const definition = compiled.app.schema.tryDefinition("commit");
    const commit = { id: "c1", kind: "commit", sha: "ab12", subject: "Ship it", author: "Nick Daniel", committedAt: "2026-10-09T12:00:00Z", lines: 40 };
    expect(readableFields(commit, definition, { glance: true, limit: 3, said: ["Ship it"] }).map((field) => field.key)).toEqual(["author", "committedAt", "sha"]);
  });

  it("lead the glance of a record a block lists, as resolveFor resolves it and the describer says it", () => {
    const compiled = compileDocument(document(undefined, { views: { home: [{ list: "all('commit')", as: "card" }] } }));
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const store = new Store({ schema: compiled.app.schema, mutations: [], snapshot: { nodes: [{ id: "c1", kind: "commit", sha: "ab12", subject: "Ship it", author: "Nick Daniel", committedAt: "2026-10-09T12:00:00Z", lines: 40 }], edges: [] } as never });
    // The list resolves its members; what each card says is said as every face draws it, the describer's words.
    expect(JSON.stringify(resolveFor(store, null, null, { app: compiled.app }))).toContain('"author":"Nick Daniel"');
    const described = describePlace(store, { kind: "system" }, "home", { app: compiled.app });
    if (!described.ok) throw new Error(described.error);
    const said = described.description.text;
    expect(said.indexOf("Nick Daniel")).toBeGreaterThan(-1);
    expect(said.indexOf("Nick Daniel")).toBeLessThan(said.indexOf("ab12"));
  });

  it("are refused when they name no field, a `when` that is no date, or a `who` that is no name", () => {
    expect(codes(document({ when: "landedAt" }))).toEqual(["field-role-missing-field:kinds.commit.fieldRoles.when"]);
    expect(codes(document({ when: "lines" }))).toEqual(["field-role-ill-typed:kinds.commit.fieldRoles.when"]);
    expect(codes(document({ who: "reverted" }))).toEqual(["field-role-ill-typed:kinds.commit.fieldRoles.who"]);
    const said = compileDocument(document({ when: "lines" })).findings.find((f) => f.code === "field-role-ill-typed")!;
    expect(said.message).toBe(`commit's "when" is its natural time, which is a date, or a date and time, and "lines" is an integer field`);
    // A lens's own role names a field, whatever it holds.
    expect(codes(document({ when: "committedAt", column: "reverted" }))).toEqual([]);
  });

  it("are said once each by describe", () => {
    const compiled = compileDocument(document());
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    expect(describeApp(compiled.app)).toContain("commit: when is committedAt, who is author");
  });

  it("follow a renamed field, let go of a removed one, and are said by a diff only when a role moves", () => {
    const renamed = editDocument(document(), [{ op: "rename-field", kind: "commit", field: "committedAt", to: "at" }]);
    if (!renamed.ok) throw new Error(JSON.stringify(renamed.findings));
    expect(renamed.document.kinds["commit"]!.fieldRoles).toEqual({ when: "at", who: "author" });
    expect(diffDocuments(document(), renamed.document).sentences.join(" ")).not.toContain("its time");
    const removed = editDocument(document(), [{ op: "remove-field", kind: "commit", field: "author" }]);
    if (!removed.ok) throw new Error(JSON.stringify(removed.findings));
    expect(removed.document.kinds["commit"]!.fieldRoles).toEqual({ when: "committedAt" });
    expect(diffDocuments(document(), document({ when: "committedAt", who: "subject" })).sentences).toContain("Which of a commit's fields is its time, its author or a lens's role changes.");
  });

  it("let a timeline or calendar that binds no start stand on the kind's natural time", () => {
    const withLens = (roles: Record<string, string>) => document(roles, { lenses: [{ name: "calendar", title: "When it landed", bindings: { commit: {} } }] });
    expect(codes(withLens({ when: "committedAt" }))).toEqual([]);
    const unbound = compileDocument(withLens({ who: "author" }));
    expect(unbound.findings.map((f) => f.code)).toContain("check:lens-role-unbound");
    expect(unbound.findings.find((f) => f.code === "check:lens-role-unbound")!.fix).toContain('fieldRoles: { when: "<field name>" }');
  });

  it("come back from a TypeScript declaration, and are held to the same words there", () => {
    const run = defineNode("run", {
      fields: z.object({ title: z.string(), startedAt: isoDate, tokens: z.number(), vendor: z.enum(["claude", "codex"]) }),
      fieldRoles: { when: "startedAt", who: "vendor" },
    });
    const { document: written } = toDocument(defineApp({ name: "Runs", schema: createSchema([run]) }));
    expect(written.kinds["run"]!.fieldRoles).toEqual({ when: "startedAt", who: "vendor" });
    const wrong = defineNode("run", { fields: z.object({ title: z.string(), tokens: z.number() }), fieldRoles: { when: "tokens", who: "nobody" } });
    const found = checkApp(defineApp({ name: "Runs", schema: createSchema([wrong]) })).findings.map((f) => `${f.code}:${f.where}`);
    expect(found).toContain('field-role-ill-typed:defineNode("run").fieldRoles.when');
    expect(found).toContain('field-role-missing-field:defineNode("run").fieldRoles.who');
  });
});
