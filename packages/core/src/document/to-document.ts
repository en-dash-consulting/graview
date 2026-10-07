import type { AnySchema, GraviewApp, InvariantDefinition, Policy } from "../index.js";
import { descriptionOf } from "../schema/zod.js";
import { error, warning, type Finding } from "./findings.js";
import { documentOf } from "./remembered.js";
import { FORMAT, FORMAT_VERSION, type FieldSpec, type GraviewDocument, type KindSpec, type RuleSpec } from "./schema.js";

/**
 * A DECLARATION, WRITTEN AS A DOCUMENT (FR-01).
 *
 * An app compiled from a document comes back as that document, byte for
 * byte: the compiler remembers where each app came from. A TypeScript app
 * is read for everything that is already data — fields, relations, plurals,
 * lifecycles, rules judged in words, the policy, modules, lenses, settings
 * — and every surface that is code (a label written as a function, an act's
 * body, a rule's evaluate, a migration) is named in a finding instead of
 * being guessed at. What comes back compiles; what it could not say is
 * listed, so "this app cannot be hosted as a document" is a sentence per
 * reason, not a surprise.
 */
export interface ToDocumentResult {
  readonly document: GraviewDocument;
  /** One per surface the document could not express, at the path it would have had. */
  readonly findings: readonly Finding[];
}

export { documentOf, rememberDocument } from "./remembered.js";

type ZodLike = { readonly _zod?: { readonly def?: Record<string, unknown> } };
const defOf = (schema: unknown): Record<string, unknown> | undefined => (schema as ZodLike | undefined)?._zod?.def;

const DATE = /^\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$$/;

/** One zod field as a document field, or why it cannot be one. */
function fieldOf(schema: unknown): { readonly spec: FieldSpec } | { readonly why: string } {
  let def = defOf(schema);
  let required = true;
  let fallback: unknown;
  for (let depth = 0; def && depth < 4; depth++) {
    if (def["type"] === "optional" || def["type"] === "nullable") required = false;
    else if (def["type"] === "default") {
      required = false;
      fallback = def["defaultValue"];
    } else break;
    def = defOf(def["innerType"]);
  }
  if (!def) return { why: "it is not a zod field" };
  const description = descriptionOf(schema);
  const base = { ...(required ? { required: true } : {}), ...(fallback !== undefined ? { default: fallback } : {}), ...(description ? { description } : {}) };
  const checks = ((def["checks"] as readonly ZodLike[] | undefined) ?? []).map((check) => defOf(check));
  switch (def["type"]) {
    case "string": {
      const format = def["format"];
      if (format === "email") return { spec: { type: "email", ...base } };
      if (format === "url") return { spec: { type: "url", ...base } };
      if (format === "date") return { spec: { type: "date", ...base } };
      if (format === "datetime") return { spec: { type: "datetime", ...base } };
      if (checks.some((check) => check?.["format"] === "regex" && DATE.test(String((check?.["pattern"] as RegExp | undefined)?.source ?? "")))) return { spec: { type: "date", ...base } };
      return { spec: { type: "string", ...base } };
    }
    case "number": {
      // Its range, where the declaration bounds it inclusively (FR-114): `.min(1).max(5)`, `.multipleOf(0.5)`.
      const range: { min?: number; max?: number; step?: number } = {};
      for (const check of checks) {
        const value = check?.["value"];
        if (typeof value !== "number") continue;
        if (check?.["check"] === "greater_than" && check["inclusive"]) range.min = Math.max(range.min ?? value, value);
        else if (check?.["check"] === "less_than" && check["inclusive"]) range.max = Math.min(range.max ?? value, value);
        else if (check?.["check"] === "multiple_of") range.step = value;
      }
      return { spec: { type: checks.some((check) => check?.["format"] === "safeint" || check?.["format"] === "int") ? "integer" : "number", ...range, ...base } };
    }
    case "boolean":
      return { spec: { type: "boolean", ...base } };
    case "enum": {
      const options = Object.keys((def["entries"] as Record<string, unknown> | undefined) ?? {});
      return options.length > 0 ? { spec: { type: "enum", options, ...base } } : { why: "it is an enum with no options" };
    }
    case "array": {
      const element = defOf(def["element"]);
      const of = element?.["type"] === "number" ? "number" : element?.["type"] === "string" ? "string" : undefined;
      return of ? { spec: { type: "list", of, ...base } } : { why: `it is a list of ${String(element?.["type"] ?? "something")}, and a document lists words, numbers or dates` };
    }
    default:
      return { why: `it is a ${String(def["type"])}, which a document has no field type for` };
  }
}

