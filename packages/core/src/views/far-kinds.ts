import type { EdgeKindInfo } from "../schema/schema.js";

/** What of a schema says a relation's ends. */
export interface EdgesOf {
  edge(kind: string): EdgeKindInfo | undefined;
}

/*
 * THE RELATIONS A VIEW READS AND IS NEVER HANDED (Roadmap
 * f-view-authoring-friction-2026-11, HQ f-view-problem-key-follow-ups): a
 * relation in a worker view's `reads.edges` with an end no kind the view is
 * handed is on — neither its own nor one in `reads.kinds` — so no link of it
 * ever reaches the view. Here, in core, so a proposed view
 * (`checkProposedManifest`, `@graview/guest/host/views`) and a template's
 * views (`graview check`) are refused in the same words by one check.
 */

/** What of a worker view's manifest says which kinds and relations it is handed. */
export interface ViewReads {
  readonly name: string;
  readonly attach: string;
  readonly cardinality: "one" | "many";
  readonly reads?: { readonly kinds?: readonly string[]; readonly edges?: readonly string[] };
}

/**
 * Each relation a view reads and is never handed, with the kinds that would
 * hand it; none, where it goes to any kind (`to: "*"`) and a view of one is
 * handed only its own record, since which kinds it links to is the author's
 * to say.
 */
export function unhandedEdges(schema: EdgesOf, manifest: Omit<ViewReads, "name">): readonly { readonly edge: string; readonly kinds: readonly string[] }[] {
  const handed = new Set([...(manifest.attach === "home" ? [] : [manifest.attach]), ...(manifest.reads?.kinds ?? [])]);
  const out: { edge: string; kinds: string[] }[] = [];
  for (const name of manifest.reads?.edges ?? []) {
    const edge = schema.edge(name);
    if (!edge) continue;
    const from = edge.from.some((kind) => handed.has(kind)) ? [] : edge.from;
    const to = edge.to === "*" || edge.to.some((kind) => handed.has(kind)) ? [] : edge.to;
    const kinds = [...new Set([...from, ...to])];
    if (kinds.length > 0) out.push({ edge: name, kinds });
    else if (edge.to === "*" && manifest.attach !== "home" && manifest.cardinality === "one" && (manifest.reads?.kinds ?? []).length === 0) out.push({ edge: name, kinds: [] });
  }
  return out;
}

/**
 * WHAT NAMES ONE STANDING FAULT OF A VIEW, THE SAME IN EVERY VERSION
 * (HQ f-view-check-refuses-unread-relation-kind): the view's name, the
 * relation and the kinds any one of which would hand it, sorted and joined
 * by `|` (`*` where it goes to any kind and the author is to say which),
 * never the sentence, which may be reworded. A host that files what a page
 * reports files it once by this, however often the view is opened and
 * whichever version of the app it is opened in, while the relation joins
 * the same kinds: `far-kind-not-handed:phase-board:inPhase:chunk`.
 */
export function farKindKey(view: string, edge: string, kinds: readonly string[]): string {
  return `far-kind-not-handed:${view}:${edge}:${kinds.length === 0 ? "*" : [...kinds].sort().join("|")}`;
}

/** Each relation a view reads and is never handed, said, with the key a host files it by (`farKindKey`). */
export function unhandedEdgeProblems(schema: EdgesOf, manifest: ViewReads): readonly { readonly edge: string; readonly kinds: readonly string[]; readonly says: string; readonly key: string }[] {
  return unhandedEdges(schema, manifest).map(({ edge, kinds }) => {
    const info = schema.edge(edge)!;
    const ends = `${info.from.join(" or ")} to ${info.to === "*" ? "any kind" : info.to.join(" or ")}`;
    const says =
      kinds.length === 0
        ? `"${manifest.name}" reads the relation "${edge}", from ${ends}, and is handed no other kind, so no link of it reaches the view: name the kinds it links to in its manifest's reads.kinds.`
        : `"${manifest.name}" reads the relation "${edge}", from ${ends}, and is handed no ${kinds.join(" or ")}, so no link of it reaches the view: add ${kinds.map((kind) => `"${kind}"`).join(" or ")} to its manifest's reads.kinds.`;
    return { edge, kinds, says, key: farKindKey(manifest.name, edge, kinds) };
  });
}

/**
 * WHAT A VIEW PROPOSED IS REFUSED FOR, BEYOND ITS MANIFEST'S OWN CHECK: each
 * relation it reads whose far kind it is never handed, with the kind to add.
 * A relation to any kind names no kind to add, and stays a problem said
 * beside the drawing rather than a refusal.
 */
export function farKindsRefused(schema: EdgesOf, manifest: ViewReads): readonly string[] {
  return unhandedEdgeProblems(schema, manifest).flatMap((one) => (one.kinds.length > 0 ? [one.says] : []));
}
