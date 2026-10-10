import { brokenWords, type AnySchema } from "@graview/core";
import { POPOVER_STYLE, usePopover, useSelection, useViolations } from "@graview/react/provider";
import { Suspense, useEffect, useState } from "react";
import { toolStyle } from "../app-bar.js";
import { barPanes } from "../bar-panes-door.js";

// The rows, fetched when reached for, and asked for again when they did not arrive (FR-139): a list item says so in the list.
type RowsProps = Parameters<typeof import("../bar-panes.js").ProblemRows>[0];
const ProblemRows = barPanes.part((panes, props: RowsProps) => <panes.ProblemRows {...props} />, { what: "The problems", as: "li" });
const fetchRows = () => barPanes.prefetch();


/**
 * Whether the rules hold, stated where it can always be seen.
 *
 * Zero is an answer too: a person wants the reassurance as much as the alarm,
 * so a clean state reads as a statement rather than as a disabled control.
 * Opening a problem SELECTS what it names, and the repairs arrive through the
 * ordinary inspector because repairs already outrank every other provider
 * there — no second path and no second rendering of an action.
 */
export function Standing({
  clean = "All rules hold",
}: {
  /** What to say when nothing is broken, in the app's own words: the tool's name, and what it says on hover. */
  readonly clean?: string;
}) {
  const violations = useViolations<AnySchema>();
  const { set } = useSelection();
  const count = violations.length;
  /*
   * ONE OF THE FAMILY (FR-77): Escape or a press anywhere else closes it
   * and gives the keyboard back to Standing; opening it closes any other
   * popover. A popover that only closes by pressing the thing that opened
   * it is a popover you end up dragging around the screen, and this one
   * sits over the scene. Open only while there is something broken: the
   * last repair closes it.
   */
  const [asked, setAsked] = useState(false);
  const popover = usePopover("problems", { open: asked && count > 0, onOpenChange: setAsked });
  const open = popover.open;
  const said = standingWords(violations, clean);
  // A rule broken is a press likely to come: its rows are fetched once the page has drawn, not when it is pressed.
  useEffect(() => {
    if (count === 0) return;
    const later = setTimeout(fetchRows, 1500);
    return () => clearTimeout(later);
  }, [count > 0]);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      {/*
        * ONE OF THE BAR'S TOOLS (FR-131): a dot in the tone of the rules —
        * good, or the warning's, or the bad's when a rule could not even be
        * judged — and a number only when one is broken. The words are its
        * name and its hover; it stays reachable when all is well, so a reader
        * moving by keyboard hears that too.
        */}
      <button
        type="button"
        data-testid="standing"
        {...popover.trigger}
        aria-disabled={count === 0 ? true : undefined}
        aria-label={said}
        onClick={count === 0 ? undefined : popover.toggle}
        onPointerEnter={count === 0 ? undefined : fetchRows}
        onFocus={count === 0 ? undefined : fetchRows}
        title={said}
        style={{ ...toolStyle, padding: count === 0 ? 0 : "0 8px", cursor: count === 0 ? "default" : "pointer", color: count === 0 ? "var(--graview-ink-muted)" : tone(violations), fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
      >
        <StandingDot tone={count === 0 ? "var(--graview-good)" : tone(violations)} />
        {count > 0 ? <span aria-hidden="true">{count}</span> : null}
      </button>

      {open ? (
        <ol
          {...popover.pane}
          data-testid="problems"
          style={{
            ...POPOVER_STYLE,
            width: 300,
            maxHeight: "min(48cqh, 420px)",
            overflow: "auto",
            margin: 0,
            padding: 4,
            listStyle: "none",
            display: "grid",
            borderRadius: 10,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
          }}
        >
          <Suspense fallback={null}>
            <ProblemRows
              violations={violations}
              pick={(violation) => {
                set(violation.nodeIds);
                popover.setOpen(false);
              }}
            />
          </Suspense>
        </ol>
      ) : null}
    </div>
  );
}

/**
 * What the standing says: its name, and its hover (FR-131). Counted as
 * rules — "2 rules broken", "1 rule broken in 3 places" — the way a person
 * says it, and the way the problems themselves are drawn.
 */
export function standingWords(violations: readonly { readonly invariant: string }[], clean: string): string {
  return violations.length === 0 ? clean : `${brokenWords(violations)} — open what is broken, and what would fix it`;
}

/** A broken rule is a warning; a rule that could not be judged at all is bad. */
const tone = (violations: readonly { readonly status?: string }[]): string =>
  violations.some((violation) => violation.status === "could-not-judge" || violation.status === "over-budget") ? "var(--graview-bad)" : "var(--graview-warn)";

/** The dot itself: eight pixels in the tone of the rules. */
export function StandingDot({ tone: color }: { readonly tone: string }) {
  return <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, flex: "0 0 auto", background: color }} />;
}
