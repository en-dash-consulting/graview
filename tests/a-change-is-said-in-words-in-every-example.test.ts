import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileDocument } from "@graview/core/check";
import { formField, type FormField } from "@graview/core/forms";
import { readableFields } from "@graview/core/words";
import { fieldWords, humanizeField, Store, type AnyMutationDefinition, type AnySchema, type GraviewApp, type GraphSnapshot } from "@graview/core";
import { discographyApp } from "../apps/discography/src/domain/app.js";
import discographySeed from "../apps/discography/src/data/seed.json";
import { gauntletApp } from "../apps/gauntlet/src/domain/app.js";
import gauntletSeed from "../apps/gauntlet/src/data/seed.json";
import { rotaApp } from "../apps/rota/src/domain/app.js";
import rotaExample from "../apps/rota/src/data/example.json";
import { seedbedApp } from "../apps/seedbed/src/domain/app.js";
import { EXAMPLE_GARDEN } from "../apps/seedbed/src/domain/example.js";
import { todoApp } from "../apps/todo/src/domain/app.js";
import todoExample from "../apps/todo/src/data/example.json";

/**
 * A CHANGE IS SAID IN WORDS IN EVERY EXAMPLE (Roadmap
 * f-change-sentences-in-words).
 *
 * The derived edit said `Change Billing across apps: stage → "considering"`,
 * and that sentence is what a person reads in Take back and in Activity and
 * hears when another seat's change is said aloud (the screen-reader pass).
 * Over every example app's derived edits and every document fixture's, on
 * a record of every kind, one field at a time and all at once: no sentence
 * holds a field's key, an arrow or a value in a program's quotes, and a
 * choice, an amount and a day are said as the record page says them.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
type Appish = Pick<GraviewApp<AnySchema>, "schema" | "mutations">;
const roadmap = (() => {
  const compiled = compileDocument(JSON.parse(readFileSync(join(repo, "scripts/fixtures/roadmap/roadmap.gdd.json"), "utf8")));
  if (!compiled.ok) throw new Error("the Roadmap compiles");
  return compiled.app as unknown as Appish;
})();
const fixtures = join(repo, "packages/core/tests/document/fixtures");
const documents: [string, Appish, GraphSnapshot | undefined][] = readdirSync(fixtures)
  .filter((name) => name.endsWith(".gdd.json"))
  .flatMap((name) => {
    const compiled = compileDocument(JSON.parse(readFileSync(join(fixtures, name), "utf8")));
    return compiled.ok ? [[name, compiled.app as unknown as Appish, undefined] as [string, Appish, undefined]] : [];
  });
const apps: [string, Appish, GraphSnapshot | undefined][] = [
  ["todo", todoApp as unknown as Appish, todoExample as unknown as GraphSnapshot],
  ["rota", rotaApp as unknown as Appish, rotaExample as unknown as GraphSnapshot],
  ["seedbed", seedbedApp as unknown as Appish, EXAMPLE_GARDEN],
  ["gauntlet", gauntletApp as unknown as Appish, gauntletSeed as unknown as GraphSnapshot],
  ["discography", discographyApp as unknown as Appish, discographySeed as unknown as GraphSnapshot],
  ["the Roadmap (a document)", roadmap, JSON.parse(readFileSync(join(repo, "scripts/fixtures/roadmap/roadmap.seed.json"), "utf8")) as GraphSnapshot],
  ...documents,
];

/** A value a field could hold, where no record of the example holds one: what a person might give it. */
function sample(field: FormField): unknown {
  switch (field.control) {
    case "text":
      return field.app ? "@nick/house" : field.holds === "duration" ? 90 : "Some words of its own";
    case "date":
      return field.time ? "2026-10-20T18:00" : "2026-10-20";
    case "number":
      return 1250;
    case "choice":
      return field.options?.[0] ?? "one";
    case "boolean":
      return true;
    case "repeat":
      return { every: "week" };
    case "linked":
      return `${field.relation.kinds[0]}:h1`;
    case "file":
      return { name: "plan.pdf", href: "https://example.com/plan.pdf", type: "application/pdf", size: 1 };
    case "list":
      return [sample(field.item), sample(field.item)];
    default:
      return undefined;
  }
}

/** What the screen-reader pass heard: an arrow, a value in a program's quotes, or a key spelled as code. */
const kept = (sentence: string): string[] => [...(sentence.match(/→|"[^"]*"|\b[a-z]+[A-Z]\w*\b|\[object Object\]|\bundefined\b/g) ?? [])];

describe("a change said by an example's derived edit", () => {
  it("is read over every example and the document fixtures", () => {
    expect(apps.map(([name]) => name)).toEqual(expect.arrayContaining(["todo", "rota", "seedbed", "gauntlet", "discography", "the Roadmap (a document)"]));
    expect(documents.length).toBeGreaterThan(10);
  });

  for (const [name, app, snapshot] of apps) {
    it(`in ${name}, holds no field's key, no arrow and no value in a program's quotes, and says a choice, an amount and a day as the record page does`, () => {
      const store = new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never });
      const edits = store.allMutations().filter((one) => one.derived?.act === "edit") as AnyMutationDefinition<AnySchema>[];
      expect(edits.length, name).toBeGreaterThan(0);
      const wrong: string[] = [];
      let said = 0;
      for (const edit of edits) {
        const kind = edit.derived!.kind;
        const definition = app.schema.tryDefinition(kind)!;
        const shape = (definition.fields as { shape?: Record<string, unknown> }).shape ?? {};
        const records = (snapshot?.nodes ?? []).filter((node) => node.kind === kind) as Record<string, unknown>[];
        const record = { id: `${kind}:sample`, kind, label: "The sample", name: "The sample", title: "The sample", ...records[0] } as Record<string, unknown> & { id: string; kind: string };
        const graph = { getNode: (id: string) => (id === record.id ? record : undefined) };
        const values = Object.fromEntries(
          (edit.writes ?? []).flatMap((field) => {
            const held = records.find((one) => one[field] !== undefined && one[field] !== null)?.[field];
            const value = held ?? sample(formField(field, shape[field]));
            return value === undefined ? [] : [[field, value]];
          }),
        );
        const sentences = [...Object.entries(values).map(([field, value]) => [field, { id: record.id, [field]: value }] as const), ["every field", { id: record.id, ...values }] as const];
        for (const [field, args] of sentences) {
          const sentence = edit.describe!(args as never, graph as never);
          said++;
          const keys = Object.keys(shape).filter((key) => key !== humanizeField(key).toLowerCase() && key !== fieldWords(definition, key).toLowerCase() && new RegExp(`\\b${key}\\b`).test(sentence));
          for (const found of [...kept(sentence), ...keys]) wrong.push(`${edit.name} (${field}): "${found}" in ${sentence}`);
          if (field === "every field") continue;
          // A choice, an amount and a day as the record page says them.
          const value = (args as Record<string, unknown>)[field];
          const page = readableFields({ id: record.id, kind, [field]: value }, definition).find((one) => one.key === field);
          const asOnPage = page && !page.long && !page.files && !page.linked && !page.markdown && !(field in (definition.display?.format ?? {})) && (typeof value === "number" || (typeof value === "string" && (page.value !== value || /^\d{4}-\d\d-\d\d/.test(value))));
          if (asOnPage && !sentence.includes(page.value)) wrong.push(`${edit.name} (${field}): the page says "${page.value}" and the change says ${sentence}`);
        }
      }
      expect(said).toBeGreaterThan(0);
      expect(wrong).toEqual([]);
    });
  }
});