/**
 * What one declared field is, in the document's words — `url`, `date`,
 * `enum` and the rest — or undefined when a document has no word for it.
 * A view spec reads it to know which values may be a link and which a date.
 */
export function fieldSpecOf(field: unknown): FieldSpec | undefined {
  const read = fieldOf(field);
  return "spec" in read ? read.spec : undefined;
}

/** Write an app as a declaration document, naming every surface the document cannot say. */
export function toDocument<S extends AnySchema>(app: GraviewApp<S>): ToDocumentResult {
  const remembered = documentOf(app);
  if (remembered) return { document: remembered, findings: [] };

  const findings: Finding[] = [];
  const schema = app.schema as AnySchema;
  const kinds: Record<string, KindSpec> = {};
  for (const kind of schema.kinds as readonly string[]) {
    const definition = schema.tryDefinition(kind) as {
      fields?: { shape?: Record<string, unknown> };
      edges?: Record<string, { to: readonly string[] | "*"; cardinality?: "one" | "many"; description?: string; inverse?: string; appendOnly?: boolean }>;
      plural?: string;
      noun?: string;
      description?: string;
      label?: unknown;
      describe?: unknown;
      lifecycle?: { field: string; retired: readonly (string | number | boolean)[] };
      display?: { glance?: readonly string[] };
      defaults?: Readonly<Record<string, unknown>>;
      computed?: KindSpec["computed"];
    };
    const at = `kinds.${kind}`;
    const fields: Record<string, FieldSpec> = {};
    for (const [name, field] of Object.entries(definition?.fields?.shape ?? {})) {
      if (name === "id" || name === "kind") continue;
      const read = fieldOf(field);
      const beside = definition?.defaults?.[name];
      if ("spec" in read) fields[name] = beside !== undefined && read.spec.default === undefined ? ({ ...read.spec, default: beside } as FieldSpec) : read.spec;
      else findings.push(error("field-is-code", `${at}.fields.${name}`, `the field "${name}" cannot be written in a document: ${read.why}`));
    }
    if (typeof definition?.label === "function") findings.push(warning("label-is-code", `${at}.label`, `${kind}'s label is a function; the document names it by its first required word field instead`, 'write it as a template, like "{name}"'));
    if (typeof definition?.describe === "function") findings.push(warning("describe-is-code", `${at}.describe`, `${kind}'s describe is a function, which a document cannot carry`, 'write it as a template, like "{status} · {quote|money}"'));
    const edges = Object.fromEntries(
      Object.entries(definition?.edges ?? {}).map(([name, edge]) => [
        name,
        {
          to: edge.to === "*" ? "*" : [...edge.to],
          ...(edge.cardinality ? { cardinality: edge.cardinality } : {}),
          ...(edge.description ? { description: edge.description } : {}),
          ...(edge.inverse ? { inverse: edge.inverse } : {}),
          ...(edge.appendOnly ? { appendOnly: true } : {}),
        },
      ]),
    );
    // What a glance says, of the fields the document could carry (FR-39); one it could not is named above.
    const glance = (definition?.display?.glance ?? []).filter((name) => fields[name]);
    kinds[kind] = {
      fields: Object.keys(fields).length > 0 ? fields : { label: { type: "string", required: true } },
      ...(definition?.noun ? { noun: definition.noun } : {}),
      ...(definition?.plural ? { plural: definition.plural } : {}),
      ...(definition?.description ? { description: definition.description } : {}),
      ...(definition?.lifecycle ? { lifecycle: { field: definition.lifecycle.field, retired: [...definition.lifecycle.retired] as [string | number | boolean, ...(string | number | boolean)[]] } } : {}),
      ...(glance.length > 0 ? { glance } : {}),
      ...(Object.keys(edges).length > 0 ? { edges: edges as KindSpec["edges"] } : {}),
      // Computed fields are already data: an expression and its words (FR-83).
      ...(definition?.computed && Object.keys(definition.computed).length > 0 ? { computed: structuredClone(definition.computed) } : {}),
    } as KindSpec;
  }

  // Acts: the framework derives `edit-<kind>` and `remove-<kind>` from the kinds; any other act's body is code.
  const unwritten = new Set<string>();
  for (const mutation of app.mutations ?? []) {
    if ((mutation as { derived?: unknown }).derived) continue;
    unwritten.add(mutation.name);
    findings.push(error("act-is-code", `acts.${mutation.name}`, `the act "${mutation.name}" is a function body, which a document cannot carry`, "write it as effects: create, set, connect, sever, remove"));
  }

  // Rules: one judged in words is a document rule; one judged in code is named.
  const rules: Record<string, RuleSpec> = {};
  for (const rule of (app.invariants ?? []) as readonly InvariantDefinition[]) {
    if (!rule.judgment) {
      findings.push(error("rule-is-code", `rules.${rule.name}`, `the rule "${rule.name}" is judged by a function, which a document cannot carry`, "say what must hold in the rule language (expressionRule)"));
      continue;
    }
    rules[rule.name] = {
      over: rule.scope === "graph" ? "graph" : rule.scope.kind,
      require: rule.judgment.require,
      ...(rule.judgment.when ? { when: rule.judgment.when } : {}),
      ...(rule.judgment.says ? { says: rule.judgment.says } : {}),
      ...(rule.label ? { title: rule.label } : {}),
      ...(rule.description ? { description: rule.description } : {}),
      ...(rule.repairs && rule.repairs.length > 0 ? { repairs: rule.repairs.map((act) => ({ act })) } : {}),
    } as RuleSpec;
  }

  const policy = app.policy as Policy | undefined;
  // A grant names acts; those the document could not carry go with them, and a grant left with none is said.
  const grants = (policy?.grants ?? []).flatMap((grant, index) => {
    if (grant.mutations === "*") return [{ ...grant }];
    const kept = grant.mutations.filter((name) => !unwritten.has(name));
    if (kept.length === 0) {
      findings.push(warning("grant-for-code", `policy.grants.${index}`, `the grant ${grant.describe ? `"${grant.describe}" ` : ""}allows only acts the document could not carry, so it is left out`));
      return [];
    }
    return [{ ...grant, mutations: kept }];
  });
  if (app.brand) findings.push(warning("brand-is-a-palette", "brand", "the brand is a full palette; a document carries one accent color and derives the rest", 'say { "accent": "#…" }'));
  if ((app.migrations ?? []).length > 0) findings.push(error("migration-is-code", "migrations", "the app's migrations are functions; a document's are ship steps", "write each as steps (stepsMigration)"));

  const document = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    name: app.name,
    ...(app.version ? { version: app.version } : {}),
    kinds,
    ...(Object.keys(rules).length > 0 ? { rules } : {}),
    ...(policy?.roles ? { roles: [...policy.roles] } : {}),
    ...(policy ? { policy: { grants, ...(policy.sees ? { sees: policy.sees.map((sight) => ({ ...sight })) } : {}) } } : {}),
    ...(app.modules ? { modules: modules(app.modules as Record<string, { mutations?: readonly string[] } & Record<string, unknown>>, unwritten) } : {}),
    ...(app.lenses ? { lenses: app.lenses as unknown as Record<string, unknown>[] } : {}),
    ...(app.pages ? { pages: app.pages as GraviewDocument["pages"] } : {}),
    ...(app.settings ? { settings: app.settings as unknown as Record<string, unknown>[] } : {}),
    // View specs are already data: they are the document's views (FR-03).
    ...((app.viewSpecs && Object.keys(app.viewSpecs).length > 0) || app.home ? { views: { ...(app.viewSpecs ?? {}), ...(app.home ? { home: app.home } : {}) } as unknown as GraviewDocument["views"] } : {}),
    // The palette is code; the app's money is data, and goes across (FR-100).
    ...(app.brand?.currency || app.brand?.locale ? { brand: { ...(app.brand.currency ? { currency: app.brand.currency } : {}), ...(app.brand.locale ? { locale: app.brand.locale } : {}) } } : {}),
  } as GraviewDocument;
  return { document, findings };
}

/** Modules as data, without the acts the document could not carry: those are named already, under `acts`. */
function modules(declared: Record<string, { mutations?: readonly string[] } & Record<string, unknown>>, unwritten: ReadonlySet<string>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(declared).map(([name, module]) => [name, module.mutations ? { ...module, mutations: module.mutations.filter((act) => !unwritten.has(act)) } : module]),
  );
}
