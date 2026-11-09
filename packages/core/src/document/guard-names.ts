import type { GraviewApp } from "../app.js";
import { perMember } from "./expr/analyze.js";
import { parseExpr, type Expr } from "./expr/parse.js";
import { ARG_NAME, SUBJECT_NAME } from "./expr/subject.js";
import { warning, type Finding } from "./findings.js";
import type { GraviewDocument } from "./schema.js";
import { parseTemplate } from "./template-parse.js";

/*
 * A NAME THAT MEANS BOTH (Roadmap f-guard-reads-record-not-argument). In an
 * act's condition (`allowedWhen`) and its refusal, a bare name is the call's
 * argument by that name where it gave one, else the record's field
 * (`expr/subject.ts`). A name that is both a field of the kind and an
 * argument of the act can be read either way, so the checker asks for the
 * one meant: `$subject.<field>`, the record's own, or `$arg.<name>`, the
 * argument. Either silences it.
 */

const asArray = <T>(v: T | readonly T[] | undefined): readonly T[] => [v ?? []].flat() as readonly T[];

/** The bare names an expression reads where its subject stands — not a member's, inside a `where` or an `every` — in order, once each. */
function bareNames(expr: Expr): string[] {
  const names: string[] = [];
  const visit = (e: Expr, member: boolean): void => {
    switch (e.t) {
      case "ident":
        if (!member && e.name !== SUBJECT_NAME && !names.includes(e.name)) names.push(e.name);
        return;
      case "lit":
        return;
      case "list":
        e.items.forEach((item) => visit(item, member));
        return;
      case "member":
        visit(e.object, member);
        return;
      case "unary":
        visit(e.operand, member);
        return;
      case "binary":
        visit(e.left, member);
        visit(e.right, member);
        return;
      case "where":
        visit(e.set, member);
        visit(e.filter, true);
        return;
      case "call":
        e.args.forEach((arg, i) => visit(arg, member || perMember(e, i)));
        return;
    }
  };
  visit(expr, false);
  return names;
}

const read = (parse: () => readonly Expr[]): readonly Expr[] => {
  try {
    return parse();
  } catch {
    return []; // The compile's to refuse.
  }
};

/** The names an expression reads as `$arg.<name>`, and whether it says `$arg` alone. */
function argReads(expr: Expr): { readonly names: string[]; readonly bare: boolean } {
  const names: string[] = [];
  let bare = false;
  const visit = (e: Expr): void => {
    if (e.t === "member" && e.object.t === "ident" && e.object.name === ARG_NAME) {
      if (!names.includes(e.name)) names.push(e.name);
      return;
    }
    if (e.t === "ident" && e.name === ARG_NAME) bare = true;
    for (const value of Object.values(e)) for (const one of [value].flat()) if (one && typeof one === "object" && "t" in one) visit(one as Expr);
  };
  visit(expr);
  return { names, bare };
}

const exprOf = (value: unknown): string | undefined => (value && typeof value === "object" && !Array.isArray(value) && typeof (value as { expr?: unknown }).expr === "string" ? (value as { expr: string }).expr : undefined);
const templateExprs = (source: string): readonly Expr[] => read(() => parseTemplate(source).flatMap((part) => (part.expr ? [part.expr] : [])));

/** Each value an act works out with an expression, at its path. */
function actValues(name: string, act: NonNullable<GraviewDocument["acts"]>[string]): { readonly path: string; readonly exprs: readonly Expr[] }[] {
  const out: { path: string; exprs: readonly Expr[] }[] = [];
  const values = (set: Readonly<Record<string, unknown>> | undefined, path: string) => {
    for (const [field, value] of Object.entries(set ?? {})) {
      const source = exprOf(value);
      if (source !== undefined) out.push({ path: `${path}.${field}`, exprs: read(() => [parseExpr(source)]) });
    }
  };
  values(act.sets, `acts.${name}.sets`);
  values(act.setsOther, `acts.${name}.setsOther`);
  for (const [through, set] of Object.entries(act.setsLinked ?? {})) values(set, `acts.${name}.setsLinked.${through}`);
  (act.effects ?? []).forEach((effect, i) => values("set" in effect ? (effect.set as Record<string, unknown>) : undefined, `acts.${name}.effects.${i}.set`));
  return out;
}

