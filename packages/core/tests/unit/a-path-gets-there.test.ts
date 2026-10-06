import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineApp, defineNode, walkKinds } from "../../src/index.js";
import { checkApp } from "../../src/check.js";

/**
 * A PATH GETS THERE. "Offers by showroom" was bound offers → cars →
 * showrooms, and a coverage walks column end first: it reached nothing and
 * said "6 offers with no showroom · 4 showrooms on no offer" of six offers
 * on show everywhere (the seventh walk). The checker reads the walk off the
 * declaration and says which way round it goes.
 */
const showroom = defineNode("showroom", { fields: z.object({ label: z.string() }), plural: "Showrooms" });
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars", edges: { "on-show-at": { to: ["showroom"], description: "where it is", inverse: "the cars here" } } });
const offer = defineNode("offer", { fields: z.object({ label: z.string() }), plural: "Offers", edges: { "applies-to": { to: ["car"], description: "the cars it applies to", inverse: "the offers on it" } } });
const schema = createSchema([showroom, car, offer]);
const lensed = (path: readonly string[]) =>
  defineApp({ name: "Lot", schema, lenses: [{ name: "coverage", binds: "entities", requiredRoles: ["rows", "columns", "link"], bindings: { rows: { kind: "offer" }, columns: { kind: "showroom" }, link: { path } } }] });

describe("a path of edges", () => {
  it("is walked by kind, each edge either way", () => {
    expect(walkKinds(schema, "showroom", ["on-show-at", "applies-to"])).toEqual({ ok: true, reached: new Set(["offer"]) });
    expect(walkKinds(schema, "showroom", ["applies-to", "on-show-at"])).toEqual({ ok: false, at: 0 });
  });

  it("named backwards is a binding error that says which way round, and named right is nothing to say", () => {
    const wrong = checkApp(lensed(["applies-to", "on-show-at"])).findings.find((finding) => finding.code === "lens-binding-path-misses");
    expect(wrong?.fix).toContain('path: ["on-show-at", "applies-to"]');
    expect(checkApp(lensed(["on-show-at", "applies-to"])).findings.map((finding) => finding.code)).not.toContain("lens-binding-path-misses");
  });
});
