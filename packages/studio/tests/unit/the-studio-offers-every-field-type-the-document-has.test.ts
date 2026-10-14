import { appLinkField, createSchema, defineApp, defineNode, imageField, isAppLinkField } from "@graview/core";
import { FIELD_TYPES as DOCUMENT_FIELD_TYPES } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio, declarationToGraph, FIELD_TYPES } from "../../src/index.js";

/*
 * THE STUDIO OFFERS EVERY FIELD TYPE THE DOCUMENT HAS. Its list was a copy
 * of the document's eleven, so another app's address (FR-171) — and a
 * picture, and a file (FR-162) — was a type a document could say and the
 * studio could neither offer nor read back. It is the document's list now:
 * a type the document learns is one the studio offers.
 */
const yard = defineNode("yard", {
  fields: z.object({ label: z.string(), lease: appLinkField().optional(), photo: imageField().optional() }),
  label: (node) => node.label,
});
const app = defineApp({ name: "Yards", schema: createSchema([yard]) });

describe("the studio's field types", () => {
  it("are the document's own list, app-link among them", () => {
    expect([...FIELD_TYPES]).toEqual([...DOCUMENT_FIELD_TYPES]);
    expect(FIELD_TYPES).toContain("app-link");
  });

  it("read an app-link and a picture as what they are", () => {
    const fields = declarationToGraph(app).nodes.filter((node) => node.kind === "field");
    expect(fields.find((node) => node.id === "field:yard.lease")).toMatchObject({ type: "app-link", required: false });
    expect(fields.find((node) => node.id === "field:yard.photo")).toMatchObject({ type: "image", required: false });
  });

  it("add an app-link field that is written back as one and declared as one", () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "add-field", args: { kind: "declared:yard", label: "neighbor", type: "app-link", required: false } } as never);
    const files = studio.files({ schemaVar: "schema" }) as readonly { path: string; contents: string }[];
    const schemaTs = files.find((file) => file.path.endsWith("schema.ts"))!.contents;
    expect(schemaTs).toContain("neighbor: appLinkField().optional(),");
    expect(schemaTs).toMatch(/^import \{ appLinkField, [^}]*\} from "@graview\/core";/m);
    const back = studio.declaration() as typeof app;
    const neighbor = (back.schema.definition("yard").fields as unknown as { shape: Record<string, unknown> }).shape["neighbor"];
    expect(isAppLinkField(neighbor)).toBe(true);
  });
});
