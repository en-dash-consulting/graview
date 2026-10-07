import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { describePlace } from "../../src/describe.js";
import { appFrom, COMPILED_FORMAT, compileDocumentWithoutCheck, documentHash, serializeCompiled, toDocument, type CompiledDocument, type GraviewDocument } from "../../src/document/index.js";
import * as compiledEntry from "../../src/compiled.js";
import { checkApp } from "../../src/cli/check.js";
import { formFields, mutationToolSchema, placesOf, Store, type AnySchema, type FormField, type GraviewApp, type Principal } from "../../src/index.js";
import { todoApp } from "../../../../apps/todo/src/domain/app.js";
import { seedbedApp } from "../../../../apps/seedbed/src/domain/app.js";
import { rotaApp } from "../../../../apps/rota/src/domain/app.js";
import { gauntletApp } from "../../../../apps/gauntlet/src/domain/app.js";
import { discographyApp } from "../../../../apps/discography/src/domain/app.js";

/**
 * FR-123. A HOST CAN HAND THE PAGE A COMPILED APP.
 *
 * Graview Cloud compiles a declaration document on its server at every
 * change, and its shell compiled it again in the page — the reader, the
 * validator, the expression parser and the view checker, most of core's
 * weight up front, to arrive at an app the server already had. Now the
 * server hands the page `serializeCompiled(compileDocument(doc))`, plain
 * JSON with every expression already parsed, and the page rebuilds the app
 * with `appFrom` — which is how `compileDocumentWithoutCheck` builds it too,
 * so the two cannot drift.
 *
 * Proved over every fixture document, every one of Cloud's templates and
 * the example apps' declarations as documents: the rebuilt app is the
 * compiled one — the same document and hash, the same places and what each
 * says on a seeded graph, the same acts with the same schemas, the same
 * results and ops when each is run, the same rules broken, the same labels
 * and the same check findings.
 */
const fixtures = new URL("./fixtures/", import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, fixtures), "utf8"));
const TODAY = "2026-10-07";

type Seed = { nodes: Record<string, unknown>[]; edges: { kind: string; from: string; to: string }[] };
interface Case {
  readonly name: string;
  readonly document: unknown;
  readonly seed?: Seed;
}

const cases: Case[] = [
  ...readdirSync(fixtures)
    .filter((file) => file.endsWith(".gdd.json"))
    .map((file) => {
      const seedFile = file.replace(".gdd.json", ".seed.json");
      return { name: file, document: read(file), ...(readdirSync(fixtures).includes(seedFile) ? { seed: read(seedFile) as Seed } : {}) };
    }),
  ...(read("cloud-templates.json") as { id: string; document: unknown }[]).map((template) => ({ name: `cloud template ${template.id}`, document: template.document })),
  ...Object.entries({ todo: todoApp, seedbed: seedbedApp, rota: rotaApp, gauntlet: gauntletApp, discography: discographyApp }).map(([name, app]) => ({
    name: `the ${name} app, as a document`,
    document: toDocument(app as unknown as GraviewApp<AnySchema>).document,
  })),
];

/** What the server sends: the compiled app as JSON, read back as the page reads it. */
const overTheWire = (compiled: CompiledDocument) => JSON.parse(JSON.stringify(serializeCompiled(compiled))) as unknown;

/** A value each field type takes, the nth of its kind. */
function valueFor(spec: Record<string, unknown>, n: number): unknown {
  switch (spec["type"]) {
    case "string":
      return `Record ${n + 1}`;
    case "text":
      return `Some words about record ${n + 1}`;
    case "number":
    case "integer": {
      const min = typeof spec["min"] === "number" ? spec["min"] : 0;
      const step = typeof spec["step"] === "number" ? spec["step"] : 1;
      const max = typeof spec["max"] === "number" ? spec["max"] : min + 10 * step;
      return Math.min(max, min + (n + 1) * step);
    }
    case "boolean":
      return n % 2 === 0;
    case "date":
      return `2026-10-0${(n % 9) + 1}`;
    case "datetime":
      return `2026-10-0${(n % 9) + 1}T09:30:00Z`;
    case "enum": {
      const options = spec["options"] as string[];
      return options[n % options.length];
    }
    case "list":
      return spec["of"] === "number" ? [n, n + 1] : spec["of"] === "date" ? ["2026-10-01"] : [`item ${n}`];
    case "url":
      return `https://example.org/${n}`;
    case "email":
      return `someone${n}@example.org`;
    default:
      return undefined;
  }
}

