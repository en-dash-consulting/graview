/*
 * `@graview/core/blocks` — a view's blocks resolved against a record, and
 * the computed values they read.
 *
 * An entry of its own, not part of `@graview/core/document`: a hosted page
 * imports that barrel up front to compile its document, and a bundler
 * places a whole module in every chunk that can reach it — so a resolver
 * only the faces call, once they are fetched to draw, rode in what every
 * hosted page loads first. The views that draw blocks, the pages and an
 * agent's seat import it from here, and it loads when they do.
 */
export { compileBlocks, fieldSpecsOf, isTallBlock, resolveBlocks, safeHref, sayNumber, whatBlocksSay } from "./document/blocks.js";
export type { BlockContext, BlocksSaid, ResolvedBlock, ResolvedList, SpecBlock } from "./document/blocks.js";
export { computedNames, computedValues, withComputed } from "./document/computed-values.js";
export type { ComputedRecord, ComputedValues, PlainComputed } from "./document/computed-values.js";
