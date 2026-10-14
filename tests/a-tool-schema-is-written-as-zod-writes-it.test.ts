import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileDocument } from "@graview/core/check";
import { deriveMutations, z, type AnySchema, type GraviewApp } from "@graview/core";
import * as zm from "../packages/core/src/schema/zod.js";
import { formatsByName, nodeJsonSchema, toJsonSchema } from "../packages/core/src/schema/json-schema.js";
import { discographyApp } from "../apps/discography/src/domain/app.js";
import { gauntletApp } from "../apps/gauntlet/src/domain/app.js";
import { launcherApp } from "../apps/launcher/src/domain/app.js";
import { rotaApp } from "../apps/rota/src/domain/app.js";
import { seedbedApp } from "../apps/seedbed/src/domain/app.js";
import { todoApp } from "../apps/todo/src/domain/app.js";

/**
 * A TOOL'S SCHEMA IS WRITTEN AS ZOD WRITES IT, WITHOUT ZOD'S WRITER ON THE
 * PAGE. zod's JSON-Schema writer is about 20 KB, and a bundler put it in the
 * first chunk of every hosted page because the page's own zod barrels reach
 * it and the seat, fetched later, called it. Graview writes the schema from
 * `_zod.def` itself (`toJsonSchema`); this holds what it writes equal to
 * `z.toJSONSchema(schema, { io: "input", unrepresentable: "any" })` with
 * the same override — over every example app's acts (declared and derived)
 * and kinds, every document fixture, and every kind of schema zod has — so
 * an agent is offered the same tools, and a surface's hash does not move.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const zods = (schema: unknown) => z.toJSONSchema(schema as z.ZodType, { io: "input", unrepresentable: "any", override: formatsByName as never }) as Record<string, unknown>;

type Appish = Pick<GraviewApp<AnySchema>, "schema" | "mutations">;
const fixtures = join(repo, "packages/core/tests/document/fixtures");
const documents: [string, Appish][] = readdirSync(fixtures)
  .filter((name) => name.endsWith(".gdd.json"))
  .flatMap((name) => {
    const compiled = compileDocument(JSON.parse(readFileSync(join(fixtures, name), "utf8")));
    return compiled.ok ? [[name, compiled.app as unknown as Appish] as [string, Appish]] : [];
  });
const apps: [string, Appish][] = [
  ["todo", todoApp as unknown as Appish],
  ["rota", rotaApp as unknown as Appish],
  ["seedbed", seedbedApp as unknown as Appish],
  ["gauntlet", gauntletApp as unknown as Appish],
  ["discography", discographyApp as unknown as Appish],
  ["launcher", launcherApp as unknown as Appish],
  ...documents,
];

describe("a tool schema written by graview", () => {
  it("reads every example app and every document fixture", () => {
    expect(documents.length).toBeGreaterThan(10);
  });

  for (const [name, app] of apps) {
    it(`is zod's for every act and kind of ${name}`, () => {
      const declared = (app.mutations ?? []) as unknown as { name: string; input: unknown }[];
      const acts = [...declared, ...deriveMutations(app.schema, declared as never)] as unknown as { name: string; input: unknown }[];
      expect(acts.length).toBeGreaterThan(0);
      for (const act of acts) expect(JSON.stringify(toJsonSchema(act.input)), act.name).toBe(JSON.stringify(zods(act.input)));
      for (const definition of app.schema.definitions) {
        const fields = zm.extend(definition.fields as never, { id: zm.string().check(zm.minLength(1)), kind: zm.literal(definition.kind) });
        expect(JSON.stringify(toJsonSchema(fields)), definition.kind).toBe(JSON.stringify(zods(fields)));
        expect(nodeJsonSchema(definition)["type"]).toBe("object");
      }
    });
  }

  const enumLike = { A: "a", B: 2 } as const;
  const tree: z.ZodType = z.lazy(() => z.object({ name: z.string(), children: z.array(tree) }));
  const node = z.object({ label: z.string(), get next() { return node.optional(); } });
  const battery: Record<string, unknown> = {
    strings: z.object({
      plain: z.string(),
      bounded: z.string().min(1).max(500).describe("a name"),
      email: z.email(),
      emailMethod: z.string().email(),
      url: z.url(),
      uuid: z.uuid(),
      datetime: z.iso.datetime(),
      localDatetime: z.iso.datetime({ local: true }),
      date: z.iso.date(),
      time: z.iso.time(),
      regex: z.string().regex(/^[A-Z]+$/),
      twoRegex: z.string().regex(/a/).regex(/b/),
      formatAndRegex: z.email().regex(/@x\.org$/),
      base64: z.base64(),
      length: z.string().length(3),
      template: z.templateLiteral(["id-", z.number()]),
      trimmed: z.string().trim().toLowerCase(),
      meta: z.string().meta({ title: "Title", examples: ["x"] }),
    }),
    numbers: z.object({
      plain: z.number(),
      int: z.int(),
      ranged: z.number().min(0).max(10),
      exclusive: z.number().gt(0).lt(1),
      multiple: z.number().multipleOf(5),
      int32: z.int32(),
      positive: z.number().positive(),
      both: z.number().gt(5).gte(5),
    }),
    others: z.object({
      flag: z.boolean(),
      nothing: z.null(),
      never: z.never().optional(),
      anything: z.any(),
      unknown: z.unknown(),
      date: z.date(),
      big: z.bigint().optional(),
      choice: z.enum(["a", "b"]),
      native: z.enum(enumLike),
      empty: z.enum([] as unknown as [string]).optional(),
      one: z.literal("x"),
      many: z.literal(["x", "y"]),
      mixed: z.literal([1, "a"]),
      nullLiteral: z.literal(null),
      custom: z.custom<string>(() => true),
      file: z.file().mime(["image/png"]).max(1000).optional(),
    }),
    wrappers: z.object({
      optional: z.string().optional(),
      nullable: z.string().nullable(),
      nullish: z.number().nullish(),
      nullableObject: z.object({ a: z.string() }).nullable(),
      defaulted: z.number().default(3),
      defaultedDescribed: z.string().default("x").describe("said"),
      prefault: z.string().prefault("y"),
      caught: z.string().catch("z"),
      caughtThrows: z.string().catch(() => { throw new Error("no"); }),
      readonly: z.array(z.string()).readonly(),
      transformed: z.string().transform((value) => value.length),
      piped: z.string().pipe(z.string().min(2)),
      transformThenPipe: z.string().transform((value) => value).pipe(z.string().max(3)),
      nonoptional: z.string().optional().nonoptional(),
      describedOptional: z.string().optional().describe("maybe"),
      lazy: z.lazy(() => z.string()),
      promise: z.promise(z.string()).optional(),
    }),
    composites: z.object({
      list: z.array(z.number()).min(1).max(4),
      tuple: z.tuple([z.string(), z.number().optional()]),
      tupleRest: z.tuple([z.string()], z.number()),
      union: z.union([z.string(), z.number()]),
      unionBare: z.union([z.string(), z.null(), z.boolean()]),
      discriminated: z.discriminatedUnion("kind", [z.object({ kind: z.literal("a"), a: z.string() }), z.object({ kind: z.literal("b") })]),
      intersection: z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })),
      intersectionUnion: z.intersection(z.object({ a: z.string() }), z.union([z.object({ b: z.string() }), z.object({ c: z.string() })])),
      record: z.record(z.string(), z.number()),
      recordEnum: z.record(z.enum(["a", "b"]), z.string()),
      recordPartial: z.partialRecord(z.enum(["a", "b"]), z.string()),
      recordNumeric: z.record(z.number(), z.string()),
      looseRecord: z.looseRecord(z.string().regex(/^x-/), z.string()),
      strict: z.strictObject({ a: z.string() }),
      loose: z.looseObject({ a: z.string() }),
      catchall: z.object({ a: z.string() }).catchall(z.number()),
      map: z.map(z.string(), z.number()).optional(),
      set: z.set(z.string()).optional(),
      reused: (() => { const shared = z.string().min(2); return z.object({ a: shared, b: shared }); })(),
    }),
    recursiveRoot: tree,
    recursiveInside: z.object({ head: node }),
    mini: zm.object({
      name: zm.string().check(zm.minLength(1), zm.maxLength(80)),
      count: zm.optional(zm.number().check(zm.gte(0))),
      kind: zm.enum(["a", "b"]),
      tags: zm.array(zm.string()),
      when: zm.nullable(zm.iso.date()),
      described: zm.string().register(zm.globalRegistry, { description: "said in mini" }),
      defaulted: zm._default(zm.boolean(), false),
    }),
  };

  for (const [name, schema] of Object.entries(battery)) {
    it(`is zod's for ${name}`, () => {
      expect(toJsonSchema(schema)).toStrictEqual(zods(schema));
      // Key for key in the same order, so a surface serialized as written reads the same.
      expect(JSON.stringify(toJsonSchema(schema))).toBe(JSON.stringify(zods(schema)));
    });
  }

  it("is the only writer a page reaches: nothing in a package's source calls zod's but the command line's document schema", () => {
    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? sources(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []));
    const callers = readdirSync(join(repo, "packages"))
      .flatMap((name) => { try { return sources(join(repo, "packages", name, "src")); } catch { return []; } })
      .filter((file) => /\b\w+\.toJSONSchema\(|\{[^}]*\btoJSONSchema\b[^}]*\}\s*from\s*"zod/.test(readFileSync(file, "utf8").replaceAll("_zod.toJSONSchema", "")))
      .map((file) => file.slice(repo.length + 1));
    expect(callers).toEqual(["packages/core/src/cli/document-schema.ts"]);
  });
});
