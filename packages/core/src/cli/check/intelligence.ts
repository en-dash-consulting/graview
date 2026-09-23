import { undecidableArguments } from "../../mutations/decidable.js";
import type { AnySchema } from "../../schema/schema.js";

/**
 * `note` is a QUESTION ASKED OUT LOUD, not a problem.
 *
 * Some things a checker can see are legitimate designs that the author
 * should nonetheless have looked at once: a lens written for this app and
 * never proved against another domain, a role name two vocabularies both
 * use, a kind unreachable on an empty graph. Filed as warnings they would
 * be warnings that can only ever be acknowledged, and those are the ones
 * people learn to scroll past — which costs the checker its authority on
 * the warnings that matter. So they have their own voice: counted, printed,
 * and never a failure.
 */
import type { CheckContext } from "./context.js";

export function checkProviders<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, mutations, add } = ctx;
  /*
   * A declared provider's allowlist must name real mutations — a metering
   * or narrowing rule pointing at nothing enforces nothing.
   */
  const DOORS = ["paste", "mcp", "key", "local"] as const;
  for (const provider of app.intelligence ?? []) {
    for (const may of provider.may ?? []) {
      if (!mutations.has(may)) {
        add({
          severity: "error",
          code: "intelligence-unknown-mutation",
          where: `intelligence["${provider.name}"].may`,
          message: `Provider "${provider.name}" is allowed "${may}", which is not registered.`,
          fix: `Register the mutation, or remove it from the allowlist.`,
        });
      }
    }
    /*
     * THE DOORS, asked about. A declaration that says how a provider is
     * reached is worth having only if the answers are the ones the seat and
     * the docs can act on, and if the two that owe a second sentence are
     * made to give it: a local reach with nothing serving it is a door onto
     * a wall, and a key typed into a browser with no storage story is the
     * kind of thing nobody notices until it is somebody's key.
     */
    const reach = provider.reach ?? [];
    for (const door of reach) {
      if (!(DOORS as readonly string[]).includes(door)) {
        add({
          severity: "error",
          code: "intelligence-reach-unknown",
          where: `intelligence["${provider.name}"].reach`,
          message: `"${door}" is not a way a provider can be reached.`,
          fix: `Use one of: ${DOORS.join(", ")}.`,
        });
      }
    }
    if (reach.length > 0 && provider.kind === "graph") {
      add({
        severity: "warning",
        code: "intelligence-reach-on-graph",
        where: `intelligence["${provider.name}"].reach`,
        message: `"${provider.name}" is a graph provider: it IS the graph, so there is no door to it.`,
        fix: `Drop reach, or declare the provider as "llm", "external" or "decision".`,
      });
    }
    if (reach.includes("local") && !provider.bridge) {
      add({
        severity: "warning",
        code: "intelligence-local-without-bridge",
        where: `intelligence["${provider.name}"]`,
        message: `"${provider.name}" says it can be reached locally and names no bridge, so nothing serves that door.`,
        fix: `Add bridge: "<path>" and serve it with localIntelligence() from @graview/ship/dev.`,
      });
    }
    /*
     * A DECISION PROVIDER IS HELD TO WHAT IT CAN DECIDE. It answers in a
     * choice, a truth or a score and never in prose, so an act on its
     * allowlist that wants a label or a note is an act it could never call
     * — and an allowlist that promises one is a promise the seat would
     * break silently, by asking a question that has no typed answer. Absent
     * `may` means every act, and is held to every act.
     */
    if (provider.kind === "decision") {
      for (const mutation of app.mutations ?? []) {
        if (provider.may !== undefined && !provider.may.includes(mutation.name)) continue;
        const wants = undecidableArguments(mutation);
        if (wants.length === 0) continue;
        add({
          severity: "error",
          code: "intelligence-decision-cannot-call",
          where: `intelligence["${provider.name}"].may`,
          message: `"${provider.name}" decides and does not write, and "${mutation.name}" needs ${wants
            .map((want) => `${want.name} (${want.control})`)
            .join(", ")} — which no typed answer can supply.`,
          fix:
            provider.may === undefined
              ? `Give "${provider.name}" a may: [...] naming only the acts whose arguments are choices, node references, truths or bounded numbers.`
              : `Drop "${mutation.name}" from may, or make its ${wants.map((want) => want.name).join(", ")} optional.`,
        });
      }
      if (reach.includes("paste") || reach.includes("mcp")) {
        add({
          severity: "warning",
          code: "intelligence-decision-prose-door",
          where: `intelligence["${provider.name}"].reach`,
          message: `"${provider.name}" decides and has no prose, so a paste or MCP door — words out, words back — leads nowhere.`,
          fix: `Reach a decision provider by "key" or "local".`,
        });
      }
    }
    if (reach.includes("key") && !provider.keyStorage) {
      add({
        severity: "warning",
        code: "intelligence-key-without-storage",
        where: `intelligence["${provider.name}"]`,
        message: `"${provider.name}" takes a person's own key and does not say where it is kept.`,
        fix: `Add keyStorage: "<where, in your own words>" — a person handing over a key is owed the sentence.`,
      });
    }
  }
}

export function checkModelWritten<S extends AnySchema>(ctx: CheckContext<S>): ReadonlySet<string> {
  const { app, kinds, add } = ctx;
  /*
   * The kinds a declared intelligence provider can bring into existence —
   * which is the set whose labels are written by something that has never
   * been told what a label is for.
   */
  const writtenByAModel = new Set<string>();
  for (const provider of app.intelligence ?? []) {
    for (const mutation of app.mutations ?? []) {
      if (provider.may !== undefined && !provider.may.includes(mutation.name)) continue;
      for (const made of mutation.creates ?? []) writtenByAModel.add(made);
    }
  }

  for (const kind of Object.keys(app.brand?.figures ?? {})) {
    if (kinds.has(kind)) continue;
    add({
      severity: "error",
      code: "figure-unknown-kind",
      where: `brand.figures["${kind}"]`,
      message: `The brand draws a figure for "${kind}", which this app does not declare.`,
      fix: `Remove it, or declare the kind.`,
    });
  }
  return writtenByAModel;
}
