import type { SeatOutcome } from "@graview/react/provider";
import type { ReshapeChip, ReshapeProposal } from "@graview/tools/reshape";
import type { TraitName } from "@graview/core/compose";
import { useState } from "react";
import { QUIET_BUTTON } from "./chat.js";
import { Settled } from "./seat.js";

/**
 * A CHANGE TO THE APP ITSELF, AS A CARD (Roadmap f-seat-reshape).
 *
 * The seat read "we also need who's driving" as a change to the app's
 * shape, and code composed it. Before anything is applied the person sees
 * exactly what it is: what is ADDED (each trait, with what it brings), what
 * is KEPT (the kinds that stay) and what is DROPPED, each a chip they can
 * turn off or on — the starter's kinda, inside the app — and anything that
 * loses data said plainly above the press. Toggling a chip recomposes:
 * what they accept is always what the composer made of the chips they see,
 * never a card edited by hand. Accept hands the proposal to the host, which
 * applies it as the person, as one undoable change, or declines it.
 */

/** A chip pressed in (on) or out (off): the words, and the state said to a screen reader. */
function Chip({ chip, on, disabled, testId, onToggle }: { readonly chip: ReshapeChip; readonly on: boolean; readonly disabled: boolean; readonly testId: string; readonly onToggle: () => void }) {
  const brings = chip.brings ? ` — brings ${chip.brings}` : "";
  return (
    <button
      type="button"
      data-testid={`${testId}-reshape-chip`}
      data-reshape-part={`${chip.what}:${chip.name}`}
      aria-pressed={on}
      disabled={disabled}
      title={`${on ? "Leave out" : "Put back"} ${chip.words}${brings}`}
      onClick={onToggle}
      style={{
        // Read at render: this module and chat.tsx import each other, so the button's style is not spread at load.
        ...QUIET_BUTTON,
        borderRadius: 999,
        padding: "0 10px",
        ...(on ? { background: "var(--graview-accent-soft, var(--graview-panel-muted))", borderColor: "var(--graview-accent)" } : { color: "var(--graview-ink-muted)", textDecoration: "line-through" }),
      }}
    >
      {chip.words}
    </button>
  );
}

export interface ReshapeCardProps {
  readonly proposal: ReshapeProposal;
  readonly testId: string;
  /** What became of it, once accepted or declined. */
  readonly outcome?: SeatOutcome | undefined;
  /**
   * The card said again, for a chip toggled: the person's `add` and `drop`
   * in, the card out. Unsaid, the chips cannot be toggled.
   */
  readonly recompose?: (add: readonly TraitName[], drop: readonly string[]) => Promise<ReshapeProposal>;
  readonly onAccept: (proposal: ReshapeProposal) => void | Promise<void>;
  readonly onDecline: (proposal: ReshapeProposal) => void;
}

export function ReshapeCard({ proposal: first, testId, outcome, recompose, onAccept, onDecline }: ReshapeCardProps) {
  const [current, setCurrent] = useState(first);
  const [busy, setBusy] = useState(false);
  const settled = outcome !== undefined;
  const { card } = current;

  /*
   * THE CHIPS THE PERSON SEES: what the first reading proposed, union what
   * the toggles since made, so a part turned off stays on the card to be
   * turned on again. An add is on while it is in `add`; a drop is on while
   * it is in `drop`; a keep is pressed to drop it.
   */
  const addChips: { chip: ReshapeChip; on: boolean }[] = [...first.card.adds, ...card.adds.filter((chip) => !first.card.adds.some((one) => one.name === chip.name))].map((chip) => ({ chip, on: current.add.includes(chip.name as TraitName) }));
  const dropChips: { chip: ReshapeChip; on: boolean }[] = [...first.card.drops, ...card.drops.filter((chip) => !first.card.drops.some((one) => one.name === chip.name))].map((chip) => ({ chip, on: current.drop.includes(chip.name) }));
  const keepChips = card.keeps.filter((chip) => !dropChips.some((one) => one.chip.name === chip.name && one.on));

  const toggle = async (add: readonly TraitName[], drop: readonly string[]) => {
    if (!recompose || busy) return;
    setBusy(true);
    try {
      setCurrent(await recompose(add, drop));
    } catch {
      // The composer could not answer: the card stays as it was.
    } finally {
      setBusy(false);
    }
  };
  const without = <T,>(list: readonly T[], one: T) => list.filter((item) => item !== one);
  const canToggle = recompose !== undefined && !settled;

  const group = (label: string, chips: readonly { chip: ReshapeChip; on: boolean }[], onToggle: (chip: ReshapeChip, on: boolean) => void) =>
    chips.length === 0 ? null : (
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--graview-ink-faint)", minWidth: 48 }}>{label}</span>
        {chips.map(({ chip, on }) => (
          <Chip key={`${chip.what}:${chip.name}`} chip={chip} on={on} disabled={!canToggle || busy} testId={testId} onToggle={() => onToggle(chip, on)} />
        ))}
      </div>
    );

  return (
    <div
      data-testid={`${testId}-reshape`}
      role="group"
      aria-label="A change to the app"
      style={{ display: "grid", gap: 8, justifySelf: "stretch", padding: 10, border: "1px solid var(--graview-edge)", borderRadius: "var(--graview-radius-card, 10px)", background: "var(--graview-panel)" }}
    >
      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--graview-ink)" }}>{card.said}</p>
      {group("Adds", addChips, (chip, on) => void toggle(on ? without(current.add, chip.name as TraitName) : [...current.add, chip.name as TraitName], current.drop))}
      {group(
        "Keeps",
        keepChips.map((chip) => ({ chip, on: true })),
        (chip) => void toggle(current.add, [...current.drop, chip.name]),
      )}
      {group("Drops", dropChips, (chip, on) => void toggle(current.add, on ? without(current.drop, chip.name) : [...current.drop, chip.name]))}
      {card.breaking.length > 0 ? (
        <p data-testid={`${testId}-reshape-breaking`} style={{ margin: 0, fontSize: "0.8125rem", color: "var(--graview-warn)" }}>
          This loses data: {card.breaking.join(" ")}
        </p>
      ) : null}
      {settled ? (
        <Settled outcome={outcome} testId={testId} />
      ) : (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button
            type="button"
            data-testid={`${testId}-reshape-accept`}
            aria-label={`Accept: ${card.said}`}
            disabled={busy || current.add.length + current.drop.length === 0}
            onClick={() => {
              setBusy(true);
              void Promise.resolve(onAccept(current)).finally(() => setBusy(false));
            }}
            style={{ ...QUIET_BUTTON, fontWeight: 600 }}
          >
            Accept
          </button>
          <button type="button" data-testid={`${testId}-reshape-decline`} aria-label={`Not now: ${card.said}`} disabled={busy} onClick={() => onDecline(current)} style={{ ...QUIET_BUTTON, color: "var(--graview-ink-muted)" }}>
            Not now
          </button>
        </span>
      )}
    </div>
  );
}