/** Three of every kind, every field filled, every relation made to the same-numbered record of its first target. */
function seedOf(document: GraviewDocument): Seed {
  const nodes: Record<string, unknown>[] = [];
  const edges: Seed["edges"] = [];
  const kinds = Object.keys(document.kinds);
  for (const [kind, spec] of Object.entries(document.kinds)) {
    for (let n = 0; n < 3; n++) {
      const node: Record<string, unknown> = { id: `${kind}-${n + 1}`, kind };
      for (const [field, f] of Object.entries(spec.fields)) {
        const value = valueFor(f as Record<string, unknown>, n);
        if (value !== undefined) node[field] = value;
      }
      nodes.push(node);
      for (const [edge, e] of Object.entries(spec.edges ?? {})) {
        const target = e.to === "*" ? kinds[0]! : e.to[0]!;
        const to = `${target}-${((n + 1) % 3) + 1}`;
        if (to !== node["id"]) edges.push({ kind: edge, from: node["id"] as string, to });
      }
    }
  }
  return { nodes, edges };
}

const storeOf = (app: GraviewApp<AnySchema>, seed: Seed) => {
  let tick = 0;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: structuredClone(seed) as never,
    now: () => new Date(Date.UTC(2026, 9, 7, 9, 0, tick++)).toISOString(),
  });
};

/** What an act is asked, from what its form says it takes and the records there are. */
function argsFor(fields: readonly FormField[], formats: Readonly<Record<string, string | undefined>>, store: Store<AnySchema>, subjectId: string | undefined, n: number): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const nodes = store.graph.allNodes() as unknown as { id: string; kind: string }[];
  for (const field of fields) {
    if (field.name === "id" && subjectId) {
      args["id"] = subjectId;
      continue;
    }
    if (field.control === "node") {
      const candidates = nodes.filter((node) => field.kinds.length === 0 || field.kinds.includes(node.kind));
      const pick = candidates[(n + 1) % Math.max(1, candidates.length)];
      if (pick) args[field.name] = pick.id;
    } else if (field.control === "text") args[field.name] = formats[field.name] === "email" ? `someone${n}@example.org` : formats[field.name] === "uri" ? `https://example.org/${n}` : `A ${field.name} ${n}`;
    else if (field.control === "date") args[field.name] = field.time ? "2026-10-07T10:00" : "2026-10-07";
    else if (field.control === "number") args[field.name] = Math.min(field.max ?? Infinity, (field.min ?? 0) + (field.step ?? 1));
    else if (field.control === "choice") args[field.name] = field.options?.[n % (field.options.length || 1)];
    else if (field.control === "boolean") args[field.name] = true;
  }
  return args;
}

/** One run of an act, by someone who holds every role: what it answered, and the ops it kept, without their ids. */
function run(store: Store<AnySchema>, name: string, args: Record<string, unknown>, roles: readonly string[]) {
  try {
    const result = store.apply({ name, args }, { author: { kind: "human", id: "everyone", roles } });
    return { ok: true, ops: result.ops.map(({ id: _id, batch: _batch, ...op }) => op) };
  } catch (error) {
    return { ok: false, refused: error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error) };
  }
}

const reader: Principal = { kind: "human", id: "someone", roles: [] };
const labelsOf = (app: GraviewApp<AnySchema>, store: Store<AnySchema>) =>
  (store.graph.allNodes() as unknown as { id: string; kind: string }[]).map((node) => {
    const definition = app.schema.tryDefinition(node.kind) as { label?: (n: unknown) => string; describe?: (n: unknown) => string } | undefined;
    return [node.id, definition?.label?.(node), definition?.describe?.(node)];
  });
const actShape = (app: GraviewApp<AnySchema>) =>
  (app.mutations ?? []).map((m) => {
    const { apply: _apply, describe: _describe, input, ...declared } = m as unknown as Record<string, unknown>;
    return { ...declared, tool: mutationToolSchema(m as never), form: formFields(input) };
  });
const kindShape = (app: GraviewApp<AnySchema>) =>
  app.schema.kinds.map((kind) => {
    const { fields, label: _label, describe: _describe, ...declared } = app.schema.definition(kind) as unknown as Record<string, unknown>;
    return { ...declared, form: formFields(fields) };
  });

