import { minutesAsRead, type AnySchema, type DrawnLens } from "@graview/core";
import type { ViewComponent, ViewProps } from "@graview/react/provider";
import { useContext, type ReactNode } from "react";
import { createBoardLens, type BoardOptions } from "./lens/board.js";
import type { CalendarOptions } from "./lens/calendar-options.js";
import { createCalendarLens } from "./lens/calendar-view.js";
import { createColumnsLens, type ColumnsOptions } from "./lens/columns.js";
import { createCoverageLens, type CoverageOptions } from "./lens/coverage.js";
import { createPlanLens } from "./lens/plan-lens.js";
import type { PlanLensOptions } from "./lens/plan-state.js";
import { reachLens } from "./lens/reach.js";
import { createTimelineLens, type TimelineOptions } from "./lens/timeline.js";
import { Panel } from "./primitives/index.js";
import { compileBlocks, PlacePageHead, SpecPlace, type SpecBlock } from "./spec-views.js";
import { PlaceExportContext, type PlaceExport } from "./lens/place-export.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * A DECLARED LENS, MADE (FR-79): the shipped factory its name names, handed
 * the options `declaredLenses` resolved from the declaration, and what
 * cannot be data derived here —
 *
 *   a timeline's `format`: hours and minutes over a day of 1440, the hour
 *     over a day of 24, the number itself otherwise;
 *   a calendar's `today`: the store's own day (`Store.today()`), else the
 *     day it is where the reader is,
 *     unless the declaration names one.
 *
 * Drawn under the place's title, which is what the picture is called on the
 * bar, on its page and in its card. Made once per lens, so a picture keeps
 * its state while the store changes under it.
 */
const MADE = new WeakMap<DrawnLens, ViewComponent<AnySchema>>();

/** How a position on a timeline's axis is said, from how long its axis is: a time of day in the page's locale (FR-178), "3:30 PM" in en-US. */
export function formatFor(extent: number): (at: number) => string {
  if (extent === 1440) return (at) => minutesAsRead(Math.floor(at / 60) * 60 + Math.round(at % 60));
  if (extent === 24) return (at) => minutesAsRead(Math.floor(at) * 60);
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
      // A day the declaration names, else the store's own (`Store.today()`), which the lens reads where it is drawn.
      return createCalendarLens<AnySchema>({ ...(options as unknown as CalendarOptions), ...(typeof options["today"] === "string" ? { today: options["today"] } : {}) }).View as ViewComponent<AnySchema>;
    case "coverage":
      return createCoverageLens<AnySchema>(options as unknown as CoverageOptions).View as ViewComponent<AnySchema>;
    case "board":
      return createBoardLens<AnySchema>(options as unknown as BoardOptions).View as ViewComponent<AnySchema>;
    case "plan":
      return createPlanLens<AnySchema>(options as unknown as PlanLensOptions).View as ViewComponent<AnySchema>;
    case "reach":
      return reachLens.View as ViewComponent<AnySchema>;
    case "columns":
      return createColumnsLens<AnySchema>(options as unknown as ColumnsOptions).View as ViewComponent<AnySchema>;
    case "blocks":
      return blocksLens(compileBlocks(Array.isArray(options["blocks"]) ? (options["blocks"] as readonly unknown[]) : []), lens.as);
  }
}

/**
 * A PLACE DRAWN FROM BLOCKS (FR-81): the lens's blocks about no one record,
 * under its title in the scene (a card, as every lens is) and bare on a
 * page, whose own heading already says what it is. A face claims its blocks
 * under the lens's own address (`view`, its `as`), so two lenses that say
 * one key keep their own claims.
 */
function blocksLens(blocks: readonly SpecBlock[], view: string): ViewComponent<AnySchema> {
  return (props: ViewProps<AnySchema>) => {
    const place = <SpecPlace blocks={blocks} slot="place" view={view} heading={props.mode === "fullscreen" ? 2 : 3} />;
    if (props.fidelity === "glyph") return <span className="graview-spec-title">{props.label}</span>;
    if (props.mode !== "fullscreen") return <Panel title={props.label ?? ""}>{place}</Panel>;
    /*
     * ON ITS PLACE'S PAGE IT IS THE PAGE'S COLUMN: its words, its groups
     * and its rows start on the edge the title starts on. It was inset 16
     * pixels inside the column, so every left edge under the heading missed
     * the heading's. Anywhere else full size — the scene's frame, a gallery's
     * picture — it stands in a frame with no padding of its own, and takes
     * some.
     */
    return <InColumn>{place}</InColumn>;
  };
}

function InColumn({ children }: { readonly children: ReactNode }) {
  return useContext(PlacePageHead) ? <>{children}</> : <div style={{ padding: "12px 16px" }}>{children}</div>;
}
export function declaredLensView(lens: DrawnLens): ViewComponent<AnySchema> {
  let view = MADE.get(lens);
  if (!view) {
    const Lens = made(lens);
    // The place the lens is, told to its arranging line: what "Export CSV" names the file, and whether it offers it (Roadmap f-view-export-csv).
    const place: PlaceExport = { title: lens.title, as: lens.as, ...(lens.export === false ? { export: false } : {}) };
    const Titled = (props: ViewProps<AnySchema>) => (
      <PlaceExportContext.Provider value={place}>
        <Lens {...props} label={lens.title} />
      </PlaceExportContext.Provider>
    );
    MADE.set(lens, (view = Titled));
  }
  return view;
}
