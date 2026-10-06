import { withArticle } from "../schema/define-node.js";
import { farEnd } from "./far-end.js";
import { error, type Finding } from "./findings.js";
import { outsideRange } from "./range.js";
import type { ActSpec, GraviewDocument } from "./schema.js";

/*
 * WHAT A DOCUMENT SAYS OF ITS RANGES AND OF THE OTHER END OF ITS LINKS
 * (FR-114, FR-115), judged with the checker (`compileDocument`) and not by
 * a page that compiles a document its host has already judged: these are
 * the host's to refuse when the document is kept, and the hosted page does
 * not carry them (FR-57).
 */

const asArray = <T>(v: T | readonly T[] | undefined): readonly T[] => (v === undefined ? [] : Array.isArray(v) ? (v as readonly T[]) : [v as T]);

/** A number field's range, and its default against it (FR-114). */
function rangeFindings(document: GraviewDocument): Finding[] {
  const out: Finding[] = [];
  for (const [kind, spec] of Object.entries(document.kinds)) {
    for (const [field, f] of Object.entries(spec.fields)) {
      const at = `kinds.${kind}.fields.${field}`;
      const numeric = f.type === "number" || f.type === "integer";
      for (const key of ["min", "max", "step"] as const) if (!numeric && f[key] !== undefined) out.push(error("field-range", `${at}.${key}`, `"${key}" belongs only on a number or integer field`));
      if (numeric && f.min !== undefined && f.max !== undefined && f.min > f.max) out.push(error("field-range", `${at}.max`, `"max" (${f.max}) is below "min" (${f.min})`));
      if (numeric && f.step !== undefined && !(f.step > 0)) out.push(error("field-range", `${at}.step`, '"step" is more than zero, like 1 or 0.5'));
      // A default is a value the field takes, so it is inside the field's range.
      const outside = f.default !== undefined ? outsideRange(f.default, f, field) : undefined;
      if (outside) out.push(error("default-range", `${at}.default`, outside));
    }
  }
  return out;
}

/**
 * What an act says of the other end of what it connects (FR-115): a
 * `setsOther` needs a relation to have an other end, and sets fields that
 * record has; a `replaces` needs a link it is making, and names relations
 * that join the subject to the kinds that link does.
 */
function otherEndFindings(name: string, act: ActSpec, document: GraviewDocument): Finding[] {
  const out: Finding[] = [];
  const at = `acts.${name}`;
  const subject = asArray(act.on);
  const relation = act.connects ?? act.severs;
  const end = relation ? farEnd(document.kinds, relation, subject) : undefined;
  if (act.setsOther) {
    if (!relation) out.push(error("act-sets-other", `${at}.setsOther`, `"${name}" sets the record at the other end of what it connects, and connects nothing`, 'say what it "connects" (or "severs"), or set its subject with "sets"'));
    else if (end && end.kinds !== "*") {
      for (const field of Object.keys(act.setsOther)) {
        for (const kind of end.kinds) {
          const spec = document.kinds[kind];
          if (!spec || spec.fields[field]) continue;
          if (spec.computed?.[field] !== undefined) out.push(error("computed-written", `${at}.setsOther.${field}`, `${kind}'s ${field} is worked out, not written: no act can set it`, "set the stored fields it is worked out from"));
          else out.push(error("act-field", `${at}.setsOther.${field}`, `${kind} has no field "${field}"`));
        }
      }
    }
  }
  if (act.replaces) {
    if (!act.connects) out.push(error("act-replaces", `${at}.replaces`, `"${name}" replaces the links of what it connects, and connects nothing`, 'say what it "connects", or sever with "severs"'));
    else if (act.replaces !== true && end && end.kinds !== "*") {
      const toward = end.kinds;
      for (const other of act.replaces) {
        const there = farEnd(document.kinds, other, subject);
        if (!there) out.push(error("act-edge", `${at}.replaces`, `"${other}" is not a relation any kind declares`));
        else if (there.kinds !== "*" && !there.kinds.some((kind) => toward.includes(kind))) out.push(error("act-replaces", `${at}.replaces`, `"${other}" does not join ${subject.join(" or ")} to ${withArticle(toward[0] ?? "record")}, so "${name}" has no such links to replace`));
      }
    }
  }
  return out;
}

/** Every range and other-end finding of a document, in its order: fields, then acts. */
export function actFindings(document: GraviewDocument): Finding[] {
  return [...rangeFindings(document), ...Object.entries(document.acts ?? {}).flatMap(([name, act]) => otherEndFindings(name, act, document))];
}
