import { nounOf } from "../schema/define-node.js";
import { analyzeExpr } from "./expr/analyze.js";
import { parseExpr } from "./expr/parse.js";
import { error, type Finding } from "./findings.js";
import { isRecord } from "./respell.js";
import type { GraviewDocument } from "./schema.js";

/*
 * WHAT A KIND FOLLOWS (Roadmap f-keep-linked), judged with the checker: a
 * kind it follows that the app has and that is not itself; a relation
 * joining the two, from either end; fields of its own it sets, never one
 * worked out; values worked out from the source (`{ "expr": … }`) or
 * written as they are, never an argument, since no act is asked; and
 * expressions that read what the source has. An expression that does not
 * parse is the compile's to say (`expression`).
 */

export function derivesFindings(document: GraviewDocument): Finding[] {
  const out: Finding[] = [];
  const said = (kind: string) => nounOf(document.kinds[kind], kind);
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const derives = spec.derives;
    if (!derives) continue;
    const at = `kinds.${kind}.derives`;
    const source = document.kinds[derives.from];
    if (!source || derives.from === kind) {
      const others = Object.keys(document.kinds).filter((k) => k !== kind);
      out.push(error("derives-kind", `${at}.from`, derives.from === kind ? `${said(kind)} cannot follow itself` : `"${derives.from}" is not a kind this app has, for ${said(kind)} to follow`, others.length > 0 ? `name one of ${others.join(", ")}` : "add the kind it follows first"));
      continue;
    }
    const pointsAt = (edge: { readonly to: readonly string[] | "*" } | undefined, target: string) => edge !== undefined && (edge.to === "*" || edge.to.includes(target));
    if (!pointsAt(spec.edges?.[derives.via] as never, derives.from) && !pointsAt(source.edges?.[derives.via] as never, kind)) {
      const joining = [
        ...Object.entries(spec.edges ?? {}).filter(([, e]) => pointsAt(e as never, derives.from)).map(([name]) => name),
        ...Object.entries(source.edges ?? {}).filter(([, e]) => pointsAt(e as never, kind)).map(([name]) => name),
      ];
      out.push(
        error(
          "derives-relation",
          `${at}.via`,
          `"${derives.via}" does not join ${said(kind)} to ${said(derives.from)}, so no ${said(kind)} has ${said(derives.from)} to follow`,
          joining.length > 0 ? `name ${joining.length === 1 ? "the relation that does" : "one of the relations that do"}: ${joining.join(", ")}` : `declare a relation of ${kind} to ${derives.from} (or of ${derives.from} to ${kind}) first`,
        ),
      );
    }
    for (const [field, value] of Object.entries(derives.set)) {
      const here = `${at}.set.${field}`;
      if (!spec.fields[field]) {
        if (spec.computed?.[field] !== undefined) out.push(error("computed-written", here, `${kind}'s ${field} is worked out, not written: it cannot follow ${said(derives.from)}`, "set the stored fields it is worked out from"));
        else out.push(error("derives-field", here, `${said(kind)} has no field "${field}" to take from ${said(derives.from)}`, `set one of ${Object.keys(spec.fields).join(", ")}`));
        continue;
      }
      if (typeof value === "string" && /^\$[A-Za-z]/.test(value)) {
        out.push(error("derives-value", here, `"${value}" names an argument, and no act asks for one when ${said(kind)} follows ${said(derives.from)}`, `work it out from ${said(derives.from)} with { "expr": "…" }, or write the value as it is`));
        continue;
      }
      if (!isRecord(value) || typeof value.expr !== "string") continue;
      let names: ReadonlySet<string>;
      try {
        names = analyzeExpr(parseExpr(value.expr)).names;
      } catch {
        continue;
      }
      for (const name of names) {
        if (name === "to" || source.fields[name] || source.edges?.[name] || source.computed?.[name] !== undefined) continue;
        out.push(error("derives-name", here, `${said(derives.from)} has no field or relation called "${name}" for ${kind}'s ${field} to be worked out from`, `read one of ${[...Object.keys(source.fields), ...Object.keys(source.computed ?? {})].join(", ")}; "to" is the ${said(kind)} itself`));
      }
    }
  }
  return out;
}
