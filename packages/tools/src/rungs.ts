import type { IntelligenceCapability } from "@graview/core";

/**
 * THE INTELLIGENCE LADDER, as configuration a person can climb.
 *
 * Four rungs: the graph answers for itself (keyless, always there); a
 * model runs in the person's own browser (free after the download, and
 * nothing leaves the machine); a decision provider answers typed questions
 * exactly and has no prose; a frontier model answers over the network with
 * the person's own key. The three that talk are the same Responder
 * contract, and the one that does not says so in its answers — so choosing
 * a rung is choosing a config value, and whatever answers, its proposals
 * still travel the one validated path.
 *
 * The config is plain serialisable data in the BROWSER's storage, because
 * an API key belongs to the person at the keyboard: it must never sit in a
 * repo, a bundle, or a declaration that ships.
 */

export type IntelligenceSource = "graph" | "local" | "decision" | "remote";

export interface IntelligenceConfig {
  readonly source: IntelligenceSource;
  readonly local?: {
    /** A WebLLM model id. The default is small enough to be honest about. */
    readonly model?: string;
  };
  /**
   * THE DECISION RUNG: a provider that answers typed questions exactly
   * and has no prose. Reached with the person's own key straight from
   * this browser, or through the dev server's decision door — which holds
   * the key on its side, so a browser never does. With neither, the
   * default is the door at its default path.
   */
  readonly decision?: {
    readonly apiKey?: string;
    /** The door's path when the key is on the server side. */
    readonly bridge?: string;
    readonly model?: string;
  };
  readonly remote?: {
    readonly preset?: "xai" | "custom";
    /** For `custom`: any OpenAI-compatible /chat/completions endpoint. */
    readonly baseUrl?: string;
    readonly apiKey: string;
    readonly model?: string;
  };
}

export const DEFAULT_INTELLIGENCE: IntelligenceConfig = { source: "graph" };

/**
 * FOUR RUNGS, TWO AXES. Each rung says which capabilities it serves; a
 * surface asks for a capability, never for a rung; and what the chosen
 * rung cannot serve falls DOWN to the graph, which is keyless and always
 * there. Pretending the ladder has one axis is how a switch starts lying:
 * a decision provider is the best rung for a decision and no rung at all
 * for prose.
 */
export const RUNGS: Readonly<
  Record<IntelligenceSource, { readonly label: string; readonly serves: readonly IntelligenceCapability[] }>
> = {
  graph: { label: "Graph only", serves: ["decide", "propose"] },
  local: { label: "Onboard AI", serves: ["prose", "decide", "propose"] },
  decision: { label: "Jev", serves: ["decide"] },
  remote: { label: "LLM", serves: ["prose", "decide", "propose"] },
};

/**
 * Which rung answers a capability under this config: the chosen one when
 * it serves the capability, the graph otherwise — with `fell` saying so,
 * which is what a seat's honesty sentence is made of.
 */
export function rungFor(
  config: IntelligenceConfig,
  capability: IntelligenceCapability,
): { readonly rung: IntelligenceSource; readonly fell: boolean } {
  if (RUNGS[config.source].serves.includes(capability)) return { rung: config.source, fell: false };
  return { rung: "graph", fell: true };
}

/** The sentence a seat says on a rung that cannot talk. Part of the answer, not chrome. */
export function rungHonesty(config: IntelligenceConfig, capability: IntelligenceCapability): string | undefined {
  const { fell } = rungFor(config, capability);
  if (!fell) return undefined;
  const rung = RUNGS[config.source].label;
  return capability === "prose"
    ? `(${rung} decides rather than talks — the graph is answering here.)`
    : `(${rung} cannot ${capability} — the graph is answering here.)`;
}

const STORED = "graview:intelligence";

/** The saved rung, or the keyless default — never a throw. */
export function loadIntelligenceConfig(): IntelligenceConfig {
  try {
    const raw = globalThis.localStorage?.getItem(STORED);
    if (!raw) return DEFAULT_INTELLIGENCE;
    const parsed = JSON.parse(raw) as IntelligenceConfig;
    if (parsed.source in RUNGS) return parsed;
    return DEFAULT_INTELLIGENCE;
  } catch {
    return DEFAULT_INTELLIGENCE;
  }
}

export function saveIntelligenceConfig(config: IntelligenceConfig): void {
  try {
    globalThis.localStorage?.setItem(STORED, JSON.stringify(config));
  } catch {
    // A rung that cannot be remembered still applies for this visit.
  }
}
