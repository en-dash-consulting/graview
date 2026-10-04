import { canonicalize, editDocument, error, parseExpr, printExpr, type DocumentEdit, type EditOutcome, type Finding, type GraviewDocument } from "@graview/core/document";
import { label, Read, type Node } from "./source.js";
import type { Reading } from "./to-declaration.js";

/*
 * THE STUDIO'S CHANGES, IN editDocument's OWN OPS (FR-54).
 *
 * The studio holds the declaration as a graph and knows the graph it opened
 * on, so the difference between the two is the change a person made. Said
 * as `editDocument`'s ops, that change applies to the document the app was
 * compiled from, and everything the graph did not touch — every act's
 * effects, every label template, the brand, the app's description, a field
 * that is money — stays exactly as it was written. One source of truth: the
 * document a host gets back is `editDocument(document, studio.edits())`.
 *
 * Things are matched by node id, which a rename keeps: a field the studio
 * renamed is `rename-field`, its values kept, not one dropped and another
 * added. A rename is said before anything that names the new name.
 *
 * What the studio changed that no op can say — a relation's cardinality, a
 * kind's lifecycle, a role, a grant — is a finding, one sentence each, and
 * no document is made while there is one: a document that silently kept the
 * old value would say the studio's change happened when it had not.
 */

export interface StudioEdits {
  /** The ops, in the order `editDocument` applies them. */
  readonly edits: readonly DocumentEdit[];
  /** What changed that no op says, one finding each. */
  readonly unsaid: readonly Finding[];
}

const str = (node: Node, key: string): string | undefined => (typeof node[key] === "string" ? (node[key] as string) : undefined);
const strings = (node: Node, key: string): string[] | undefined => (Array.isArray(node[key]) ? (node[key] as unknown[]).map(String) : undefined);
const same = (a: unknown, b: unknown): boolean => canonicalize(a ?? null) === canonicalize(b ?? null);
/** An expression as the rule language prints it, so `||` and `or` are one judgement. */
const printed = (text: string | undefined): string | undefined => {
  if (text === undefined) return undefined;
  try {
    return printExpr(parseExpr(text));
  } catch {
    return text;
  }
};
const unsaid = (path: string, message: string): Finding => error("studio-unsaid", path, message, "make this change in the document itself, or take it back in the studio");

const KIND_PROPERTIES = ["plural", "noun", "description", "lifecycleField", "retired", "figure"] as const;
const KIND_WORDS: Record<(typeof KIND_PROPERTIES)[number], string> = { plural: "plural", noun: "noun", description: "description", lifecycleField: "lifecycle", retired: "lifecycle", figure: "figure" };
const EDGE_PROPERTIES = ["description", "inverse", "cardinality", "appendOnly", "toAny"] as const;
const ACT_PROPERTIES = ["title", "description", "fromTheOtherEnd", "destructive", "writes", "onAny"] as const;
const OTHER_SORTS = ["role", "grant", "sight", "lens", "brand"] as const;

