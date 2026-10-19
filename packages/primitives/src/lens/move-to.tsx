import { useLayoutEffect, useRef, useState } from "react";

/**
 * A CARD'S "MOVE TO ›", as its menu draws it (Roadmap f-board-move-without-buttons):
 * the row, and the columns it opens — in the board's order, each it may go
 * to a press that moves it there, each withheld struck through with the
 * reason. Fetched with the board, never with the menu.
 */

/** A column a card could go to from its menu: pressed it moves there, or it says why not. */
export interface MoveChoice {
  readonly to: string;
  readonly label: string;
  readonly why?: string;
  readonly run?: () => void;
}

const ROW = { padding: "5px 10px", fontSize: "0.875rem", borderRadius: 8, width: "100%", textAlign: "left", borderWidth: 1, borderStyle: "solid", borderColor: "transparent", background: "none", boxShadow: "none" } as const;

export function MoveTo({ choices, close }: { readonly choices: readonly MoveChoice[]; readonly close: () => void }) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLUListElement | null>(null);
  useLayoutEffect(() => {
    if (open) list.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }, [open]);
  return (
    <div>
      <button type="button" data-menu-item="move-to" aria-expanded={open} onClick={() => setOpen((was) => !was)} style={ROW}>
        Move to <span aria-hidden="true">›</span>
      </button>
      {open ? (
        <ul ref={list} aria-label="Move to" data-testid="move-to" style={{ margin: "2px 0 0 12px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
          {choices.map((choice) =>
            choice.run ? (
              <li key={choice.to}>
                <button
                  type="button"
                  data-move-to={choice.to}
                  onClick={() => {
                    close();
                    choice.run!();
                  }}
                  style={ROW}
                >
                  {choice.label}
                </button>
              </li>
            ) : (
              <li key={choice.to} style={{ display: "grid", gap: 2 }}>
                <button type="button" disabled data-move-to={choice.to} data-withheld="" style={{ ...ROW, borderStyle: "dashed" }}>
                  <s>{choice.label}</s>
                </button>
                {/* The reason, out loud beside the strike, as the menu says a withheld act's. */}
                <span data-testid="move-to-why" style={{ fontSize: "0.8125rem", lineHeight: 1.4, color: "var(--graview-ink-muted)", padding: "0 10px" }}>
                  {choice.why}
                </span>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** "Choose several" on a card's menu on a phone (FR-189): chooses this card, and a tap then chooses the next. */
export function ChooseSeveral({ choose, close }: { readonly choose: () => void; readonly close: () => void }) {
  return (
    <button
      type="button"
      data-menu-item="choose-several"
      onClick={() => {
        close();
        choose();
      }}
      style={ROW}
    >
      Choose several
    </button>
  );
}
