/**
 * `@graview/core/traits` — WHAT A DECLARATION IS MADE OF, FOR A PAGE
 * (Roadmap f-document-traits, f-seat-reshape).
 *
 * The closed vocabulary (`TRAITS`), each trait's words (`TRAIT_WORDS`),
 * what each trait's module brings where an app lacks it (`TRAIT_BRINGS`)
 * and the reading of a document (`traitsOfDocument`, `hasTrait`) — and
 * nothing of the composer. A seat on a page says a change to the app in
 * these words and hands the reading to its host; the host composes with
 * `@graview/core/compose`, which is not a page's to carry: it holds the
 * editor and the critic, and a page that fetched it when asked made both
 * live up front. `traitsOf` of a TypeScript app, which writes the app as a
 * document first, is on `/compose` for the same reason.
 */
export { TRAIT_BRINGS, TRAITS, TRAIT_WORDS, hasTrait, traitsOfDocument, traitWords } from "./traits.js";
export type { Trait, TraitName } from "./traits.js";