describe("a page handed a compiled app rebuilds the app the server compiled", () => {
  it("covers every fixture document, every Cloud template and the example apps", () => {
    expect(cases.filter((one) => one.name.endsWith(".gdd.json")).length).toBeGreaterThanOrEqual(9);
    expect(cases.filter((one) => one.name.startsWith("cloud template")).length).toBeGreaterThan(0);
    expect(cases.filter((one) => one.name.endsWith("as a document")).length).toBe(5);
  });

  for (const one of cases) {
    describe(one.name, () => {
      const compiled = compileDocument(one.document, { today: () => TODAY });
      // A declaration a document cannot say whole compiles without the checker's verdict on what it left out.
      const server = compiled.ok ? compiled : compileDocumentWithoutCheck(one.document, { today: () => TODAY });
      if (!server.ok) {
        it.skip(`does not compile: ${server.findings.filter((f) => f.severity === "error").map((f) => f.code).join(", ")}`, () => {});
        return;
      }
      const page = appFrom(overTheWire(server), { today: () => TODAY });
      if (!page.ok) throw new Error(`${one.name}: appFrom refused ${JSON.stringify(page.findings)}`);
      const a = server.app as GraviewApp<AnySchema>;
      const b = page.app as GraviewApp<AnySchema>;
      const seed = one.seed ?? seedOf(server.document);

      it("is the same document, by its hash, with the same findings and sights", async () => {
        expect(await documentHash(page.document)).toBe(await documentHash(server.document));
        expect(toDocument(b).document).toEqual(toDocument(a).document);
        expect(page.findings).toEqual(server.findings);
        expect(page.sights).toEqual(server.sights);
        expect([...page.kinds.keys()]).toEqual([...server.kinds.keys()]);
      });

      it("declares the same kinds, acts, rules, policy, brand, views and arrangement", () => {
        expect(kindShape(b)).toEqual(kindShape(a));
        expect(actShape(b)).toEqual(actShape(a));
        const rules = (app: GraviewApp<AnySchema>) => (app.invariants ?? []).map(({ evaluate: _evaluate, ...rule }) => rule);
        expect(rules(b)).toEqual(rules(a));
        const { schema: _a, mutations: _am, invariants: _ai, ...restA } = a;
        const { schema: _b, mutations: _bm, invariants: _bi, ...restB } = b;
        expect(restB).toEqual(restA);
      });

      it("has the same places, and says each the same way on a seeded graph", () => {
        expect(placesOf(b)).toEqual(placesOf(a));
        const storeA = storeOf(a, seed);
        const storeB = storeOf(b, seed);
        for (const place of placesOf(a)) {
          expect(describePlace(storeB, reader, place.slug, { app: b, today: TODAY })).toEqual(describePlace(storeA, reader, place.slug, { app: a, today: TODAY }));
        }
        expect(labelsOf(b, storeB)).toEqual(labelsOf(a, storeA));
        expect(storeB.violations()).toEqual(storeA.violations());
      });

      it("answers every act the same way, with the same ops, run after run", () => {
        const storeA = storeOf(a, seed);
        const storeB = storeOf(b, seed);
        const roles = [...new Set([...(server.document.roles ?? []), ...(a.policy?.grants ?? []).flatMap((grant) => (grant.roles === "*" ? [] : grant.roles))])];
        for (const mutation of a.mutations ?? []) {
          const fields = formFields(mutation.input);
          const properties = (mutationToolSchema(mutation as never).inputSchema["properties"] ?? {}) as Record<string, { format?: string }>;
          const formats = Object.fromEntries(Object.entries(properties).map(([name, property]) => [name, property.format]));
          const kinds = mutation.subject && mutation.subject.kinds !== "*" ? mutation.subject.kinds : undefined;
          const subjects = (storeA.graph.allNodes() as unknown as { id: string; kind: string }[]).filter((node) => !kinds || kinds.includes(node.kind)).slice(0, 2);
          for (const [n, subject] of (mutation.subject ? subjects : [undefined]).entries()) {
            const args = argsFor(fields, formats, storeA, subject?.id, n);
            expect(run(storeB, mutation.name, args, roles), `${mutation.name} ${JSON.stringify(args)}`).toEqual(run(storeA, mutation.name, args, roles));
          }
        }
        expect(storeB.graph.snapshot()).toEqual(storeA.graph.snapshot());
        expect(storeB.violations()).toEqual(storeA.violations());
      });

      it("is judged the same by the checker", () => {
        const strip = (findings: readonly { message: string; code: string; where: string }[]) => findings.map(({ code, where, message }) => ({ code, where, message }));
        expect(strip(checkApp(b).findings)).toEqual(strip(checkApp(a).findings));
      });

      it("can be handed on again: a rebuilt app serializes to what it was rebuilt from", () => {
        expect(JSON.parse(JSON.stringify(serializeCompiled(page)))).toEqual(overTheWire(server));
      });
    });
  }
});

