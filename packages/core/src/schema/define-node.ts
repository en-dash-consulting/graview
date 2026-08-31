import type { z } from "zod";
import type {
  AnyNodeDefinition,
  EdgeMap,
  EmptyEdgeMap,
  NodeDefinition,
  NodeDefinitionSpec,
} from "./types.js";

/**
 * The single declaration everything else derives from. Views, agent tool
 * schemas, drag legality, aggregate contents and accessibility labels all
 * read this — nothing is sealed, every derived value stays inspectable.
 */
export function defineNode<
  const K extends string,
  F extends z.ZodObject<z.ZodRawShape>,
  const E extends EdgeMap = EmptyEdgeMap,
>(kind: K, spec: NodeDefinitionSpec<F, E>): NodeDefinition<K, F, E> {
  return {
    ...spec,
    kind,
    edges: (spec.edges ?? ({} as E)) as E,
  };
}

/** Resolves a node's display label, honouring the declaration's override. */
export function labelOf(
  definition: AnyNodeDefinition | undefined,
  node: { id: string; kind: string } & Record<string, unknown>,
): string {
  if (definition?.label) {
    return definition.label(node as never);
  }
  const own = node["label"];
  return typeof own === "string" && own.length > 0 ? own : node.id;
}

/**
 * Prose, shortened to a length, at a WORD BOUNDARY.
 *
 * Every app here had `text.slice(0, 60)` in its label function, and every one
 * of them produced headings like "Hold the banked hour for a night s" — cut
 * mid-word, with no ellipsis, in the largest type on the page. It is the
 * obvious thing to write and it is wrong every time, so the framework should
 * own it rather than leaving each app to discover it.
 *
 * A single word longer than the limit is still cut, because the alternative
 * is a heading that ignores the limit it was given.
 */
export function summarise(text: string, max = 60): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const boundary = cut.lastIndexOf(" ");
  // A trailing comma or full stop before the ellipsis reads as a typo.
  return `${(boundary > max * 0.5 ? cut.slice(0, boundary) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

/** Resolves a node's prose description, used for a11y and tool text. */
export function describeNode(
  definition: AnyNodeDefinition | undefined,
  node: { id: string; kind: string } & Record<string, unknown>,
): string {
  if (definition?.describe) {
    return definition.describe(node as never);
  }
  return `${node.kind} ${labelOf(definition, node)}`;
}
