import { documentOf } from "../../document/to-document.js";
import { parseExpr, type Expr } from "../../document/expr/parse.js";
import { perMember } from "../../document/expr/analyze.js";
import { farEnd } from "../../document/far-end.js";
import { parseTemplate } from "../../document/template.js";
import { nodeRefKinds } from "../../mutations/node-ref.js";
import { withArticle } from "../../schema/define-node.js";
import { permits, rolesOf } from "../../permissions/policy.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/*
 * AN ACT THAT READS WHAT ITS RUNNER MAY NOT SEE (FR-105).
 *
 * The store serves a seat only what its sights let it see, and refuses a
 * call that names a hidden record exactly as one that names nothing. What
 * it cannot hide is an act's OWN logic: a condition that counts records the
 * seat may not see, a refusal worded from one, an effect that copies a
 * value from one. Run, the act answers differently when such a record
 * exists — and the seat learns that it does. That is a documented limit
 * (docs/stability.md), and with a chat writing acts the author should be
 * told where it stands: an act, a role the policy lets run it, and a kind
 * that role may not see, read by the act.
 *
 * What an act reads is worked out without running it:
 *   - a document's act: its condition (`allowedWhen`), its refusal, and the
 *     values its sets and effects work out — the kinds each sweeps
 *     (`all('kind')`), walks to (`out('rel')`, `in('rel')`, a relation by
 *     name) and the kinds those walks reach;
 *   - any act: the kinds it declares it `reads`, and the kinds its
 *     arguments name (a record argument of a kind its runner may not see
 *     can never be given: the store refuses it as missing);
 *   - a TypeScript `apply` is not read. An act that reads the graph says so
 *     with `reads`, or the check cannot know.
 *
 * A role that sees a kind only where it is its own (`own: true`) is not
 * named: it sees some. A warning, never an error: the act may be meant.
 */

type Source = string;

/** The kinds an expression reads, standing on `from`: swept, walked to, or read by a relation's name. */
function kindsRead(expr: Expr, from: readonly string[], schema: AnySchema, into: Map<string, Source>, why: Source): void {
  const definition = (kind: string) => schema.tryDefinition(kind) as { edges?: Record<string, { to?: readonly string[] | "*" }> } | undefined;
  const targets = (kinds: readonly string[], edge: string): string[] =>
    kinds.flatMap((kind) => {
      const to = definition(kind)?.edges?.[edge]?.to;
      return to === "*" ? [...(schema.kinds as readonly string[])] : [...(to ?? [])];
    });
  const sources = (edge: string) => (schema.kinds as readonly string[]).filter((kind) => definition(kind)?.edges?.[edge]);
  const note = (kinds: readonly string[]) => kinds.forEach((kind) => into.has(kind) || into.set(kind, why));
  const every = schema.kinds as readonly string[];
  const visit = (e: Expr, at: readonly string[]): readonly string[] => {
    switch (e.t) {
      case "ident": {
        const reached = targets(at, e.name);
        note(reached);
        return reached;
      }
      case "member": {
        const reached = targets(visit(e.object, at), e.name);
        note(reached);
        return reached;
      }
      case "where": {
        const set = visit(e.set, at);
        visit(e.filter, set);
        return set;
      }
      case "list":
        e.items.forEach((x) => visit(x, at));
        return [];
      case "unary":
        visit(e.operand, at);
        return [];
      case "binary":
        return [...visit(e.left, at), ...visit(e.right, at)];
      case "call": {
        const word = (i: number) => (e.args[i]?.t === "lit" && typeof (e.args[i] as { value: unknown }).value === "string" ? ((e.args[i] as { value: string }).value) : undefined);
        let reached: readonly string[] = [];
        if (e.fn === "all" && word(0)) reached = [word(0)!];
        else if ((e.fn === "out" || e.fn === "in") && word(e.args.length === 2 ? 1 : 0)) {
          // A walk from the record, or from every member of a set (FR-101).
          const edge = word(e.args.length === 2 ? 1 : 0)!;
          const from = e.args.length === 2 ? visit(e.args[0]!, at) : at;
          reached = e.fn === "out" ? targets(from, edge) : sources(edge);
        } else {
          const set = e.args[0] ? visit(e.args[0], at) : [];
          e.args.slice(1).forEach((x, i) => visit(x, perMember(e, i + 1) ? (set.length > 0 ? set : every) : at));
          return e.fn === "first" || e.fn === "sort" || e.fn === "either" ? set : [];
        }
        note(reached);
        return reached;
      }
      default:
        return [];
    }
  };
  visit(expr, from);
}

