import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";

/**
 * A NAME EVERY OBJECT ALREADY HAS IS NO FIELD'S AND NO RELATION'S.
 *
 * A field or relation name is one camelCase word, and `constructor`,
 * `toString`, `valueOf` and `hasOwnProperty` are such words — and also
 * what every JavaScript object answers to. A document that named one
 * compiled, and then went wrong in ways it never said: an act that set
 * `toString` on a kind with no such field was let through (the kind's
 * fields "had" one), and every call then failed with "declared.safeParse
 * is not a function"; a kind that declared a `constructor` field could
 * never make or change a record ("Cannot read properties of undefined");
 * and a relation called `toString` was refused as clashing with a field
 * nobody declared. The reader now refuses the name, by path, in a sentence.
 */
const tasks = JSON.parse(readFileSync(new URL("./fixtures/tasks.gdd.json", import.meta.url), "utf8"));
const NAMES = ["constructor", "toString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "toLocaleString"];
const refusedAt = (document: unknown) => {
  const compiled = compileDocument(document);
  return compiled.ok ? [] : compiled.findings.filter((f) => f.severity === "error").map((f) => [f.code, f.path, f.message] as const);
};

describe("a name every object already has", () => {
  for (const name of NAMES) {
    it(`is refused as a field: ${name}`, () => {
      const document = structuredClone(tasks);
      document.kinds.task.fields[name] = { type: "string" };
      const refused = refusedAt(document);
      expect(refused.map(([code, path]) => [code, path])).toEqual([["shape", `kinds.task.fields.${name}`]]);
      expect(refused[0]![2]).toContain(name);
    });

    it(`is refused where an act sets it: ${name}`, () => {
      const document = structuredClone(tasks);
      document.acts["set-status"].sets = { status: "$status", [name]: "nope" };
      expect(refusedAt(document).map(([code, path]) => [code, path])).toEqual([["shape", `acts.set-status.sets.${name}`]]);
    });

    it(`is refused as a relation, and not as a clash with a field nobody declared: ${name}`, () => {
      const document = structuredClone(tasks);
      document.kinds.task.edges[name] = { to: ["person"] };
      const refused = refusedAt(document);
      expect(refused.map(([code]) => code)).not.toContain("edge-field-clash");
      expect(refused.map(([code, path]) => [code, path])).toEqual([["shape", `kinds.task.edges.${name}`]]);
    });
  }

  it("leaves every other name as it was: a kind, an act and a rule may still be called constructor", () => {
    const document = structuredClone(tasks);
    document.kinds.constructor = { fields: { label: { type: "string", required: true } } };
    document.acts.constructor = { title: "Make one", creates: "constructor" };
    expect(refusedAt(document)).toEqual([]);
  });
});
