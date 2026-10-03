import type { AnySchema, DeclarationChange, GraviewApp, StudioDoorSource } from "@graview/core";
import { migrationSteps } from "./migration.js";
import { actLines, camel, edgeParts, fieldsOf, kindLines, label, q, Read, ruleLines, zodSource, type Node } from "./source.js";
import type { Reading } from "./to-declaration.js";

/**
 * WHAT CHANGED, AS THE SOURCE MUST RECEIVE IT.
 *
 * The studio holds the declaration as a graph and knows the graph it opened
 * on, so the difference between the two IS the change a person made — and
 * saying it as changes rather than as files is what lets the dev server make
 * it inside the checkout's own `defineNode` calls without flattening them.
 *
 * Things are matched by what they mean, not by node id: a field is its kind
 * and its name, an edge its name, so an edge removed from the plot and
 * declared again on the planting is one relation MOVED — and moves with its
 * comments — rather than one deleted and a stranger added.
 *
 * An act or rule whose declaration changed is code the studio cannot write
 * by itself: it is named in `rewrite`, to be rewritten by a person or a seat
 * before anything is written. What the source cannot receive this way at
 * all yet — a role, a grant, a renamed kind — is said, one sentence each,
 * in `unwritten`, and nothing is written while that list has something in
 * it: half a change applied is a checkout that disagrees with itself.
 */
export interface SourceChanges {
  readonly changes: readonly DeclarationChange[];
  readonly rewrite: readonly Rewrite[];
  readonly unwritten: readonly string[];
}

/** An act or rule that must be written afresh before the change can be, and why. */
export interface Rewrite {
  readonly sort: "act" | "rule";
  readonly name: string;
  readonly why: string;
}

const KIND_PROPERTIES = ["description", "plural", "noun", "figure"] as const;

