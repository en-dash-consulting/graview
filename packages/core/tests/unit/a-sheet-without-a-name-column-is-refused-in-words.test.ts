import { describe, expect, it } from "vitest";
import { createSchema, defineNode, isoDate, Store, z } from "../../src/index.js";
import { importRows, parseCsv, previewImport } from "../../src/import/index.js";

/**
 * A SHEET WITHOUT A NAME COLUMN IS REFUSED IN WORDS, NOT THROWN (the ninth
 * walk, W-196). The co-op's inspections are named by the act that logs one
 * ("Hollister 07 · Oct 3, 2026"), so a sheet of them has a hive, a date and
 * a count and no name — and every scaffolded kind is labeled
 * `(node) => node.label`. `previewImport` threw "Cannot read properties of
 * undefined (reading 'trim')" before a row was read, where it says of any
 * other row what it lacks.
 */
const hive = defineNode("hive", { fields: z.object({ label: z.string() }), label: (node) => node.label });
const inspection = defineNode("inspection", {
  fields: z.object({ label: z.string().min(1), on: isoDate, mites: z.number().optional() }),
  edges: { of: { to: ["hive"], cardinality: "one", description: "the hive looked into", inverse: "its inspections" } },
  label: (node) => node.label,
  plural: "Inspections",
});
const schema = createSchema([hive, inspection]);
const keeper = { kind: "human" as const, id: "june" };
const store = () => new Store({ schema, snapshot: { nodes: [{ id: "hive:meadow-01", kind: "hive", label: "Meadow 01" }] as never, edges: [] } });
const SHEET = parseCsv("Hive,On,Mites\nMeadow 01,10/3/2026,2.5\n");
const MAPPING = { Hive: { relation: "of" }, On: { field: "on" }, Mites: { field: "mites" } } as const;

describe("a sheet without a name column", () => {
  it("is previewed, each row refused for the name it lacks, rather than thrown", () => {
    const preview = previewImport(store(), "inspection", SHEET, MAPPING, { by: keeper });
    expect(preview.made).toBe(0);
    expect(preview.rows[0]?.refused).toEqual(["it has no Name, which every inspection needs"]);
  });

  it("is imported the same way, keeping nothing", () => {
    const kept = importRows(store(), "inspection", SHEET, MAPPING, { by: keeper });
    expect(kept.kept).toBe(false);
    expect(kept.refused).toBe(1);
  });
});
