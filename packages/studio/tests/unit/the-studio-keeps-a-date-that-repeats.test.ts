import { createSchema, defineApp, defineNode, isRepeatField, repeatField } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio, declarationToGraph } from "../../src/index.js";

/*
 * A DATE THAT REPEATS, IN THE STUDIO. The date's field says it repeats; how
 * a record repeats is kept beside it (`<date>Repeat`), the framework's own
 * field, never a field of its own in the studio's graph.
 */
const practice = defineNode("practice", {
  fields: z.object({ label: z.string(), startsAt: z.iso.date(), startsAtRepeat: repeatField(), endsAt: z.iso.date().optional() }),
  label: (node) => node.label,
});
const app = defineApp({ name: "Club", schema: createSchema([practice]) });

describe("the studio and a date that repeats", () => {
  it("reads the date as one that repeats, and its repeat as no field of its own", () => {
    const fields = declarationToGraph(app).nodes.filter((node) => node.kind === "field");
    expect(fields.find((node) => node.id === "field:practice.startsAt")).toMatchObject({ repeats: true });
    expect(fields.find((node) => node.id === "field:practice.startsAtRepeat")).toBeUndefined();
  });

  it("lets a date repeat, writes it back as repeatField() beside it, and refuses it of what is not a date", () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "set-repeats", args: { id: "field:practice.endsAt", repeats: true } } as never);
    expect(() => studio.store.apply({ name: "set-repeats", args: { id: "field:practice.label", repeats: true } } as never)).toThrow(/only a date can repeat/);
    const files = studio.files({ schemaVar: "schema" }) as readonly { path: string; contents: string }[];
    const schemaTs = files.find((file) => file.path.endsWith("schema.ts"))!.contents;
    expect(schemaTs).toContain("startsAtRepeat: repeatField(),");
    expect(schemaTs).toMatch(/^import \{ [^}]*repeatField, [^}]*\} from "@graview\/core";/m);
    const back = studio.declaration() as typeof app;
    const shape = (back.schema.definition("practice").fields as unknown as { shape: Record<string, unknown> }).shape;
    expect(isRepeatField(shape["endsAtRepeat"])).toBe(true);
    expect(isRepeatField(shape["startsAtRepeat"])).toBe(true);
  });
});
