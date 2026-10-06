import type { AnySchema, DrawnLens } from "@graview/core";
import type { ViewComponent, ViewProps } from "@graview/react/provider";
import { createBoardLens, type BoardOptions } from "./lens/board.js";
import type { CalendarOptions } from "./lens/calendar-options.js";
import { createCalendarLens } from "./lens/calendar-view.js";
import { createCoverageLens, type CoverageOptions } from "./lens/coverage.js";
import { createPlanLens } from "./lens/plan-lens.js";
import type { PlanLensOptions } from "./lens/plan-state.js";
import { reachLens } from "./lens/reach.js";
import { createTimelineLens, type TimelineOptions } from "./lens/timeline.js";
import { Panel } from "./primitives/index.js";
import { compileBlocks, SpecPlace, type SpecBlock } from "./spec-views.js";

/**
 * A DECLARED LENS, MADE (FR-79): the shipped factory its name names, handed
 * the options `declaredLenses` resolved from the declaration, and what
 * cannot be data derived here —
 *
 *   a timeline's `format`: hours and minutes over a day of 1440, the hour
 *     over a day of 24, the number itself otherwise;
 *   a calendar's `today`: the day it is drawn, in the reader's own zone,
 *     unless the declaration names one.
 *
 * Drawn under the place's title, which is what the picture is called on the
 * bar, on its page and in its card. Made once per lens, so a picture keeps
 * its state while the store changes under it.
 */
const MADE = new WeakMap<DrawnLens, ViewComponent<AnySchema>>();

/** The day it is where the reader is, as a calendar reads days. */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** How a position on a timeline's axis is said, from how long its axis is. */
export function formatFor(extent: number): (at: number) => string {
  if (extent === 1440) return (at) => `${pad(Math.floor(at / 60))}:${pad(Math.round(at % 60))}`;
  if (extent === 24) return (at) => `${pad(Math.floor(at))}:00`;
  return (at) => String(at);
}

function made(lens: DrawnLens): ViewComponent<AnySchema> {
  const options = lens.options as Record<string, unknown>;
  switch (lens.lens) {
    case "timeline": {
      const extent = typeof options["extent"] === "number" ? options["extent"] : 1440;
      return createTimelineLens<AnySchema>({ ...(options as unknown as TimelineOptions), extent, format: formatFor(extent) }).View as ViewComponent<AnySchema>;
    }
    case "calendar":
      return createCalendarLens<AnySchema>({ ...(options as unknown as CalendarOptions), today: typeof options["today"] === "string" ? options["today"] : localToday() }).View as ViewComponent<AnySchema>;
    case "coverage":
      return createCoverageLens<AnySchema>(options as unknown as CoverageOptions).View as ViewComponent<AnySchema>;
    case "board":
      return createBoardLens<AnySchema>(options as unknown as BoardOptions).View as ViewComponent<AnySchema>;
    case "plan":
      return createPlanLens<AnySchema>(options as unknown as PlanLensOptions).View as ViewComponent<AnySchema>;
    case "reach":
      return reachLens.View as ViewComponent<AnySchema>;
    case "blocks":
      return blocksLens(compileBlocks(Array.isArray(options["blocks"]) ? (options["blocks"] as readonly unknown[]) : []));
  }
}

/**
 * A PLACE DRAWN FROM BLOCKS (FR-81): the lens's blocks about no one record,
 * under its title in the scene (a card, as every lens is) and bare on a
 * page, whose own heading already says what it is.
 */
function blocksLens(blocks: readonly SpecBlock[]): ViewComponent<AnySchema> {
  return (props: ViewProps<AnySchema>) => {
    const place = <SpecPlace blocks={blocks} slot="place" heading={props.mode === "fullscreen" ? 2 : 3} />;
    if (props.fidelity === "glyph") return <span className="graview-spec-title">{props.label}</span>;
    // On a page it stands in the page's frame for a picture, which has no padding of its own.
    return props.mode === "fullscreen" ? <div style={{ padding: "14px 16px" }}>{place}</div> : <Panel title={props.label ?? ""}>{place}</Panel>;
  };
}
export function declaredLensView(lens: DrawnLens): ViewComponent<AnySchema> {
  let view = MADE.get(lens);
  if (!view) {
    const Lens = made(lens);
    const Titled = (props: ViewProps<AnySchema>) => <Lens {...props} label={lens.title} />;
    MADE.set(lens, (view = Titled));
  }
  return view;
}
