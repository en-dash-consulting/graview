import { createSchema, defineApp, defineNode, markdownField } from "@graview/core";
import { compileDocumentWithoutCheck, editDocument, type GraviewDocument } from "@graview/core/document";
import { isMarkdownField } from "@graview/core/words";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio, zodFor } from "../../src/index.js";
import { zodSource } from "../../src/source.js";

/**
 * THE STUDIO KEEPS MARKDOWN IN A TEXT FIELD (FR-180). A brief's body is a
 * text field written in Markdown; through the studio and back it must stay
 * one — as TypeScript (`markdownField()`), as a declaration, and as a
 * document (`{"type": "text", "format": "markdown"}`) — and the studio's own
 * act makes a text field Markdown, or plain again.
 */
const brief = defineNode("brief", {
  fields: z.object({ title: z.string(), body: markdownField().optional(), notes: z.string().max(5000).optional() }),
  label: (node) => node.title,
});
const app = defineApp({ name: "Roadmap", schema: createSchema([brief]) });
const shapeOf = (declared: { schema: { definition(kind: string): { fields: unknown } } }) => (declared.schema.definition("brief").fields as { shape: Record<string, unknown> }).shape;

describe("Markdown in a text field, through the studio (FR-180)", () => {
  it("reads it as a text field that says Markdown", () => {
    const studio = createStudio(app);
    expect(studio.store.graph.getNode("field:brief.body")).toMatchObject({ type: "text", markdown: true });
  });

  it("writes it back as markdownField(), imported", () => {
    const files = createStudio(app).files({ schemaVar: "schema" }) as readonly { path: string; contents: string }[];
    const schema = files.find((file) => file.path.endsWith("schema.ts"))!.contents;
    expect(schema).toContain("body: markdownField().optional(),");
    expect(schema).toMatch(/^import \{ markdownField, createSchema, defineNode, z \} from "@graview\/core";/m);
  });

  it("hands back a declaration whose field is still Markdown", () => {
    expect(isMarkdownField(shapeOf(createStudio(app).declaration() as never)["body"])).toBe(true);
  });

  it("makes a text field Markdown, or plain again, with its own act", () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "retype-field", args: { id: "field:brief.body", type: "text", markdown: false } } as never);
    expect(isMarkdownField(shapeOf(studio.declaration() as never)["body"])).toBe(false);
    studio.store.apply({ name: "retype-field", args: { id: "field:brief.notes", type: "text", markdown: true } } as never);
    expect(isMarkdownField(shapeOf(studio.declaration() as never)["notes"])).toBe(true);
  });

  it("writes the field's zod with its format kept", () => {
    expect(isMarkdownField(zodFor("text", false, undefined, true))).toBe(true);
    expect(isMarkdownField(zodFor("text", false))).toBe(false);
    const uses = { nodeRef: false, isoDate: false };
    expect(zodSource("text", true, undefined, uses, true)).toBe("markdownField()");
    expect(uses).toMatchObject({ markdownField: true });
  });

  it("keeps the document's format, and says a change of it as editDocument does", () => {
    const document = {
      format: "graview-document",
      formatVersion: 1,
      name: "Roadmap",
      kinds: { brief: { fields: { title: { type: "string", required: true }, body: { type: "text", format: "markdown" }, notes: { type: "text" } } } },
    } as unknown as GraviewDocument;
    const compiled = compileDocumentWithoutCheck(document);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const studio = createStudio(compiled.app, { document });
    expect(studio.store.graph.getNode("field:brief.body")).toMatchObject({ type: "text", markdown: true });
    studio.store.apply({ name: "retype-field", args: { id: "field:brief.notes", type: "text", markdown: true } } as never);
    const edits = studio.edits();
    expect(edits).toEqual([{ op: "retype-field", kind: "brief", field: "notes", type: "text", format: "markdown" }]);
    const outcome = editDocument(document, edits);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.document.kinds["brief"]!.fields["notes"]).toMatchObject({ type: "text", format: "markdown" });
    expect(outcome.document.kinds["brief"]!.fields["body"]).toMatchObject({ type: "text", format: "markdown" });
  });
});
