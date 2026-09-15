import type { GraviewApp, IntelligenceProviderDeclaration } from "../app.js";
import { beginning } from "../beginning.js";
import { deriveEditMutations } from "../mutations/derive-edits.js";
import type { AnySchema } from "../schema/schema.js";
import { hueFor } from "../theme/derive.js";
import { withArticle } from "../schema/define-node.js";

/**
 * WHAT THIS APP IS, READ OUT — the rung between `check` and a browser.
 *
 * "Run it and look" is the sentence every skill ends on, and it is the one
 * instruction an agent cannot follow: it can declare, and it cannot see. The
 * product that found thirty-one things in this framework said so plainly —
 * *"what no check caught, running it did"* — and listed four faults that
 * passed every static check and were obvious the moment somebody opened the
 * thing: a hue in the wrong unit, so every surface drew red; a lens built
 * from the wrong node set, so every piece of ground drew empty; a policy
 * declared with no principal supplied, so every act in the product was
 * refused; a colour that was not a token, so the contrast guarantee did not
 * apply.
 *
 * Every one of those is visible in a DESCRIPTION. The interface here is
 * derived, which is exactly what makes it describable: the same derivations
 * that draw a district, offer an act and refuse one can say what they would
 * do, in words, with no browser and no eyes.
 *
 * This is deliberately not a screenshot in prose. It states the things that
 * are wrong ON A SCREEN and invisible IN A FILE, and says nothing that
 * `check` already says.
 */

export interface DescribeOptions {
  /** A seat to answer "what can this person do" as. */
  readonly as?: { readonly kind: "human" | "agent"; readonly id?: string; readonly roles?: readonly string[] };
}

const list = (words: readonly string[]): string =>
  words.length === 0 ? "none" : words.length === 1 ? words[0]! : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

