import { createSchema, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { arrangeable, throughEdges } from "@graview/core/arrange";
import { offersApp } from "../../../../scripts/fixtures/offers-app.js";
import { filterKeysOf, filterOfWhere } from "../../src/host/where.js";

/**
 * A FILTER ASKED FOR IN CODE IS HELD TO THE KIND. A view goes to a list
 * narrowed — `{ place: "features", where: { stage: "building" } }` — and
 * what it asked is held to what the kind can be filtered by and written as
 * the `filter` the list's arranging line already writes; a field it does
 * not have, a choice it does not offer, or a value that is not one value
 * is refused in a sentence the view is told.
 */
const feature = defineNode("feature", {
  plural: "features",
  fields: z.object({ label: z.string(), stage: z.enum(["idea", "building", "shipped"]), effort: z.number().optional(), done: z.boolean().optional(), team: z.string().optional() }),
  edges: { owned: { to: ["person"] } },
});
const person = defineNode("person", { fields: z.object({ label: z.string() }) });
const schema = createSchema([feature, person]);

describe("a filter asked for in code", () => {
  it("is written as the address's filter word, held to the kind's fields", () => {
    expect(filterOfWhere(schema, ["feature"], { stage: "building" })).toEqual({ ok: true, filter: "stage:building" });
    expect(filterOfWhere(schema, ["feature"], { stage: "building", done: false, owned: "person:ada" })).toEqual({ ok: true, filter: "stage:building,done:false,owned:person:ada" });
    expect(filterOfWhere(schema, ["feature"], undefined)).toEqual({ ok: true });
  });

  it("refuses a field the kind does not have, in a sentence naming the ones it does", () => {
    expect(filterOfWhere(schema, ["feature"], { stag: "building" })).toEqual({ ok: false, says: 'Features have no field "stag" to filter by; they filter by stage, effort, done, team, owned and is.' });
  });

  it("refuses a choice the field does not offer, and a value that is not one value", () => {
    expect(filterOfWhere(schema, ["feature"], { stage: "bilding" })).toEqual({ ok: false, says: 'Stage has no choice "bilding"; its choices are "idea", "building" and "shipped".' });
    expect(filterOfWhere(schema, ["feature"], { stage: ["idea", "building"] })).toMatchObject({ ok: false, says: expect.stringContaining('The filter on "stage" is a list; it keeps one value') });
    expect(filterOfWhere(schema, ["feature"], { team: "a,b" })).toMatchObject({ ok: false, says: expect.stringContaining("holds a comma") });
    expect(filterOfWhere(schema, ["feature"], "stage:building")).toMatchObject({ ok: false });
  });
});

describe("what a view's filter is held to", () => {
  it("is what the kind's list offers to filter by, through each relation too, and what a lens arranges by", () => {
    for (const app of [{ schema }, offersApp]) {
      for (const kind of app.schema.kinds as readonly string[]) {
        const list = throughEdges(app.schema, arrangeable(app.schema, kind)).filters;
        expect(filterKeysOf(app.schema, kind, true).map((one) => one.key), kind).toEqual(list.map((one) => one.key));
        expect(filterKeysOf(app.schema, kind, false).map((one) => one.key), kind).toEqual(arrangeable(app.schema, kind).filters.map((one) => one.key));
        for (const offer of list) if (offer.options) expect(filterKeysOf(app.schema, kind, true).find((one) => one.key === offer.key)?.options, `${kind}.${offer.key}`).toEqual(offer.options);
      }
    }
  });
});
