/**
 * `@graview/tools/frame` — WHAT EVERY FACE'S FRAME ASKS OF THE TOOLS: THE
 * READER'S RUNG (FR-57).
 *
 * Everything here is also exported from `@graview/tools`. It is its own
 * entry because a bundler splits a page by which files its first chunk can
 * reach, and `@graview/tools` reaches the providers, the chat, the agent's
 * tool surface and the models: a provider that read the reader's rung from
 * it carried all of them into every page, though only the inspector, the
 * companion and the pages' acts use them, and they are fetched with their
 * face. `@graview/react/provider` imports from here, and nothing else.
 *
 * The reader's pins and the fields a record lets them change were here
 * too, and rode in every page's first chunk for it: only the inspector and
 * a drawn record use them, so they are `@graview/tools`' alone.
 */
export { DEFAULT_INTELLIGENCE, loadIntelligenceConfig, RUNGS, rungFor, rungHonesty, saveIntelligenceConfig } from "./rungs.js";
export type { IntelligenceConfig, IntelligenceSource } from "./rungs.js";
export type { Affordance, AffordanceProvider, AffordanceSet, DeriveContext, Observation, OpenParameter, ProviderName, WithheldAffordance } from "./types.js";