/**
 * Each act's condition and refusal, warned of every bare name that is both a
 * field of the kind it is on and one of its arguments; each `$arg.<name>` an
 * act does not take; and `$arg` where no act is run — a label, a computed
 * value, a rule — where it is nothing.
 */
export function nameMeansBothFindings(document: GraviewDocument, app: Pick<GraviewApp, "mutations">): Finding[] {
  const out: Finding[] = [];
  const unknownArgs = (name: string, args: ReadonlySet<string>, path: string, exprs: readonly Expr[]) => {
    for (const read of exprs.map(argReads)) {
      for (const arg of read.names.filter((one) => !args.has(one))) out.push(warning("act-arg-unknown", path, `"${name}" takes no argument called ${arg}, so ${ARG_NAME}.${arg} is always nothing`, args.size > 0 ? `name one of its arguments: ${[...args].join(", ")}` : `"${name}" takes no arguments`));
      if (read.bare) out.push(warning("act-arg-unknown", path, `${ARG_NAME} alone is no value: say which argument, ${ARG_NAME}.<name>`));
    }
  };
  for (const [name, act] of Object.entries(document.acts ?? {})) {
    const kinds = asArray(act.on);
    const mutation = (app.mutations ?? []).find((m) => m.name === name);
    const args = new Set(Object.keys((mutation?.input as { shape?: Record<string, unknown> } | undefined)?.shape ?? {}));
    const isField = (field: string) => kinds.some((kind) => document.kinds[kind]?.fields[field] !== undefined || document.kinds[kind]?.computed?.[field] !== undefined);
    const said = [
      { key: "allowedWhen", what: "condition", exprs: act.allowedWhen ? read(() => [parseExpr(act.allowedWhen!)]) : [] },
      { key: "refusal", what: "refusal", exprs: act.refusal ? templateExprs(act.refusal) : [] },
    ] as const;
    for (const { key, what, exprs } of said) {
      unknownArgs(name, args, `acts.${name}.${key}`, exprs);
      if (kinds.length === 0) continue;
      const names = [...new Set(exprs.flatMap(bareNames))].filter((field) => args.has(field) && isField(field));
      for (const field of names) {
        const message = `"${name}"'s ${what} reads ${field}, which is both a field of ${kinds.join(" and ")} and an argument of "${name}": bare, it is the argument where the call gives one, else the field`;
        out.push(warning("act-name-means-both", `acts.${name}.${key}`, message, `say which: ${SUBJECT_NAME}.${field} for the record's own, or ${ARG_NAME}.${field} for the argument`));
      }
    }
    for (const { path, exprs } of actValues(name, act)) unknownArgs(name, args, path, exprs);
  }
  // Where no act is run, `$arg` is nothing.
  const outside = (path: string, exprs: readonly Expr[]) => {
    if (exprs.some((expr) => { const read = argReads(expr); return read.bare || read.names.length > 0; })) out.push(warning("arg-outside-act", path, `${ARG_NAME} is an act's arguments, and nothing here is an act: it is always nothing`, `read the record's own with ${SUBJECT_NAME}.<field>, or its bare name`));
  };
  const expression = (source: string | undefined): readonly Expr[] => (source === undefined ? [] : read(() => [parseExpr(source)]));
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const label = (spec as { label?: string }).label;
    if (label) outside(`kinds.${kind}.label`, templateExprs(label));
    if (spec.describe) outside(`kinds.${kind}.describe`, templateExprs(spec.describe));
    for (const [field, computed] of Object.entries(spec.computed ?? {})) outside(`kinds.${kind}.computed.${field}`, expression(typeof computed === "string" ? computed : computed.expr));
    for (const [field, value] of Object.entries(spec.derives?.set ?? {})) outside(`kinds.${kind}.derives.set.${field}`, expression(exprOf(value)));
  }
  for (const [fact, computed] of Object.entries(document.computed ?? {})) outside(`computed.${fact}`, expression(typeof computed === "string" ? computed : computed.expr));
  for (const [rule, spec] of Object.entries(document.rules ?? {})) {
    outside(`rules.${rule}.require`, expression(spec.require));
    outside(`rules.${rule}.when`, expression(spec.when));
    if (spec.says) outside(`rules.${rule}.says`, templateExprs(spec.says));
  }
  return out;
}
