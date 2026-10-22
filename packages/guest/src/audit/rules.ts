/*
 * THE RULES AN AUDIT OF A DRAWN VIEW HOLDS IT TO (Roadmap f-view-a11y-audit),
 * each with the WCAG 2.2 success criterion it reads, and what it needs to be
 * measured at all: the drawing's structure alone (a headless run's tree of
 * plain objects, or a page), a browser's layout and styles, or a person's
 * keys pressed in one.
 */

export type AuditRuleId =
  | "keyboard"
  | "role"
  | "name"
  | "toggle-state"
  | "nested-interactive"
  | "img-alt"
  | "svg-name"
  | "scroll-region"
  | "focus-visible"
  | "contrast"
  | "keyboard-trap";

export interface AuditRule {
  /** The WCAG 2.2 success criterion it reads, by number. */
  readonly wcag: string;
  /** What it holds, in a sentence. */
  readonly says: string;
  /**
   * Where it can be measured: `structure` wherever the drawing is (headless
   * or on a page), `layout` only in a browser that lays the page out, `keys`
   * only where a person's keys are pressed (a Playwright-driven Tab walk).
   */
  readonly needs: "structure" | "layout" | "keys";
}

export const AUDIT_RULES: Readonly<Record<AuditRuleId, AuditRule>> = {
  keyboard: { wcag: "2.1.1", says: "What a person can click is reached by the keyboard.", needs: "structure" },
  role: { wcag: "4.1.2", says: "What takes the keyboard says what it is.", needs: "structure" },
  name: { wcag: "4.1.2", says: "Every control and link has a name.", needs: "structure" },
  "toggle-state": { wcag: "4.1.2", says: "A toggle says whether it is on, open or chosen.", needs: "structure" },
  "nested-interactive": { wcag: "4.1.2", says: "No control or link is inside another.", needs: "structure" },
  "img-alt": { wcag: "1.1.1", says: "Every image says what it shows, or says it is decoration (alt=\"\").", needs: "structure" },
  "svg-name": { wcag: "1.1.1", says: "A picture drawn in SVG that means something is role=\"img\" with a name; one that does not is hidden.", needs: "structure" },
  "scroll-region": { wcag: "2.1.1", says: "A box that scrolls by itself takes the keyboard and has a name.", needs: "structure" },
  "focus-visible": { wcag: "2.4.7", says: "Whatever has the keyboard shows a ring at least 2px wide, at 3:1 against its ground.", needs: "layout" },
  contrast: { wcag: "1.4.3", says: "Text is at 4.5:1 against its ground, 3:1 when large.", needs: "layout" },
  "keyboard-trap": { wcag: "2.1.2", says: "Tab leaves the view: the keyboard is never held inside it.", needs: "keys" },
};

export type AuditImpact = "critical" | "serious" | "moderate" | "minor";

/** One thing an audit found, shaped as a repair: what, where, how bad, and the one line that fixes it. */
export interface AuditProblem {
  readonly rule: AuditRuleId;
  /** The WCAG 2.2 success criterion, by number (`AUDIT_RULES[rule].wcag`, or 1.4.11 for a ring too faint). */
  readonly wcag: string;
  readonly impact: AuditImpact;
  /** A CSS selector for the element, from the nearest `data-key` or `id` down. */
  readonly at: string;
  /** The nearest `data-key` at or above it, when the view gave one. */
  readonly key?: string;
  /** What is wrong, in a sentence. */
  readonly says: string;
  /** The one line that fixes it. */
  readonly fix: string;
  /**
   * The framework's to fix, not the view's: the host makes this right on a
   * page (it gives a link or a press the keyboard, hides an SVG that says
   * nothing, labels the frame it scrolls a view in). Seen, it says the
   * host has not drawn what was audited, or has a fault of its own.
   */
  readonly automatic: boolean;
}

/** What an audit ran, what it could not, and what it found. */
export interface ViewAudit {
  readonly problems: readonly AuditProblem[];
  /** The rules it ran, in the order of `AUDIT_RULES`. */
  readonly ran: readonly AuditRuleId[];
  /** The rules it did not run, each with why: never claimed as passing. */
  readonly skipped: readonly { readonly rule: AuditRuleId; readonly why: string }[];
  /** What a measured rule could not judge (a ring drawn as a shadow, text over a picture): how many of each. */
  readonly unmeasured: Readonly<Partial<Record<AuditRuleId, number>>>;
  /** How many elements each measured rule read: what a pass under it stands on. */
  readonly measured: Readonly<Partial<Record<AuditRuleId, number>>>;
}
