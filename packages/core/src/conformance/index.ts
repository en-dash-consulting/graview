import { checkApp } from "../cli/check.js";
import { compileDocument } from "../document/compile.js";
import type { GraviewDocument } from "../document/schema.js";
import type { GraviewApp } from "../app.js";
import { snapshotHash } from "../integrity.js";
import { deriveMutations } from "../mutations/derive-edits.js";
import { OperationLog } from "../ops/log.js";
import type { Operation } from "../ops/types.js";
import type { AnySchema } from "../schema/schema.js";
import { mutationToolSchema } from "../schema/json-schema.js";
import { ANNOUNCED, FIXTURES } from "./fixtures.js";

/**
 * A CONFORMANCE KIT (FR-32): fixtures any host runs against a version to
 * prove it reads, compiles and derives the same as the version before.
 *
 * Each fixture is something a host stores or accepts — a declaration
 * document, an op log — with what this framework made of it when the
 * fixture was added: whether the document compiles and what the check says
 * about it, the tool each act is offered as, the hash a log folds to. A new
 * version that makes something else of yesterday's fixture is a difference,
 * named by fixture id. Fixtures are append-only: one changes only through an
 * announced difference, recorded with the version that made it.
 */
export type { ConformanceFixture, DocumentFixture, LogFixture, Announcement } from "./fixtures.js";
export { ANNOUNCED, FIXTURES };

/** The pieces of a build the kit judges. A host passes its own; absent pieces are this build's. */
export interface ConformanceBuild {
  readonly compileDocument: (document: unknown) => { readonly ok: boolean; readonly app?: GraviewApp<AnySchema> };
  readonly snapshotHash: (snapshot: { readonly nodes: readonly unknown[]; readonly edges: readonly unknown[] }) => string;
  /** The graph a log folds to, under an app's schema. */
  readonly fold: (app: GraviewApp<AnySchema>, ops: readonly Operation[]) => { readonly nodes: readonly unknown[]; readonly edges: readonly unknown[] };
  /** Each act — declared and derived — as the tool an agent is offered: its name and input schema. */
  readonly toolSchemas: (app: GraviewApp<AnySchema>) => Readonly<Record<string, unknown>>;
  /** What `graview check` says about an app, as `severity:code`, sorted. */
  readonly checkCodes: (app: GraviewApp<AnySchema>) => readonly string[];
}

export const THIS_BUILD: ConformanceBuild = {
  compileDocument: (document) => {
    const compiled = compileDocument(document);
    return compiled.ok ? { ok: true, app: compiled.app as GraviewApp<AnySchema> } : { ok: false };
  },
  snapshotHash: (snapshot) => snapshotHash(snapshot as never),
  fold: (app, ops) => OperationLog.from(ops).fold(app.schema).snapshot() as never,
  toolSchemas: (app) => {
    const declared = app.mutations ?? [];
    const acts = [...declared, ...deriveMutations(app.schema, declared as never)];
    return Object.fromEntries(acts.map((act) => [act.name, mutationToolSchema(act as never).inputSchema]));
  },
  checkCodes: (app) => checkApp(app).findings.map((finding) => `${finding.severity}:${finding.code}`).sort(),
};

/** One thing a build made differently of a fixture than the version that recorded it. */
export interface Difference {
  readonly fixture: string;
  readonly what: "compiles" | "findings" | "tools" | "hash" | "threw";
  readonly expected: unknown;
  readonly actual: unknown;
}

export interface ConformanceResult {
  readonly ok: boolean;
  readonly checked: number;
  readonly differences: readonly Difference[];
}

const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Run every fixture against a build; the differences, by fixture id. */
export function conformance(build: Partial<ConformanceBuild> = {}): ConformanceResult {
  const use: ConformanceBuild = { ...THIS_BUILD, ...build };
  const differences: Difference[] = [];
  const documents = new Map<string, GraviewDocument>();
  for (const fixture of FIXTURES) if (fixture.kind === "document") documents.set(fixture.id, fixture.document as GraviewDocument);
  for (const fixture of FIXTURES) {
    try {
      if (fixture.kind === "document") {
        const compiled = use.compileDocument(fixture.document);
        if (compiled.ok !== fixture.expect.compiles) {
          differences.push({ fixture: fixture.id, what: "compiles", expected: fixture.expect.compiles, actual: compiled.ok });
          continue;
        }
        if (!compiled.app) continue;
        const findings = use.checkCodes(compiled.app);
        if (!same(findings, fixture.expect.findings)) differences.push({ fixture: fixture.id, what: "findings", expected: fixture.expect.findings, actual: findings });
        const tools = use.toolSchemas(compiled.app);
        for (const name of new Set([...Object.keys(fixture.expect.tools), ...Object.keys(tools)])) {
          if (!same(tools[name], fixture.expect.tools[name])) differences.push({ fixture: `${fixture.id}#${name}`, what: "tools", expected: fixture.expect.tools[name] ?? null, actual: tools[name] ?? null });
        }
      } else {
        const document = documents.get(fixture.document);
        const compiled = use.compileDocument(document);
        if (!compiled.app) {
          differences.push({ fixture: fixture.id, what: "compiles", expected: true, actual: false });
          continue;
        }
        const hash = use.snapshotHash(use.fold(compiled.app, fixture.ops as readonly Operation[]));
        if (hash !== fixture.expect.hash) differences.push({ fixture: fixture.id, what: "hash", expected: fixture.expect.hash, actual: hash });
      }
    } catch (error) {
      differences.push({ fixture: fixture.id, what: "threw", expected: "no error", actual: error instanceof Error ? error.message : String(error) });
    }
  }
  return { ok: differences.length === 0, checked: FIXTURES.length, differences };
}
