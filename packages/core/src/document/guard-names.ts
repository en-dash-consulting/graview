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

/** Each act's condition and refusal, warned of every bare name that is both a field of the kind it is on and one of its arguments. */
export function nameMeansBothFindings(document: GraviewDocument, app: Pick<GraviewApp, "mutations">): Finding[] {
  const out: Finding[] = [];
  for (const [name, act] of Object.entries(document.acts ?? {})) {
    const kinds = asArray(act.on);
    if (kinds.length === 0 || (!act.allowedWhen && !act.refusal)) continue;
    const mutation = (app.mutations ?? []).find((m) => m.name === name);
    const args = new Set(Object.keys((mutation?.input as { shape?: Record<string, unknown> } | undefined)?.shape ?? {}));
    const isField = (field: string) => kinds.some((kind) => document.kinds[kind]?.fields[field] !== undefined || document.kinds[kind]?.computed?.[field] !== undefined);
    const said = [
      { key: "allowedWhen", what: "condition", exprs: act.allowedWhen ? read(() => [parseExpr(act.allowedWhen!)]) : [] },
      { key: "refusal", what: "refusal", exprs: act.refusal ? read(() => parseTemplate(act.refusal!).flatMap((part) => (part.expr ? [part.expr] : []))) : [] },
    ] as const;
    for (const { key, what, exprs } of said) {
      const names = [...new Set(exprs.flatMap(bareNames))].filter((field) => args.has(field) && isField(field));
      for (const field of names) {
        const message = `"${name}"'s ${what} reads ${field}, which is both a field of ${kinds.join(" and ")} and an argument of "${name}": bare, it is the argument where the call gives one, else the field`;
        out.push(warning("act-name-means-both", `acts.${name}.${key}`, message, `say which: ${SUBJECT_NAME}.${field} for the record's own, or ${ARG_NAME}.${field} for the argument`));
      }
    }
  }
  return out;
}
