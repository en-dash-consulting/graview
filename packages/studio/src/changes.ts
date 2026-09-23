import type { AnySchema, DeclarationChange, GraviewApp } from "@graview/core";
import { camel, edgeParts, fieldsOf, kindLines, label, q, Read, zodSource, type Node } from "./source.js";
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
 * What the source cannot yet receive this way — an act, a rule, a role, a
 * grant, a renamed kind — is said, one sentence each, in `unwritten`. The
 * studio does not write anything while that list has something in it: half
 * a change applied is a checkout that disagrees with itself.
 */
export interface SourceChanges {
  readonly changes: readonly DeclarationChange[];
  readonly unwritten: readonly string[];
}

const KIND_PROPERTIES = ["description", "plural", "figure"] as const;

export function sourceChanges(before: Reading, after: Reading, base?: GraviewApp<AnySchema>): SourceChanges {
  const was = new Read(before);
  const now = new Read(after);
  const changes: DeclarationChange[] = [];
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

  // Everything else is code the checkout wrote, or policy: said, not written.
  for (const kind of ["act", "rule", "role", "grant", "lens", "brand"] as const) {
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
    const then = new Map(was.ofKind(kind).map((node) => [label(node), signature(was, node)]));
    const later = new Map(now.ofKind(kind).map((node) => [label(node), signature(now, node)]));
    for (const [name, sig] of later) {
      if (!then.has(name)) unwritten.push(`The ${kind} "${name}" is new — ${kind === "act" || kind === "rule" ? "its body is code, which" : "that"} the studio cannot yet write into the checkout.`);
      else if (then.get(name) !== sig) unwritten.push(`The ${kind} "${name}" changed — the studio cannot yet write that into the checkout.`);
    }
    for (const name of then.keys()) if (!later.has(name)) unwritten.push(`The ${kind} "${name}" is gone — remove it in the checkout.`);
  }

  return { changes, unwritten };
}
