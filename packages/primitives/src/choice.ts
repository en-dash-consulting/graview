import type { CSSProperties } from "react";

/**
 * ONE OF A SETTING'S CHOICES: a word in a quiet box, the one chosen pressed
 * the way the bar's switch presses a face — tinted, in ink — rather than a
 * capsule ringed in the accent. 24 px tall, like every control the audit
 * counts: a setting for people who find the text small is not a small target.
 */
export function choiceStyle(chosen: boolean): CSSProperties {
  return {
    minHeight: 24,
    padding: "3px 10px",
    borderRadius: 6,
    fontSize: "0.875rem",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: chosen ? "transparent" : "var(--graview-edge)",
    color: chosen ? "var(--graview-ink)" : "var(--graview-ink-muted)",
    fontWeight: chosen ? 600 : 400,
    background: chosen ? "color-mix(in srgb, var(--graview-accent) 16%, transparent)" : "transparent",
  };
}
