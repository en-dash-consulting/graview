import type { AnySchema } from "@graview/core";
import { useSelection, useViolations } from "@graview/react";
import { useEffect, useRef, useState } from "react";


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
  /** What to say when nothing is broken, in the app's own words. */
  readonly clean?: string;
}) {
  const violations = useViolations<AnySchema>();
  const { set } = useSelection();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement | null>(null);
  const count = violations.length;

  /*
   * Click away or press Escape to close.
   *
   * A popover that only closes by pressing the thing that opened it is a
   * popover you end up dragging around the screen, and this one sits over
   * the scene.
   */
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={anchor} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="standing"
        aria-expanded={open}
        disabled={count === 0}
        onClick={() => setOpen((current) => !current)}
        title={count === 0 ? clean : "Open what is broken, and what would fix it"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: "0.78125rem",
          whiteSpace: "nowrap",
          // The longhand both ways: switching between a `border` shorthand
          // and `borderColor` across renders is a React warning, and the
          // width and style already come from the button rule in the theme.
          borderColor: count === 0 ? "transparent" : "var(--graview-warn)",
          ...(count === 0 ? { background: "none", opacity: 1 } : { color: "var(--graview-warn)" }),
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            flex: "0 0 auto",
            background: count === 0 ? "var(--graview-edge-bright)" : "var(--graview-warn)",
          }}
        />
        {count === 0 ? clean : `${count} ${count === 1 ? "problem" : "problems"}`}
      </button>

      {open && count > 0 ? (
        <ol
          data-testid="problems"
          // A popover over the scene: Escape is this popover's while it is
          // open, and the ladder underneath waits for the next press.
          data-graview-overlay=""
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 20,
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
          {violations.map((violation, index) => (
            <li
              key={`${violation.invariant}:${index}`}
              style={{
                // A hairline between rows, not a card around each. Bordered
                // buttons inside a bordered panel is two boxes doing one job,
                // and it made a two-item list look like a dialog.
                borderTop: index === 0 ? "none" : "1px solid var(--graview-edge)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  set(violation.nodeIds);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  fontSize: "0.75rem",
                  lineHeight: 1.4,
                  padding: "7px 8px",
                  border: "1px solid transparent",
                  background: "none",
                  boxShadow: "none",
                  borderRadius: 7,
                }}
              >
                <span style={{ display: "block", color: "var(--graview-ink)" }}>
                  {violation.message}
                </span>
                <span style={{ color: "var(--graview-ink-faint)", fontSize: "0.6875rem" }}>
                  {violation.label}
                  {violation.repairs.length > 0
                    ? ` · ${violation.repairs.length} ${violation.repairs.length === 1 ? "way" : "ways"} to fix`
                    : ""}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
