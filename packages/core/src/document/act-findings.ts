import { derivedActOf, givenWhenNeverArchived, givenWhenNeverTidied } from "../mutations/derived-names.js";
import { withArticle } from "../schema/define-node.js";
import { farEnd } from "./far-end.js";
import { error, warning, type Finding } from "./findings.js";
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

/** Whether a value written as it is (not a `$ref`, not an expression) is one the field could hold. */
function literalFits(value: unknown, type: string): boolean {
  if (value === null || typeof value === "object") return true;
  if (typeof value === "string" && /^\$[A-Za-z]/.test(value)) return true;
  switch (type) {
    case "number":
    case "integer":
    case "duration":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "string":
    case "text":
    case "enum":
    case "date":
    case "datetime":
    case "url":
    case "email":
    case "phone":
      return typeof value === "string";
    default:
      return true;
  }
}

/**
 * What an act says of the records linked to its subject (Roadmap
 * f-acts-update-linked): a `setsLinked` names, for a subject the act is
 * `on`, a relation that joins its kind to another — declared on it, or
 * pointing at it — and sets fields each kind at the far end has, with
 * values they could hold.
 */
function linkedFindings(name: string, act: ActSpec, document: GraviewDocument): Finding[] {
  const out: Finding[] = [];
  if (!act.setsLinked) return out;
  const at = `acts.${name}.setsLinked`;
  const subject = asArray(act.on);
  if (subject.length === 0) {
    out.push(error("act-sets-linked-relation", at, `"${name}" sets the records linked to its subject, and is on no kind`, 'say which kind it is "on"; the relations it carries values through are that kind\'s'));
    return out;
  }
  for (const [relation, set] of Object.entries(act.setsLinked)) {
    const here = `${at}.${relation}`;
    const declaredOn = subject.filter((kind) => document.kinds[kind]?.edges?.[relation] !== undefined);
    const pointingAt = Object.entries(document.kinds).filter(([, spec]) => {
      const to = spec.edges?.[relation]?.to;
      return to !== undefined && (to === "*" || subject.some((kind) => to.includes(kind)));
    });
    if (declaredOn.length === 0 && pointingAt.length === 0) {
      const own = [...new Set(subject.flatMap((kind) => Object.keys(document.kinds[kind]?.edges ?? {})))];
      const noun = subject.map((kind) => withArticle(kind)).join(" or ");
      out.push(
        error("act-sets-linked-relation", here, `"${relation}" is not a relation that joins ${noun} to anything, so "${name}" has no linked records to set through it`, own.length > 0 ? `name one of ${subject.join(" or ")}'s relations: ${own.join(", ")}` : `declare a relation on ${subject.join(" or ")} first`),
      );
      continue;
    }
    const end = farEnd(document.kinds, relation, subject);
    if (!end || end.kinds === "*") continue;
    for (const [field, value] of Object.entries(set)) {
      for (const kind of end.kinds) {
        const spec = document.kinds[kind];
        if (!spec) continue;
        const f = spec.fields[field];
        if (!f) {
          if (spec.computed?.[field] !== undefined) out.push(error("computed-written", `${here}.${field}`, `${kind}'s ${field} is worked out, not written: no act can set it`, "set the stored fields it is worked out from"));
          else out.push(error("act-sets-linked-field", `${here}.${field}`, `${kind}, at the far end of "${relation}", has no field "${field}"`, `set one of ${kind}'s fields: ${Object.keys(spec.fields).join(", ")}`));
          continue;
        }
        if (!literalFits(value, f.type)) out.push(error("act-sets-linked-field", `${here}.${field}`, `${kind}'s ${field} holds ${withArticle(f.type)}, and ${JSON.stringify(value)} is not one`, `write ${withArticle(f.type)}, an argument ("$name") or an expression ({ "expr": … })`));
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
  /*
   * A person a seat's profile can be (`Store`): the id and the name, so a kind
   * that requires anything more has none for a profile, and the act is not
   * offered to one. A warning: a host may still fill in a member's.
   */
  const fields = Object.entries(document.kinds[people[0]!]!.fields);
  const word = (f: { readonly type: string }) => f.type === "string" || f.type === "text";
  const named = fields.find(([field, f]) => field === "name" && word(f))?.[0] ?? fields.find(([, f]) => word(f) && f.required)?.[0] ?? fields.find(([, f]) => word(f))?.[0];
  const asks = fields.filter(([field, f]) => field !== named && f.required && f.default === undefined).map(([field]) => field);
  if (asks.length > 0) out.push(warning("people-unmakeable", at, `"${name}" is done as "$me", and ${people[0]} requires ${asks.join(" and ")}, so a seat's profile has no record to be and is not offered it`, `give ${asks.join(" and ")} a default, or leave ${asks.length > 1 ? "them" : "it"} not required`));
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

/**
 * A FIELD AN ACT SETS TO NULL IS CLEARED (Roadmap f-act-clears-optional-field):
 * an optional one loses its value, and a required one cannot — the act is
 * refused every time it runs on a kind that requires it, so the checker warns
 * at the value. A warning: a document that compiled still compiles.
 */
function clearsFindings(name: string, act: ActSpec, document: GraviewDocument): Finding[] {
  const out: Finding[] = [];
  const at = `acts.${name}`;
  const subject = asArray(act.on);
  const judge = (set: Readonly<Record<string, unknown>> | undefined, path: string, kinds: readonly string[] | "*") => {
    if (kinds === "*") return;
    for (const [field, value] of Object.entries(set ?? {})) {
      if (value !== null) continue;
      const required = kinds.filter((kind) => document.kinds[kind]?.fields[field]?.required === true);
      if (required.length === 0) continue;
      const f = document.kinds[required[0]!]!.fields[field]!;
      // Said of the kinds that require it: an act on several is refused only on those.
      const on = required.length === kinds.length ? (kinds.length === 1 ? "" : " on every kind it is on") : ` on ${required.map((kind) => withArticle(kind)).join(" or ")}`;
      out.push(warning("act-clears-required", `${path}.${field}`, `"${name}" sets ${field} to null, which ${required.join(" and ")} requires: it is refused each time it runs${on}`, f.default !== undefined ? `set it to a value, like its default ${JSON.stringify(f.default)}` : `set it to a value, or say "required": false on ${required.join(" and ")}'s ${field} so clearing it is allowed`));
    }
  };
  judge(act.sets, `${at}.sets`, subject);
  const relation = act.connects ?? act.severs;
  if (act.setsOther && relation) judge(act.setsOther, `${at}.setsOther`, farEnd(document.kinds, relation, subject)?.kinds ?? "*");
  for (const [through, set] of Object.entries(act.setsLinked ?? {})) {
    const far = farEnd(document.kinds, through, subject);
    judge(set, `${at}.setsLinked.${through}`, far?.kinds ?? "*");
  }
  const made = new Map<string, string>();
  if (act.creates) made.set("new", act.creates);
  (act.effects ?? []).forEach((effect, i) => {
    const where = `${at}.effects.${i}.set`;
    if ("create" in effect) {
      if (effect.as) made.set(effect.as, effect.create);
      judge(effect.set, where, [effect.create]);
    } else if ("set" in effect && !("through" in effect)) {
      const target = typeof effect.target === "string" ? effect.target.replace(/^\$/, "") : "subject";
      judge(effect.set, where, target === "subject" ? subject : made.has(target) ? [made.get(target)!] : "*");
    }
  });
  return out;
}

/** Every range, other-end and `$me` finding of a document, in its order: fields, then acts. */
export function actFindings(document: GraviewDocument): Finding[] {
  return [...rangeFindings(document), ...neverArchivedFindings(document), ...neverTidiedFindings(document), ...Object.entries(document.acts ?? {}).flatMap(([name, act]) => [...otherEndFindings(name, act, document), ...linkedFindings(name, act, document), ...meFindings(name, act, document), ...clearsFindings(name, act, document)])];
}

/**
 * WHAT A DOCUMENT SAYS OF TIDYING, JUDGED (`@graview/core/tidying`): a grant
 * naming leave-alone-<kind> or allow-tidying-<kind> of a kind never tidied,
 * an act the app does not have; and a relation said never tidied on a kind
 * that already is never tidied or never linked, which says nothing more.
 */
function neverTidiedFindings(document: GraviewDocument): Finding[] {
  const grants = (document.policy?.grants ?? []).flatMap((grant, i) =>
    asArray(grant.mutations === "*" ? [] : grant.mutations).flatMap((name) => {
      const derived = derivedActOf(name);
      if (!derived || document.acts?.[name] || document.kinds[derived.kind]?.tidying !== "never" || givenWhenNeverTidied(derived.act)) return [];
      return [error("grant-act", `policy.grants.${i}.mutations`, `"${name}" is not an act this document has: ${derived.kind} says "tidying": "never", so no record of it is left alone one by one — all of them are`, `remove "${name}" from the grant`)];
    }),
  );
  const relations = Object.entries(document.kinds).flatMap(([kind, spec]) =>
    spec.tidying === undefined
      ? []
      : Object.entries(spec.edges ?? {}).flatMap(([relation, edge]) =>
          edge.tidying === "never" ? [warning("tidying-redundant", `kinds.${kind}.edges.${relation}.tidying`, `${kind}'s "${relation}" says "tidying": "never", which ${kind}'s own "tidying": "${spec.tidying}" already says`, `drop it, or say the kind's tidying on the relations alone`)] : [],
        ),
  );
  return [...grants, ...relations];
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
