import { beginning } from "../../beginning.js";
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

export function checkBlankInstallation<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, kinds, add } = ctx;
  /*
   * WHAT A BLANK INSTALLATION CAN ACTUALLY DO.
   *
   * `creates` and a nodeRef argument are together a chain — a feature cannot
   * be made until a zone exists — and it is invisible at build time: the
   * declaration is well-formed, every act is correct, and the gap only
   * appears at runtime on the one graph nobody tests against. A ten-kind app
   * can ship with one door and seven silent districts, and the first person
   * to open it is the first to find out.
   *
   * Notes rather than warnings, because every answer here is a legitimate
   * design: a kind a migration seeds, a catalogue that arrives whole, a
   * product whose data comes from a sync. The author should have to look at
   * it once, not argue with it forever.
   */
  const chain = beginning(app);
  /*
   * Only an app that says it MAKES things is asked how. An app whose every
   * act edits what is already there — a catalogue, a graph that arrives by
   * seed or sync — never claimed a way in, and telling it there is none is
   * a note with no question in it.
   */
  const claimsToMake = (app.mutations ?? []).some((mutation) => (mutation.creates ?? []).length > 0);
  if (!claimsToMake) {
    // Nothing to say: creation is not this app's business.
  } else if (chain.doors.length === 0 && kinds.size > 0) {
    add({
      severity: "note",
      code: "blank-graph-has-no-door",
      where: "mutations",
      message: `Nothing can be made in an empty ${app.name}: every act that creates a kind needs a node that does not exist yet.`,
      fix: `If the graph arrives seeded or synced, that is the answer and this is just the note. Otherwise give one act no required nodeRef, so a blank installation has a way in.`,
    });
  } else if (chain.unreachable.length > 0) {
    add({
      severity: "note",
      code: "blank-graph-unreachable",
      where: "mutations",
      message: `${chain.unreachable
        .map((entry) => `"${entry.kind}"`)
        .join(", ")} cannot be made from empty — ${chain.unreachable[0]!.why}. The way in is ${chain.doors
        .map((door) => `"${door}"`)
        .join(", ")}.`,
      fix: `Declare creates: ["<kind>"] on the act that adds one, or accept that these arrive by seed, migration or sync.`,
    });
  }
}
