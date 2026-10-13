/**
 * `@graview/core/provenance` — WHERE A LINK CAME FROM, AND WHAT A CHANGE WAS
 * BASED ON, IN WORDS (FR-172).
 *
 * An op may carry a `lineage` (on the main entry, with the check every
 * change is held to); this reads it back: whether a link is provisional —
 * made less than sure, by someone other than a person, and not yet kept by
 * one — who made it and why, and a lineage said as a history line says it.
 * Its own entry because only what draws a link or a history line reads it:
 * a page that draws neither on its first load does not carry it.
 */
export { isProvisional, lineageWords, linkKey, linkProvenance, linkProvenances, provenanceWords, provisionalLinks } from "./ops/provenance.js";
export type { HasLog, LinkProvenance, LinkRef } from "./ops/provenance.js";