export function sourceChanges(before: Reading, after: Reading, base?: GraviewApp<AnySchema>): SourceChanges {
  const was = new Read(before);
  const now = new Read(after);
  const changes: DeclarationChange[] = [];
  const rewrite: Rewrite[] = [];
  const unwritten: string[] = [];

  const kindsBefore = new Map(was.ofKind("kind").map((kind) => [kind.id, kind]));
  const kindsAfter = new Map(now.ofKind("kind").map((kind) => [kind.id, kind]));

  for (const [id, kind] of kindsBefore) {
    const still = kindsAfter.get(id);
    if (!still) changes.push({ what: "remove-kind", kind: label(kind) });
    else if (label(still) !== label(kind)) unwritten.push(`"${label(kind)}" is renamed "${label(still)}" — rename it in the checkout, where everything that says its name is.`);
  }
  for (const [id, kind] of kindsAfter) {
    if (kindsBefore.has(id)) continue;
    const text = kindLines(now, kind, base, []).join("\n");
    changes.push({ what: "add-kind", kind: label(kind), binding: camel(label(kind)), text });
  }

  // A kind's own settings, for the kinds on both sides.
  for (const [id, kind] of kindsAfter) {
    const old = kindsBefore.get(id);
    if (!old || label(old) !== label(kind)) continue;
    for (const property of KIND_PROPERTIES) {
      if (old[property] === kind[property]) continue;
      const value = kind[property];
      changes.push({ what: "set-kind-property", kind: label(kind), property, text: typeof value === "string" ? q(value) : null });
    }
    if (old["lifecycleField"] !== kind["lifecycleField"] || JSON.stringify(old["retired"]) !== JSON.stringify(kind["retired"])) {
      unwritten.push(`"${label(kind)}"'s lifecycle changed — the studio cannot yet write that into the checkout.`);
    }
  }

  // Fields: a kind's name and the field's name.
  for (const [id, kind] of kindsAfter) {
    const old = kindsBefore.get(id);
    if (!old) continue; // a new kind brings its fields with it
    const had = new Map(fieldsOf(was, old).map((field) => [field.name, field]));
    const has = new Map(fieldsOf(now, kind).map((field) => [field.name, field]));
    for (const [name, field] of has) {
      const zod = zodSource(field.type, field.required, field.options);
      const prior = had.get(name);
      if (!prior) changes.push({ what: "add-field", kind: label(kind), field: name, zod });
      else if (zodSource(prior.type, prior.required, prior.options) !== zod) changes.push({ what: "change-field", kind: label(kind), field: name, zod });
    }
    for (const name of had.keys()) if (!has.has(name)) changes.push({ what: "remove-field", kind: label(kind), field: name });
  }

  // Edges: by name. The same name on another kind is a move.
  const edgesOf = (read: Read, kinds: ReadonlyMap<string, Node>) =>
    new Map(
      read.ofKind("edge").flatMap((edge) => {
        const on = read.out(edge.id, "from-kind")[0];
        return on && kinds.has(on.id) ? [[label(edge), { on: label(on), parts: edgeParts(read, edge) }] as const] : [];
      }),
    );
  const text = (parts: readonly string[]) => `{ ${parts.join(", ")} }`;
  const edgesBefore = edgesOf(was, kindsBefore);
  const edgesAfter = edgesOf(now, kindsAfter);
  const kindNamesAfter = new Set([...kindsAfter.values()].map(label));
  const kindNamesBefore = new Set([...kindsBefore.values()].map(label));
  for (const [name, then] of edgesBefore) {
    const later = edgesAfter.get(name);
    if (!later) {
      // A kind that went took its edges with it.
      if (kindNamesAfter.has(then.on)) changes.push({ what: "remove-edge", kind: then.on, edge: name });
      continue;
    }
    if (later.on !== then.on) {
      const [targets, ...rest] = later.parts;
      changes.push({ what: "move-edge", edge: name, from: then.on, to: later.on, targets: targets!.replace(/^to: /, "") });
      // Anything else about it that changed is changed where it now is.
      if (rest.join() !== then.parts.slice(1).join()) changes.push({ what: "change-edge", kind: later.on, edge: name, text: text(later.parts) });
    } else if (later.parts.join() !== then.parts.join()) {
      changes.push({ what: "change-edge", kind: later.on, edge: name, text: text(later.parts) });
    }
  }
  for (const [name, later] of edgesAfter) {
    // A new kind declares its edges in its own statement.
    if (!edgesBefore.has(name) && kindNamesBefore.has(later.on)) changes.push({ what: "add-edge", kind: later.on, edge: name, text: text(later.parts) });
  }

  /*
   * ACTS AND RULES. A new one is written as the studio declares it — and a
   * new rule judges nothing until somebody says what it judges. One whose
   * declaration changed keeps a body that was written for the old one, so
   * it is named for rewriting rather than half-updated.
   */
  const signature = (read: Read, node: Node) =>
    JSON.stringify([
      Object.entries(node)
        .filter(([key]) => key !== "id")
        .sort(([a], [b]) => a.localeCompare(b)),
      read.reading.edges
        .filter((edge) => edge.from === node.id)
        .map((edge) => `${edge.kind}->${label(read.node(edge.to) ?? { id: edge.to, kind: "" })}`)
        .sort(),
    ]);
  for (const sort of ["act", "rule"] as const) {
    const then = new Map(was.ofKind(sort).map((node) => [label(node), signature(was, node)]));
    for (const node of now.ofKind(sort)) {
      const name = label(node);
      if (sort === "act" && node["derived"] === true) continue;
      if (!then.has(name)) {
        const text = (sort === "act" ? actLines(now, node, false) : ruleLines(now, node, false)).join("\n");
        changes.push(sort === "act" ? { what: "add-act", act: name, binding: camel(name), text } : { what: "add-rule", rule: name, binding: camel(name), text });
        // A rule judged in words is whole as written; one without judges nothing until its evaluate says what breaks it.
        if (sort === "rule" && !node["require"]) rewrite.push({ sort, name, why: "It is new, and judges nothing until its evaluate says what breaks it." });
      } else if (then.get(name) !== signature(now, node) && sort === "rule" && node["require"]) {
        // A rule judged in words is rewritten by the studio itself: its words are its judgement.
        changes.push({ what: "replace-rule", rule: name, text: ruleLines(now, node, false).join("\n") });
      } else if (then.get(name) !== signature(now, node)) {
        rewrite.push({ sort, name, why: `Its declaration changed in the studio, and its ${sort === "act" ? "body" : "judgement"} was written for the old one.` });
      }
    }
    const later = new Set(now.ofKind(sort).map(label));
    for (const name of then.keys()) {
      if (!later.has(name)) changes.push(sort === "act" ? { what: "remove-act", act: name } : { what: "remove-rule", rule: name });
    }
  }

  // Policy and presentation are declared elsewhere, in ways the studio cannot yet edit in place: said, not written.
  for (const kind of ["role", "grant", "sight", "lens", "brand"] as const) {
    const then = new Map(was.ofKind(kind).map((node) => [label(node), signature(was, node)]));
    const later = new Map(now.ofKind(kind).map((node) => [label(node), signature(now, node)]));
    for (const [name, sig] of later) {
      if (!then.has(name)) unwritten.push(`The ${kind} "${name}" is new — the studio cannot yet write that into the checkout.`);
      else if (then.get(name) !== sig) unwritten.push(`The ${kind} "${name}" changed — the studio cannot yet write that into the checkout.`);
    }
    for (const name of then.keys()) if (!later.has(name)) unwritten.push(`The ${kind} "${name}" is gone — remove it in the checkout.`);
  }

  /*
   * THE GRAPH SOMEBODY ALREADY HAS. What it needs to reach this declaration
   * is written into the app beside the change — its version moved on, the
   * steps as data — so the stored graph opens by running them.
   */
  const steps = migrationSteps(before, after);
  if (steps.length > 0) {
    const from = base?.version ?? 1;
    changes.push({
      what: "add-migration",
      version: from + 1,
      text: `stepsMigration(${literal({ from, to: from + 1, steps })})`,
      import: { name: "stepsMigration", from: "@graview/ship/browser" },
    });
  }

  return { changes, rewrite, unwritten };
}

