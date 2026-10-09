/**
 * `@graview/tools/frame` — WHAT EVERY FACE'S FRAME ASKS OF THE TOOLS: THE
 * AI THE HOST GAVE IT, AS A TYPE AND A FEW WORDS (FR-57).
 *
 * Everything here is also exported from `@graview/tools`. It is its own
 * entry because a bundler splits a page by which files its first chunk can
 * reach, and `@graview/tools` reaches the providers, the chat, the agent's
 * tool surface and the models: a provider that read the host's AI from
 * it carried all of them into every page, though only the inspector, the
 * seat's panel and the pages' acts use them, and they are fetched with
 * their face. `@graview/react/provider` imports from here, and nothing else.
 *
 * The reader's pins and the fields a record lets them change were here
 * too, and rode in every page's first chunk for it: only the inspector and
 * a drawn record use them, so they are `@graview/tools`' alone.
 */
export { aiTalks, aiVia, ANSWERED_WITH_AI, NO_AI, NO_AI_SAID } from "./ai.js";
export type { HostAi } from "./ai.js";
export type { Affordance, AffordanceProvider, AffordanceSet, DeriveContext, Observation, OpenParameter, ProviderName, WithheldAffordance } from "./types.js";
