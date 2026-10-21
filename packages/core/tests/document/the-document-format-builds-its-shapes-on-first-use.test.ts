import { describe, expect, it } from "vitest";
import { ConnectionSpec } from "../../src/document/connection-spec.js";
import { TemplateSpec } from "../../src/document/graview-template.js";
import { ActSpec, BrandSpec, ComputedSpec, DocumentSpec, EdgeSpec, EffectSpec, FieldSpec, FORMAT, FORMAT_VERSION, GrantSpec, KindSpec, PagesSpec, PolicySpec, RepairSpec, RuleSpec, SightSpec, ValueSpec } from "../../src/document/schema.js";

/**
 * THE DOCUMENT FORMAT BUILDS ITS SHAPES ON FIRST USE (Roadmap
 * f-smaller-worker). Importing `@graview/core/document` used to build some
 * hundred and fifty zod schemas at once, which a Worker's cold isolate paid
 * before its first answer whether or not it read a document. Each exported
 * shape is now `z.lazy` over a set built the first time one parses: the same
 * names, the same parse, nothing built at import.
 */
const SHAPES = { DocumentSpec, KindSpec, FieldSpec, EdgeSpec, ComputedSpec, ValueSpec, EffectSpec, ActSpec, RepairSpec, RuleSpec, GrantSpec, SightSpec, PolicySpec, BrandSpec, PagesSpec, ConnectionSpec, TemplateSpec };
/** Whether a lazy shape has built what it stands for (zod keeps it on the definition once it has). */
const built = (shape: unknown) => (shape as { _zod: { def: { _cachedInner?: unknown } } })._zod.def._cachedInner !== undefined;

describe("the document format", () => {
  it("builds none of its shapes when it is imported", () => {
    expect(Object.entries(SHAPES).filter(([, shape]) => built(shape)).map(([name]) => name)).toEqual([]);
  });

  it("builds them the first time one parses, and parses as it did", () => {
    const fine = DocumentSpec.safeParse({ format: FORMAT, formatVersion: FORMAT_VERSION, name: "Errands", kinds: { errand: { fields: { title: { type: "string" } } } } });
    expect(fine.success).toBe(true);
    expect(built(DocumentSpec)).toBe(true);

    const wrong = FieldSpec.safeParse({ type: "enum" });
    expect(wrong.success).toBe(false);
    expect(wrong.error?.issues.map((issue) => issue.message)).toEqual(['an enum field lists its "options"']);
    const unknownKey = KindSpec.safeParse({ fields: { title: { type: "string" } }, shade: "red" });
    expect(unknownKey.success).toBe(false);
    expect(unknownKey.error?.issues[0]?.code).toBe("unrecognized_keys");
  });
});
