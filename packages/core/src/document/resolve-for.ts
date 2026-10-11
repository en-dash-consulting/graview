import type { Principal } from "../permissions/types.js";
import { compileBlocks, resolveBlocks, type ResolvedBlock, type SpecBlock } from "./blocks.js";
import { blockContextFor, type BlockContextOptions, type BlockSource } from "./block-context.js";
import type { Money } from "./template.js";
import type { ViewSpecsByKind } from "./views.js";

/*
 * On `@graview/core/describe`, apart from the context it reads blocks in
 * (`blockContextFor`, `block-context.ts`): a face that holds its blocks
 * parsed reads them in that context, and does not carry the lookup of a
 * declaration's views that only `describe_place` and a product's own face
 * ask for — a bundler gives a whole module to every chunk that can reach it.
 */

/** What a declaration says its blocks with: its kinds' views, its home, and its brand's currency and locale. A `GraviewApp` is one. */
export interface DeclaredBlocks {
  readonly viewSpecs?: ViewSpecsByKind;
  readonly home?: readonly unknown[];
  readonly brand?: Money;
}

export interface ResolveForOptions extends BlockContextOptions {
  /** The declaration whose blocks these are: the record kind's `viewSpecs` (`views.<kind>`), or its `home` about no record — said in its brand's money. */
  readonly app?: DeclaredBlocks;
  /** Blocks of the caller's own instead — a blocks lens's — as declared, or as `compileBlocks` parsed them. */
  readonly blocks?: readonly unknown[] | readonly SpecBlock[];
}

/**
 * A RECORD'S DECLARED BLOCKS, RESOLVED (`views.<kind>.page` by default, a
 * `slot` for its card or row), or the home's for no record — or `blocks` of
 * the caller's own — over what `principal` may see, exactly as the scene,
 * the pages face and `describe_place` resolve them. Each resolved block
 * carries its key, which a face claims it by. Empty when nothing is declared.
 */
export function resolveFor(store: BlockSource, principal: Principal | null, node: { readonly id: string; readonly kind: string } | null, options: ResolveForOptions = {}): readonly ResolvedBlock[] {
  const { app, blocks = node ? app?.viewSpecs?.[node.kind]?.[options.slot ?? "page"] : app?.home } = options;
  if (!blocks?.length) return [];
  // About no record and from the declaration, the blocks are the home: its first headline is the page's own.
  const firstHeading = options.firstHeading ?? (node || options.blocks ? undefined : 1);
  // Parsed already where its first block says what it is (`t`), as `compileBlocks` writes it; else as declared.
  const ctx = blockContextFor(store, principal, node, { ...options, money: options.money ?? app?.brand, firstHeading });
  // A record the seat may not see has no page to read to it.
  if (node && !ctx.node) return [];
  return resolveBlocks(typeof (blocks[0] as SpecBlock | null)?.t === "string" ? (blocks as readonly SpecBlock[]) : compileBlocks(blocks), ctx);
}
