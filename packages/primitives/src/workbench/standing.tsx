import { brokenWords } from "@graview/core";
import { useViolations } from "@graview/react/provider";
import { toolStyle } from "../app-bar.js";

/**
 * THAT THE RULES HOLD, stated where it can always be seen: a person wants the
 * reassurance as much as the alarm, so a clean state reads as a statement
 * rather than as a disabled control.
 *
 * WHILE ONE IS BROKEN IT IS NOT HERE (Roadmap f-inbox-needs-you-first). A
 * second dot with a second count, by the person, opening a second list of
 * symbols ("quote = —"), was one more place to look: a rule broken is the
 * inbox's to say, under Needs you, in words, with its fix (`inbox-pane.tsx`).
 */
export function Standing({
  clean = "All rules hold",
}: {
  /** What to say when nothing is broken, in the app's own words: the tool's name, and what it says on hover. */
  readonly clean?: string;
}) {
  const count = useViolations().length;
  if (count > 0) return null;
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      {/* One of the bar's tools (FR-131): it stays reachable, so a reader moving by keyboard hears that all is well too. */}
      <button type="button" data-testid="standing" aria-disabled aria-label={clean} title={clean} style={{ ...toolStyle, position: "relative", cursor: "default", color: "var(--graview-ink-muted)" }}>
        <StandingDot tone="var(--graview-good)" />
      </button>
    </div>
  );
}

/** What is said of the rules, as their name and their hover (FR-131), counted as rules: "2 rules broken", "1 rule broken in 3 places". */
export function standingWords(violations: readonly { readonly invariant: string }[], clean: string): string {
  return violations.length === 0 ? clean : brokenWords(violations);
}

/**
 * The dot itself: eight pixels in the tone of the rules — and, where a rule
 * is broken, the warning's mark in that tone (Roadmap
 * f-better-bare-app-defaults), so a broken rule is never told by hue alone;
 * its words are the tool's name and hover.
 */
export function StandingDot({ tone: color, broken = false }: { readonly tone: string; readonly broken?: boolean }) {
  if (broken) return <span aria-hidden="true" data-graview-standing-mark="" style={{ flex: "0 0 auto", color, fontSize: "0.875rem", lineHeight: 1 }}>⚠</span>;
  return <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, flex: "0 0 auto", background: color }} />;
}
