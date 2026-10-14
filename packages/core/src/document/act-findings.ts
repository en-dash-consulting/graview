import { derivedActOf, givenWhenNeverArchived } from "../mutations/derived-names.js";
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

const asArray = <T>(v: T | readonly T[] | undefined): readonly T[] => [v ?? []].flat() as readonly T[];

/** A number field's range, and its default against it (FR-114). */
function rangeFindings(document: GraviewDocument): Finding[] {
  const out: Finding[] = [];
  for (const [kind, spec] of Object.entries(document.kinds)) {
    for (const [field, f] of Object.entries(spec.fields)) {
      const at = `kinds.${kind}.fields.${field}`;
      const numeric = f.type === "number" || f.type === "integer" || f.type === "duration";
      for (const key of ["min", "max", "step"] as const) if (!numeric && f[key] !== undefined) out.push(error("field-range", `${at}.${key}`, `"${key}" belongs only on a number, integer or duration field`));
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

/**
 * What an act's `$me` needs (Roadmap f-act-as-me): a kind that says it is
 * the people, since `$me` is the acting person's own record of it; and,
 * where it links `$me`, a relation whose end there takes that kind.
 */
function meFindings(name: string, act: ActSpec, document: GraviewDocument): Finding[] {
  if (!JSON.stringify(act).includes('"$me"')) return [];
  const at = `acts.${name}`;
  const people = Object.keys(document.kinds).filter((kind) => document.kinds[kind]!.people);
  if (people.length === 0) {
    return [error("people-unsaid", at, `"$me" is the acting person's own record, and no kind says it is the people`, `say "people": true on the kind whose records are the people (a record's id is a member's principal id)`)];
  }
  const out: Finding[] = [];
  for (const effect of act.effects ?? []) {
    if (!("connect" in effect) && !("sever" in effect)) continue;
    const relation = "connect" in effect ? effect.connect : effect.sever;
    for (const end of ["from", "to"] as const) {
      if (effect[end] !== "$me") continue;
      const kinds = Object.entries(document.kinds).flatMap(([kind, spec]) => {
        const edge = spec.edges?.[relation];
        return !edge ? [] : end === "from" ? [kind] : edge.to === "*" ? people : edge.to;
      });
      if (kinds.length > 0 && !people.some((kind) => kinds.includes(kind))) {
        out.push(error("act-me", `${at}.effects`, `"${name}" links "$me" at the ${end} end of ${relation}, which takes ${kinds.join(" or ")} and never ${withArticle(people[0]!)}`, `link "$me" where ${relation} takes ${withArticle(people[0]!)}`));
      }
    }
  }
  return out;
}

/** Every range, other-end and `$me` finding of a document, in its order: fields, then acts. */
export function actFindings(document: GraviewDocument): Finding[] {
  return [...rangeFindings(document), ...neverArchivedFindings(document), ...Object.entries(document.acts ?? {}).flatMap(([name, act]) => [...otherEndFindings(name, act, document), ...meFindings(name, act, document)])];
}

/** A grant naming the archive, unarchive or merge of a kind that says `"archives": false` (FR-173): an act the app does not have. */
function neverArchivedFindings(document: GraviewDocument): Finding[] {
  return (document.policy?.grants ?? []).flatMap((grant, i) =>
    asArray(grant.mutations === "*" ? [] : grant.mutations).flatMap((name) => {
      const derived = derivedActOf(name);
      if (!derived || document.acts?.[name] || document.kinds[derived.kind]?.archives !== false || givenWhenNeverArchived(derived.act)) return [];
      return [error("grant-act", `policy.grants.${i}.mutations`, `"${name}" is not an act this document has: ${derived.kind} says "archives": false, so it is kept or removed, never archived`, `name edit-${derived.kind} or remove-${derived.kind} instead`)];
    }),
  );
}