/** The studio's changes from `before` to `after`, as edits to `document` — the document `before` was read from. */
export function documentEdits(document: GraviewDocument, before: Reading, after: Reading): StudioEdits {
  const was = new Read(before);
  const now = new Read(after);
  const edits: DocumentEdit[] = [];
  const findings: Finding[] = [];

  const kindsBefore = new Map(was.ofKind("kind").map((node) => [node.id, node]));
  const kindsAfter = new Map(now.ofKind("kind").map((node) => [node.id, node]));
  const ownerOf = (read: Read, field: Node) => read.out(field.id, "of")[0];
  const declaredOn = (read: Read, edge: Node) => read.out(edge.id, "from-kind")[0];
  /** The document's own words for a field the studio opened on. */
  const specOf = (kind: string, field: string) => document.kinds[kind]?.fields[field] as { type: string; format?: string; unit?: string; of?: string } | undefined;

  const fieldsBefore = new Map(was.ofKind("field").map((node) => [node.id, node]));
  const fieldsAfter = new Map(now.ofKind("field").map((node) => [node.id, node]));
  const edgesBefore = new Map(was.ofKind("edge").map((node) => [node.id, node]));
  const edgesAfter = new Map(now.ofKind("edge").map((node) => [node.id, node]));

  // ── what goes: relations, fields, then kinds, by the names they had ──
  for (const [id, edge] of edgesBefore) {
    const kind = declaredOn(was, edge);
    if (edgesAfter.has(id) || !kind || !kindsAfter.has(kind.id)) continue;
    edits.push({ op: "remove-relation", kind: label(kind), relation: label(edge) });
  }
  for (const [id, field] of fieldsBefore) {
    const kind = ownerOf(was, field);
    if (fieldsAfter.has(id) || !kind || !kindsAfter.has(kind.id)) continue;
    edits.push({ op: "remove-field", kind: label(kind), field: label(field) });
  }
  for (const [id, kind] of kindsBefore) if (!kindsAfter.has(id)) edits.push({ op: "remove-kind", kind: label(kind) });

  // ── what is called something else: kinds, fields, relations ──
  for (const [id, kind] of kindsAfter) {
    const old = kindsBefore.get(id);
    if (old && label(old) !== label(kind)) edits.push({ op: "rename-kind", kind: label(old), to: label(kind) });
  }
  for (const [id, field] of fieldsAfter) {
    const old = fieldsBefore.get(id);
    const kind = ownerOf(now, field);
    if (!old || !kind || !kindsBefore.has(kind.id)) continue;
    if (ownerOf(was, old)?.id !== kind.id) {
      findings.push(unsaid(`kinds.${label(kind)}.fields.${label(field)}`, `${label(field)} moved to ${label(kind)}; an edit cannot move a field from one kind to another`));
      continue;
    }
    if (label(old) !== label(field)) edits.push({ op: "rename-field", kind: label(kind), field: label(old), to: label(field) });
  }
  const renamedRelations = new Set<string>();
  for (const [id, edge] of edgesAfter) {
    const old = edgesBefore.get(id);
    const kind = declaredOn(now, edge);
    if (!old || !kind || !kindsBefore.has(kind.id) || label(old) === label(edge) || renamedRelations.has(label(old))) continue;
    // A relation's name is app-wide: one rename moves it on every kind that declares it.
    renamedRelations.add(label(old));
    edits.push({ op: "rename-relation", kind: label(kind), relation: label(old), to: label(edge) });
  }

  // ── what a field that stays now says ──
  for (const [id, field] of fieldsAfter) {
    const old = fieldsBefore.get(id);
    const kind = ownerOf(now, field);
    if (!old || !kind || !kindsBefore.has(kind.id) || ownerOf(was, old)?.id !== kind.id) continue;
    const at = { kind: label(kind), field: label(field) };
    const type = str(field, "type") ?? "string";
    const wasType = str(old, "type") ?? "string";
    const options = strings(field, "options");
    const wasOptions = strings(old, "options");
    if (type !== wasType) {
      /*
       * NAMED, NOT COERCED. How a number is shown (money, percent,
       * duration), its unit and what a list holds are the document's, and
       * the studio does not edit them — so it does not guess what a new
       * type does to them either.
       */
      const spec = specOf(label(kindsBefore.get(kind.id)!), label(old));
      const kept = spec?.format ? `shown as ${spec.format}` : spec?.unit ? `counted in ${spec.unit}` : spec?.of ? `a list of ${spec.of}s` : undefined;
      if (kept) {
        findings.push(unsaid(`kinds.${at.kind}.fields.${at.field}`, `${at.kind}'s ${at.field} is ${kept}, which the studio does not edit, so it cannot say what making it a ${type} does to that; retype it in the document, where that is decided with it`));
        continue;
      }
      edits.push({ op: "retype-field", ...at, type, ...(type === "enum" && options ? { options } : {}) });
    } else if (type === "enum" && !same(options, wasOptions)) {
      const had = wasOptions ?? [];
      const has = options ?? [];
      const add = has.filter((option) => !had.includes(option));
      const remove = had.filter((option) => !has.includes(option));
      if (!same([...had.filter((option) => !remove.includes(option)), ...add], has)) {
        findings.push(unsaid(`kinds.${at.kind}.fields.${at.field}.options`, `${at.kind}'s ${at.field} offers its options in a new order; an edit adds and removes options, it does not reorder them`));
      } else edits.push({ op: "set-options", ...at, ...(add.length > 0 ? { add } : {}), ...(remove.length > 0 ? { remove } : {}) });
    }
    if ((field["required"] === true) !== (old["required"] === true)) edits.push({ op: "set-required", ...at, required: field["required"] === true });
    if (str(field, "description") !== str(old, "description")) edits.push({ op: "set-label", ...at, label: str(field, "description") ?? null });
  }

  // ── what arrives: kinds with their fields, fields, relations ──
  const fieldSpec = (field: Node) => {
    const type = str(field, "type") ?? "string";
    const options = strings(field, "options");
    return {
      type,
      ...(field["required"] === true ? { required: true } : {}),
      ...(type === "enum" && options ? { options } : {}),
      ...(str(field, "description") ? { label: str(field, "description") } : {}),
    };
  };
  for (const [id, kind] of kindsAfter) {
    if (kindsBefore.has(id)) continue;
    const fields = Object.fromEntries(now.in(id, "of").map((field) => [label(field), fieldSpec(field)]));
    const lifecycle = str(kind, "lifecycleField");
    const retired = strings(kind, "retired");
    edits.push({
      op: "add-kind",
      kind: label(kind),
      ...(str(kind, "noun") ? { noun: str(kind, "noun") } : {}),
      ...(str(kind, "plural") ? { plural: str(kind, "plural") } : {}),
      ...(str(kind, "description") ? { description: str(kind, "description") } : {}),
      ...(lifecycle && retired && retired.length > 0 ? { lifecycle: { field: lifecycle, retired } } : {}),
      ...(str(kind, "figure") ? { figure: str(kind, "figure") } : {}),
      fields,
    });
  }
  for (const [id, field] of fieldsAfter) {
    const kind = ownerOf(now, field);
    if (fieldsBefore.has(id) || !kind || !kindsBefore.has(kind.id)) continue;
    edits.push({ op: "add-field", kind: label(kind), field: label(field), ...fieldSpec(field) });
  }
  for (const [id, edge] of edgesAfter) {
    const kind = declaredOn(now, edge);
    if (edgesBefore.has(id) || !kind) continue;
    edits.push({
      op: "add-relation",
      kind: label(kind),
      relation: label(edge),
      to: edge["toAny"] === true ? "*" : now.out(id, "to-kind").map(label),
      ...(edge["cardinality"] === "one" ? { cardinality: "one" } : {}),
      ...(str(edge, "description") ? { description: str(edge, "description") } : {}),
      ...(str(edge, "inverse") ? { inverse: str(edge, "inverse") } : {}),
      ...(edge["appendOnly"] === true ? { appendOnly: true } : {}),
    });
  }

  // ── what no op says about a kind or a relation that stays ──
  for (const [id, kind] of kindsAfter) {
    const old = kindsBefore.get(id);
    if (!old) continue;
    const changed = new Set(KIND_PROPERTIES.filter((key) => !same(old[key], kind[key])).map((key) => KIND_WORDS[key]));
    for (const what of changed) findings.push(unsaid(`kinds.${label(kind)}`, `${label(kind)}'s ${what} changed; no edit says a kind's ${what} yet`));
  }
  const stillThere = (read: Read, from: string, edge: string) =>
    read
      .out(from, edge)
      .filter((target) => now.node(target.id) !== undefined)
      .map((target) => target.id)
      .sort();
  for (const [id, edge] of edgesAfter) {
    const old = edgesBefore.get(id);
    if (!old) continue;
    const changed = EDGE_PROPERTIES.filter((key) => !same(old[key], edge[key]));
    if (!same(stillThere(was, id, "to-kind"), stillThere(now, id, "to-kind"))) changed.push("toAny");
    if (changed.length > 0) findings.push(unsaid(`kinds.${label(declaredOn(now, edge) ?? edge)}.edges.${label(edge)}`, `the ${label(edge)} relation's ${changed.map((key) => (key === "toAny" ? "far end" : key)).join(" and ")} changed; an edit adds, renames and removes a relation, it does not change one`));
  }

  // ── acts and rules, against the document the edits so far make ──
  const middle = edits.length === 0 ? ({ ok: true, document } as const) : editDocument(document, edits);
  if (!middle.ok) return { edits, unsaid: findings };
  const mid = middle.document;
  const kindName = (node: Node | undefined) => (node ? label(node) : undefined);

  const actsBefore = new Map(was.ofKind("act").filter((act) => act["derived"] !== true).map((act) => [act.id, act]));
  const actsAfter = new Map(now.ofKind("act").filter((act) => act["derived"] !== true).map((act) => [act.id, act]));
  for (const [id, act] of actsBefore) if (!actsAfter.has(id) && mid.acts?.[label(act)]) edits.push({ op: "remove-act", act: label(act) });
  for (const [id, act] of actsAfter) {
    const old = actsBefore.get(id);
    if (!old) {
      const on = now.out(id, "on").map(label);
      const creates = kindName(now.out(id, "creates")[0]);
      const connects = kindName(now.out(id, "connects")[0]);
      const severs = kindName(now.out(id, "severs")[0]);
      edits.push({
        op: "add-act",
        act: label(act),
        ...(str(act, "title") ? { title: str(act, "title") } : {}),
        ...(str(act, "description") ? { description: str(act, "description") } : {}),
        ...(on.length > 0 ? { on: on.length === 1 ? on[0] : on } : {}),
        ...(creates ? { creates } : {}),
        ...(connects ? { connects } : {}),
        ...(severs ? { severs } : {}),
        ...(strings(act, "writes")?.length ? { writes: strings(act, "writes") } : {}),
        ...(act["destructive"] === true ? { destructive: true } : {}),
        ...(str(act, "fromTheOtherEnd") ? { fromTheOtherEnd: str(act, "fromTheOtherEnd") } : {}),
      });
      continue;
    }
    const changed: string[] = ACT_PROPERTIES.filter((key) => !same(old[key], act[key]));
    for (const edge of ["on", "creates", "connects", "severs"]) if (!same(stillThere(was, id, edge), stillThere(now, id, edge))) changed.push(edge);
    if (changed.length > 0) findings.push(unsaid(`acts.${label(act)}`, `the act ${label(act)} changed (${changed.join(", ")}); an edit adds or removes an act whole — remove it and add it again as it should be`));
  }

  const rulesBefore = new Map(was.ofKind("rule").map((rule) => [rule.id, rule]));
  const rulesAfter = new Map(now.ofKind("rule").map((rule) => [rule.id, rule]));
  const repairsOf = (read: Read, rule: Node) => [...read.out(rule.id, "repairs").map(label), ...(strings(rule, "derivedRepairs") ?? [])];
  const overOf = (read: Read, rule: Node) => (rule["wholeGraph"] === true ? "graph" : (kindName(read.out(rule.id, "over")[0]) ?? "graph"));
  for (const [id, rule] of rulesBefore) if (!rulesAfter.has(id) && mid.rules?.[label(rule)]) edits.push({ op: "remove-rule", rule: label(rule) });
  for (const [id, rule] of rulesAfter) {
    const old = rulesBefore.get(id);
    const name = label(rule);
    if (!old) {
      if (!str(rule, "require")) {
        findings.push(unsaid(`rules.${name}`, `the rule ${name} says nothing that must hold; a document's rule is judged in words, so give it a "require"`));
        continue;
      }
      const repairs = repairsOf(now, rule);
      edits.push({
        op: "add-rule",
        rule: name,
        ...(str(rule, "title") ? { title: str(rule, "title") } : {}),
        ...(str(rule, "description") ? { description: str(rule, "description") } : {}),
        over: overOf(now, rule),
        ...(str(rule, "when") ? { when: str(rule, "when") } : {}),
        require: str(rule, "require"),
        ...(str(rule, "says") ? { says: str(rule, "says") } : {}),
        ...(repairs.length > 0 ? { repairs: repairs.map((act) => ({ act })) } : {}),
      });
      continue;
    }
    const kept = mid.rules?.[name];
    if (!kept) continue; // the edits took it with what it judged
    /*
     * A judgement that reads a renamed field was rewritten by the studio
     * AND by the edit; compared as the rule language prints it, the two
     * agree and nothing more is said. One the studio changed besides is the
     * rule given again whole, with the document's own repairs kept.
     */
    const wanted = { require: str(rule, "require"), when: str(rule, "when"), says: str(rule, "says") };
    const moved = (key: "require" | "when", text: string | undefined) => printed(text) !== printed(str(old, key)) && printed(text) !== printed(kept[key]);
    const judged = moved("require", wanted.require) || moved("when", wanted.when) || (wanted.says !== str(old, "says") && wanted.says !== kept.says);
    const worded = str(rule, "title") !== str(old, "title") || str(rule, "description") !== str(old, "description");
    const repairs = repairsOf(now, rule);
    const repaired = !same([...repairsOf(was, old)].sort(), [...repairs].sort());
    const overId = (read: Read, node: Node) => (node["wholeGraph"] === true ? "graph" : (read.out(node.id, "over")[0]?.id ?? "graph"));
    if (overId(was, old) !== overId(now, rule)) {
      findings.push(unsaid(`rules.${name}.over`, `the rule ${name} judges another kind now; give it again under a new name instead`));
      continue;
    }
    if (!judged && !worded && !repaired) continue;
    if (!wanted.require) {
      findings.push(unsaid(`rules.${name}`, `the rule ${name} no longer says what must hold; a document's rule is judged in words`));
      continue;
    }
    const keptRepairs = (kept.repairs ?? []).filter((repair) => repairs.includes(repair.act));
    const newRepairs = repairs.filter((act) => !keptRepairs.some((repair) => repair.act === act)).map((act) => ({ act }));
    const allRepairs = [...keptRepairs, ...newRepairs];
    const { repairs: _repairs, when: _when, says: _says, ...rest } = kept;
    edits.push({
      op: "add-rule",
      rule: name,
      replace: true,
      ...rest,
      ...(worded && str(rule, "title") ? { title: str(rule, "title") } : {}),
      ...(worded && str(rule, "description") ? { description: str(rule, "description") } : {}),
      require: wanted.require,
      ...(wanted.when ? { when: wanted.when } : {}),
      ...(wanted.says ? { says: wanted.says } : {}),
      ...(allRepairs.length > 0 ? { repairs: allRepairs } : {}),
    });
  }

  // ── what the policy, the lenses and the brand became, which no op says yet ──
  const outEdges = (reading: Reading, id: string) =>
    reading.edges
      .filter((edge) => edge.from === id && now.node(edge.to) !== undefined)
      .map((edge) => `${edge.kind}>${edge.to}`)
      .sort();
  for (const sort of OTHER_SORTS) {
    const had = new Map(was.ofKind(sort).map((node) => [node.id, node]));
    const has = new Map(now.ofKind(sort).map((node) => [node.id, node]));
    const ids = new Set([...had.keys(), ...has.keys()]);
    for (const id of ids) {
      const old = had.get(id);
      const node = has.get(id);
      const changed = !old || !node || !same(old, node) || !same(outEdges(before, id), outEdges(after, id));
      if (!changed) continue;
      const what = label((node ?? old)!);
      const verb = !old ? "is new" : !node ? "is gone" : "changed";
      findings.push(unsaid(sort === "brand" ? "brand" : sort === "lens" ? "lenses" : sort === "role" ? "roles" : "policy", `the ${sort} "${what}" ${verb}; no edit says ${sort === "brand" ? "a brand's name or typefaces" : `a ${sort}`} yet`));
    }
  }

  return { edits, unsaid: findings };
}

/** The document the studio's changes make: the one it opened on with its edits applied, or why there is none. */
export function documentAfter(document: GraviewDocument, made: StudioEdits): EditOutcome {
  if (made.unsaid.length > 0) return { ok: false, findings: made.unsaid };
  if (made.edits.length === 0) return { ok: true, document, said: [], fills: [] };
  return editDocument(document, made.edits);
}
