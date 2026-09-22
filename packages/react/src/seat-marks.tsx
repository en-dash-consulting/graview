import type { ReactElement } from "react";
import { hueFor } from "@graview/render";
import type { DrawnBox } from "./context.js";

/**
 * THE SEAT'S MARK, ON WHAT IT WROTE.
 *
 * A layer rather than a prop on every view, for the same reason the
 * occupants are one: a mark has to land on a card, a building in a
 * village and a chip inside somebody's own lens, and no view should have
 * to know about the seat to show that the seat was here. Measured from
 * the picture as drawn — the pick's own box where there is one, the
 * node's box otherwise — so it is right on both render paths, at every
 * height, and inside a full-screen lens.
 *
 * It fades on its own; what it marks is in the companion's log, which
 * does not.
 */
/** A question the seat asked, standing at the node it is about. */
export interface SeatQuestion {
  readonly id: string;
  readonly who: string;
  readonly asks: string;
}

export interface SeatMarksProps {
  readonly marks: ReadonlyMap<string, string>;
  /** Questions back, pinned where they are about — they wait for an answer rather than fading. */
  readonly questions?: readonly SeatQuestion[];
  readonly whereIs: (id: string) => DrawnBox | null;
  readonly stageRef: { readonly current: HTMLElement | null };
  readonly width: number;
  readonly height: number;
}

const SIZE = 16;

export function SeatMarks({ marks, questions = [], whereIs, stageRef, width, height }: SeatMarksProps): ReactElement | null {
  if (marks.size === 0 && questions.length === 0) return null;
  const stage = stageRef.current;
  const rect = stage?.getBoundingClientRect() ?? null;
  const placed: { id: string; who: string; x: number; y: number }[] = [];
  /* The marks are decoration over things that say themselves; a question is not. */
  for (const [id, who] of marks) {
    /* The pick itself where the picture drew one: a mark on the chip beats a mark on the card holding it. */
    let box: { x: number; y: number; width: number; height: number } | null = null;
    if (stage && rect && typeof CSS !== "undefined") {
      const pick = stage.querySelector(`[data-graview-pick="${CSS.escape(id)}"]`);
      const at = pick?.getBoundingClientRect();
      if (at && at.width > 0 && at.height > 0) {
        box = { x: at.left - rect.left, y: at.top - rect.top, width: at.width, height: at.height };
      }
    }
    box ??= whereIs(id);
    if (!box) continue;
    const x = Math.min(Math.max(box.x + box.width - SIZE / 2, SIZE / 2), width - SIZE / 2);
    const y = Math.min(Math.max(box.y - SIZE / 4, SIZE / 2), height - SIZE / 2);
    placed.push({ id, who, x, y });
  }
  const asked: { id: string; who: string; asks: string; x: number; y: number }[] = [];
  for (const question of questions) {
    const box = whereIs(question.id);
    if (!box) continue;
    asked.push({
      ...question,
      x: Math.min(Math.max(box.x + box.width / 2, SIZE), width - SIZE),
      y: Math.min(Math.max(box.y - SIZE / 2, SIZE), height - SIZE),
    });
  }
  if (placed.length === 0 && asked.length === 0) return null;
  return (
    <div className="graview-seat-marks" data-testid="seat-marks" data-graview-seat-marks={placed.length}>
      {placed.map(({ id, who, x, y }) => (
        <span
          key={id}
          className="graview-seat-mark"
          data-testid="seat-mark"
          data-graview-seat-mark={id}
          data-graview-seat-who={who}
          title={`${who} just changed this`}
          aria-hidden="true"
          style={{ left: x, top: y, ["--graview-hue" as string]: hueFor(who) }}
        >
          ◆
        </span>
      ))}
      {/*
        * A QUESTION STANDS AT ITS NODE and waits. A mark fades because the
        * change it marks is done; a question is not done until somebody
        * answers it, so it holds its place — and says itself, rather than
        * being a dot you have to go and find the meaning of.
        */}
      {asked.map((question) => (
        <span
          key={`asking:${question.id}`}
          className="graview-seat-asking"
          data-testid="seat-question"
          data-graview-seat-asking={question.id}
          title={question.asks}
          style={{ left: question.x, top: question.y }}
        >
          <span aria-hidden="true">?</span>
          <span className="graview-seat-asking-said">{question.asks}</span>
        </span>
      ))}
    </div>
  );
}