describe("a compiled app the page cannot read is refused, so the shell compiles instead", () => {
  const vendors = compileDocument(read("vendors.gdd.json"));
  if (!vendors.ok) throw new Error("the vendors fixture compiles");
  const wire = overTheWire(vendors) as Record<string, unknown>;

  it("says its format, versioned", () => {
    expect(COMPILED_FORMAT).toBe("graview-compiled@1");
    expect(wire["format"]).toBe(COMPILED_FORMAT);
  });

  it("refuses another format by name — a stale one cached from an older build", () => {
    const stale = appFrom({ ...wire, format: "graview-compiled@0" });
    expect(stale.ok).toBe(false);
    expect(stale.findings.map((f) => f.code)).toEqual(["compiled-format"]);
    expect(stale.findings[0]!.message).toContain("graview-compiled@0");
  });

  it("refuses what is not a compiled app at all", () => {
    for (const nothing of [null, "graview-compiled@1", 7, [], {}, { format: COMPILED_FORMAT }]) {
      const refused = appFrom(nothing);
      expect(refused.ok).toBe(false);
      expect(refused.findings[0]!.code).toMatch(/^compiled-(format|shape)$/);
    }
  });

  it("refuses one whose parts do not match its document", () => {
    const acts = { ...(wire["acts"] as Record<string, unknown>) };
    delete acts[Object.keys(acts)[0]!];
    const torn = appFrom({ ...wire, acts });
    expect(torn.ok).toBe(false);
    expect(torn.findings.map((f) => f.code)).toEqual(["compiled-shape"]);
  });

  it("is built when it can be read, and the document compiled in the page when it cannot", async () => {
    const handed = await compiledEntry.appFromOrCompile({ compiled: wire, document: read("vendors.gdd.json") });
    const stale = await compiledEntry.appFromOrCompile({ compiled: { ...wire, format: "graview-compiled@0" }, document: read("vendors.gdd.json") });
    const none = await compiledEntry.appFromOrCompile({ document: read("vendors.gdd.json") });
    for (const one of [handed, stale, none]) {
      if (!one.ok) throw new Error("the vendors document builds or compiles");
      expect(await documentHash(one.document)).toBe(await documentHash(vendors.document));
      expect(placesOf(one.app as GraviewApp<AnySchema>)).toEqual(placesOf(vendors.app as GraviewApp<AnySchema>));
    }
    // Handed and read, it carries what the server said — the checker's findings among them; compiled in the page, what the page's compile says.
    expect(handed.findings).toEqual(vendors.findings);
    expect(stale.findings).toEqual(compileDocumentWithoutCheck(read("vendors.gdd.json")).findings);
    const broken = await compiledEntry.appFromOrCompile({ compiled: { format: "graview-compiled@0" }, document: { format: "graview-document" } });
    expect(broken.ok).toBe(false);
    expect(compiledEntry.sayFindings(broken.findings)).toContain("✗");
  });

  it("is reached from @graview/core/compiled, which carries no compiler", () => {
    expect(compiledEntry.appFrom).toBe(appFrom);
    expect(compiledEntry.COMPILED_FORMAT).toBe(COMPILED_FORMAT);
    const source = readFileSync(new URL("../../src/document/compiled.ts", import.meta.url), "utf8");
    // Types are free; a value imported from any of these would bring the compiler back into the page.
    const values = [...source.matchAll(/^import (?!type )[^;]*? from "([^"]+)";/gms)].map((match) => match[1]);
    for (const compiler of ["./compile.js", "./views.js", "./expr/parse.js", "./expr/analyze.js", "./upgrade.js", "./computed.js", "./schema.js"]) expect(values).not.toContain(compiler);
  });
});