/** A value as TypeScript: keys bare where they can be, on one line. */
function literal(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(literal).join(", ")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).map(([key, inner]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${literal(inner)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return JSON.stringify(value);
}

/**
 * THE CODE A CHANGE LEAVES SAYING SOMETHING UNTRUE.
 *
 * The declaration moved `tended-by` from the plot to the planting; the act
 * that ties a gardener to a plot still adds a `tended-by` edge FROM a plot,
 * and the rule that every plot has a caretaker still reads one. Both
 * compile. Both pass the checker, which judges declarations, not bodies.
 * Both are wrong the moment the app runs.
 *
 * So every act and rule the checkout wrote is read for the names the change
 * moved or took away, and each one that mentions them is named for
 * rewriting — by a person, a seat, or a person saying it still holds.
 */
export function codeTouched(changes: readonly DeclarationChange[], code: StudioDoorSource): readonly Rewrite[] {
  const literal = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A name said as a string — `"tended-by"` — or a field read as a property or a key.
  const said = (name: string) => new RegExp(`["'\`]${literal(name)}["'\`]`);
  const field = (name: string) => new RegExp(`(\\.|\\b)${literal(name)}\\b`);
  const marks: { test: RegExp; why: string }[] = changes.flatMap((change) => {
    switch (change.what) {
      case "move-edge":
        return [{ test: said(change.edge), why: `"${change.edge}" moved from ${change.from} to ${change.to}.` }];
      case "remove-edge":
        return [{ test: said(change.edge), why: `"${change.edge}" is no longer declared on ${change.kind}.` }];
      case "change-edge":
        return [{ test: said(change.edge), why: `"${change.edge}" on ${change.kind} changed.` }];
      case "remove-field":
        return [{ test: field(change.field), why: `${change.kind} no longer has "${change.field}".` }];
      case "change-field":
        return [{ test: field(change.field), why: `${change.kind}'s "${change.field}" changed type.` }];
      case "remove-kind":
        return [{ test: said(change.kind), why: `The kind "${change.kind}" is gone.` }];
      default:
        return [];
    }
  });
  const touched: Rewrite[] = [];
  for (const [sort, declared] of [["act", code.acts], ["rule", code.rules]] as const) {
    for (const [name, { text }] of Object.entries(declared)) {
      const reasons = marks.filter((mark) => mark.test.test(text)).map((mark) => mark.why);
      if (reasons.length > 0) touched.push({ sort, name, why: `It mentions what changed: ${reasons.join(" ")}` });
    }
  }
  return touched;
}