/** What a document's act reads, by kind, and where: its condition, its refusal, its sets and effects. */
function documentActReads(act: Record<string, unknown>, schema: AnySchema): Map<string, Source> {
  const reads = new Map<string, Source>();
  const on = act["on"];
  const from = typeof on === "string" ? [on] : Array.isArray(on) ? (on as string[]) : [];
  const read = (source: unknown, why: Source) => {
    if (typeof source !== "string") return;
    try {
      kindsRead(parseExpr(source), from, schema, reads, why);
    } catch {
      // An expression that does not parse is the compile's to refuse.
    }
  };
  read(act["allowedWhen"], "its condition");
  if (typeof act["refusal"] === "string") {
    try {
      for (const part of parseTemplate(act["refusal"])) if (part.source) read(part.source, "its refusal");
    } catch {
      // As above.
    }
  }
  const values = (set: unknown, why: Source) => {
    if (set && typeof set === "object") for (const value of Object.values(set)) if (value && typeof value === "object" && "expr" in value) read((value as { expr: unknown }).expr, why);
  };
  values(act["sets"], "a value it sets");
  for (const effect of (act["effects"] as unknown[] | undefined) ?? []) values((effect as { set?: unknown }).set, "a value it sets");
  /*
   * THE OTHER END (FR-115). A value set on the record at the other end of
   * what the act connects is worked out standing on that record; and the
   * links an act replaces name the records at their far ends, whose kinds
   * it reads to sever them.
   */
  const declared = Object.fromEntries(schema.definitions.map((definition) => [definition.kind, { edges: (definition as { edges?: Record<string, { to: readonly string[] | "*" }> }).edges ?? {} }]));
  const relation = (act["connects"] ?? act["severs"]) as string | undefined;
  const end = relation ? farEnd(declared, relation, from) : undefined;
  const sets = act["setsOther"];
  if (end && sets && typeof sets === "object") {
    const there = end.kinds === "*" ? (schema.kinds as readonly string[]) : end.kinds;
    for (const value of Object.values(sets)) {
      if (!value || typeof value !== "object" || !("expr" in value) || typeof value.expr !== "string") continue;
      try {
        kindsRead(parseExpr(value.expr), there, schema, reads, "a value it sets on the other record");
      } catch {
        // The compile's to refuse.
      }
    }
  }
  const replaces = act["replaces"];
  for (const replaced of replaces === true && relation ? [relation] : Array.isArray(replaces) ? (replaces as string[]) : []) {
    const other = farEnd(declared, replaced, from);
    for (const kind of other && other.kinds !== "*" ? other.kinds : []) if (!reads.has(kind)) reads.set(kind, "the links it replaces");
  }
  return reads;
}

export function checkHiddenReads<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, declaredMutations, add } = ctx;
  const sights = app.policy?.sees ?? [];
  if (!app.policy || sights.length === 0) return;
  const schema = app.schema as AnySchema;
  const acts = (documentOf(app)?.acts ?? {}) as Record<string, Record<string, unknown>>;
  /** A role sees a kind when some sight names it for the role, and not only where it is the role's own. */
  const sees = (role: string, kind: string) => sights.some((sight) => sight.kinds.includes(kind) && (sight.roles === "*" || sight.roles.includes(role)));
  const roles = [...new Set([...rolesOf(app.policy), ...sights.flatMap((sight) => (sight.roles === "*" ? [] : sight.roles))])].sort();
  for (const mutation of declaredMutations) {
    const reads = Object.prototype.hasOwnProperty.call(acts, mutation.name) ? documentActReads(acts[mutation.name]!, schema) : new Map<string, Source>();
    for (const kind of mutation.reads ?? []) if (!reads.has(kind)) reads.set(kind, "what it declares it reads");
    const shape = (mutation.input as { shape?: Record<string, unknown> }).shape ?? {};
    for (const [arg, field] of Object.entries(shape)) {
      if (arg === mutation.subject?.arg) continue;
      for (const kind of nodeRefKinds(field) ?? []) if (kind !== "*" && !reads.has(kind)) reads.set(kind, `its argument "${arg}"`);
    }
    if (reads.size === 0) continue;
    const subjects = mutation.subject && mutation.subject.kinds !== "*" ? (mutation.subject.kinds as readonly string[]) : [undefined];
    for (const role of roles) {
      const runs = subjects.some((kind) => permits(app.policy, { kind: "human", id: "themselves", roles: [role] }, mutation.name, kind, undefined, "themselves").ok);
      if (!runs) continue;
      for (const [kind, why] of reads) {
        if (sees(role, kind)) continue;
        const argument = why.startsWith("its argument");
        add({
          severity: "warning",
          code: "act-reads-hidden-kind",
          where: mutation.name,
          message: argument
            ? `"${mutation.name}" asks for ${kind} records (${why}), and "${role}" may run it but may not see one, so "${role}" can never give one: the store refuses it as missing.`
            : `"${mutation.name}" reads ${kind} records (${why}), which "${role}" may run it but may not see: whether it is allowed, what it refuses with or what it writes can tell "${role}" that ${withArticle(kind)} they cannot see exists.`,
          fix: `Let "${role}" see ${kind}, keep "${mutation.name}" from "${role}", or have it read only what "${role}" sees.`,
        });
      }
    }
  }
}