export function describeApp<S extends AnySchema>(
  app: GraviewApp<S>,
  options: DescribeOptions = {},
): string {
  const kinds = [...(app.schema.kinds as readonly string[])];
  const declared = app.mutations ?? [];
  const acts = [...declared, ...deriveEditMutations(app.schema, declared)];
  const lines: string[] = [`${app.name} — ${kinds.length} kinds, ${acts.length} acts (${declared.length} declared, ${acts.length - declared.length} derived).`];

  /*
   * WHAT A BLANK INSTALLATION MEETS. The first screen of every product, the
   * one the author never sees because their own graph has data in it.
   */
  const chain = beginning(app);
  lines.push("", "## Opening it empty");
  if (chain.doors.length === 0) {
    lines.push(`Nothing can be made. Every act that creates a kind needs a node that does not exist yet, so a blank installation is ${kinds.length} districts and no way in.`);
  } else {
    lines.push(
      `${chain.roots.length} of ${kinds.length} kinds can begin: ${list(chain.roots)} — through ${list(chain.doors.map((door) => `"${door}"`))}.`,
    );
    const waiting = chain.order.filter((entry) => (entry.depth ?? 0) > 0 && entry.depth !== null);
    for (const entry of waiting) {
      lines.push(`  ${entry.kind} waits for ${list(entry.needs)} (${entry.depth} deep).`);
    }
  }
  for (const entry of chain.unreachable) {
    lines.push(`  ${entry.kind} can never be made here — ${entry.why}.`);
  }

  /*
   * WHAT IS DRAWN, and what falls back. A kind with no view of its own is a
   * legitimate state and an invisible one: the framework's own list is
   * tidy enough that nobody notices the picture was never written.
   */
  lines.push("", "## What is drawn");
  if (!app.views) {
    /*
     * NOT "there are no views" — "nothing here can see them".
     *
     * A view registry is optional on `defineApp`, and most apps build theirs
     * in the UI package where the components are. That is a reasonable
     * place for it and it means the pictures are invisible to everything
     * outside a browser: this, `graview check`'s kind-without-view, and the
     * docs generator all go quiet rather than wrong. Saying which of the two
     * this is matters more than the count.
     */
    lines.push(
      `The declaration carries no view registry, so nothing outside a browser can see what is drawn. Pass it to defineApp({ views }) and check, docs and this can all read the pictures.`,
    );
  } else {
    const registered = new Set(app.views.kindsWithViews());
    const withOwn = kinds.filter((kind) => registered.has(kind));
    lines.push(
      withOwn.length === 0
        ? `No kind has a view of its own; every district draws the framework's list.`
        : `${withOwn.length} of ${kinds.length} kinds have a view of their own: ${list(withOwn)}.`,
    );
    const bare = kinds.filter((kind) => !registered.has(kind));
    if (bare.length > 0) lines.push(`  Drawn by the framework's list: ${list(bare)}.`);
    const places = app.views.places?.() ?? [];
    lines.push(
      places.length === 0
        ? "No group view is titled, so the bar lists no places and a page can link to none."
        : `${places.length} named places: ${list(places.map((place) => `"${place.title}" over the ${place.kind}s`))}.`,
    );
  }
  /*
   * THE HUES, IN DEGREES. Six kinds all landing within a few degrees of each
   * other is a city drawn in one colour, which reads as a rendering fault
   * and is a declaration the author can change.
   */
  const hues = kinds.map((kind) => ({ kind, hue: Math.round(hueFor(kind, app.brand?.accents)) }));
  const crowded = hues.filter((a, index) =>
    hues.some((b, other) => other !== index && Math.abs(a.hue - b.hue) < 12),
  );
  lines.push(
    `Hues: ${hues.map((entry) => `${entry.kind} ${entry.hue}°`).join(", ")}.` +
      (crowded.length > 1 ? ` ${list(crowded.map((entry) => entry.kind))} are within 12° of each other and will read as one colour.` : ""),
  );

  /*
   * WHAT A SEAT CAN DO. A policy with roles and a principal holding none of
   * them refuses everything, and the app looks broken rather than guarded —
   * which is a whole product's worth of struck-through buttons and no
   * error anywhere.
   */
  if (app.policy) {
    lines.push("", "## Who may do what");
    const roles = app.policy.roles ?? [];
    lines.push(`${roles.length} roles: ${list([...roles])}.`);
    const asked = options.as;
    if (asked) {
      const held = asked.roles ?? [];
      const permitted = acts.filter((act) =>
        (app.policy!.grants ?? []).some(
          (grant) =>
            (grant.roles === "*" || held.some((role) => (grant.roles as readonly string[]).includes(role))) &&
            (grant.mutations === "*" || (grant.mutations as readonly string[]).includes(act.name)),
        ),
      );
      lines.push(
        `As ${asked.id ?? asked.kind} holding ${list([...held])}: ${permitted.length} of ${acts.length} acts permitted.` +
          (permitted.length === 0
            ? " Every act in the product would be struck through — check the principal holds a role the policy grants."
            : ""),
      );
    } else {
      lines.push(`Pass --as <role> to see what one seat is offered; a principal holding no granted role is refused everything, silently.`);
    }
  }

  /* HOW A MODEL IS REACHED, and whether anything actually serves the door. */
  const providers = app.intelligence ?? [];
  if (providers.length > 0) {
    lines.push("", "## Intelligence");
    for (const provider of providers as readonly IntelligenceProviderDeclaration[]) {
      lines.push(
        `${provider.name} (${provider.kind}) — reached by ${list([...(provider.reach ?? [])]) || "nothing declared"}; may ${
          provider.may ? list([...provider.may]) : "every act"
        }.`,
      );
    }
  }

  /* WHAT IS JUDGED. A rule with no repair is a problem a person is told about and cannot fix. */
  const invariants = app.invariants ?? [];
  lines.push("", "## What is judged");
  if (invariants.length === 0) lines.push("No rules. Nothing about this graph can be wrong.");
  for (const invariant of invariants) {
    const scope = invariant.scope === "graph" ? "the whole graph" : `each ${withArticle((invariant.scope as { kind: string }).kind).slice(2)}`;
    lines.push(
      `${invariant.name} over ${scope} — ${
        invariant.repairs?.length ? `repairs with ${list([...invariant.repairs])}` : "NO REPAIR: a person is told and cannot act"
      }.`,
    );
  }

  return lines.join("\n");
}
