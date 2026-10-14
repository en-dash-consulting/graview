import { numberAsRead, type Violation } from "@graview/core";
import { kindCardId, withFocus, withOverview, withWithin } from "@graview/layout/view";
import { useNavigation, useSelection } from "@graview/react/provider";
import { askForProblems } from "./map-asks.js";

/*
 * "⚠ N" ON A DISTRICT IS THE NUMBER OF PROBLEMS, AND A CONTROL.
 *
 * The cards used to paint the MEMBER count in the warning color with a ⚠
 * whenever any member was flagged — "⚠ 36" on a district with one problem —
 * so nobody could tell what the number was or do anything about it. A
 * district says its members as a plain count, and its problems here, from
 * the same violations the bar's "● N" counts: a rule broken that names one
 * of its records. Pressed, it brings those problems up beside the map (the
 * panel on a desk, the sheet on a phone) — from the ground it rises to the
 * map first, which is where the panel stands.
 */

/** The problems that name a record of this district: one source for the card, the panel and the bar. */
export function problemsIn(violations: readonly Violation[], members: readonly { readonly id: string }[]): readonly Violation[] {
  if (violations.length === 0 || members.length === 0) return [];
  const ids = new Set(members.map((member) => member.id));
  return violations.filter((violation) => violation.nodeIds.some((id) => ids.has(id)));
}

/** What a district's problem count is called, to a screen reader: "1 problem in Rooms". */
export const problemsNamed = (count: number, plural: string): string => `${numberAsRead(count)} ${count === 1 ? "problem" : "problems"} in ${plural}`;

export function ProblemCount({
  kind,
  plural,
  problems,
  flag,
  listed = false,
}: {
  readonly kind: string;
  /** The kind in the plural, as the district says it. */
  readonly plural: string;
  readonly problems: readonly Violation[];
  /** The mark the kit draws for a flagged thing. */
  readonly flag: string;
  /** Whether the panel beside the map is listing this district now. */
  readonly listed?: boolean;
}) {
  const { view, go } = useNavigation();
  const { set: choose } = useSelection();
  if (problems.length === 0) return null;
  const name = problemsNamed(problems.length, plural);
  const them = problems.length === 1 ? "it" : "them";
  return (
    <button
      type="button"
      className="graview-district-problems"
      data-testid={`district-problems-${kind}`}
      data-graview-problems={problems.length}
      aria-expanded={listed}
      aria-label={name}
      // The first one's own sentence, for a quick look; the rest are a press away.
      title={`${name} — ${problems[0]!.message}${problems.length > 1 ? ` (and ${numberAsRead(problems.length - 1)} more)` : ""}. Press to see ${them} and how to fix ${them}.`}
      onClick={(event) => {
        event.stopPropagation();
        // The panel stands beside the map: from the ground, rise to it.
        // Not into a picture of the kind: its problems are the district's, so the focus is let go.
        if (!view.overview) go(withWithin(withFocus(withOverview(view, true), null), "view", null));
        choose([kindCardId(kind)]);
        askForProblems(kind);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span aria-hidden="true">{`${flag} ${numberAsRead(problems.length)}`}</span>
    </button>
  );
}
