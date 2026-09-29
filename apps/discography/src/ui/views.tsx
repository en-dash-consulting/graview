import { createViews } from "@graview/react";
import { createCalendarLens, createCoverageLens, registerDefaultViews } from "@graview/primitives";
import { discographySchema, type DiscographySchema } from "../domain/schema.js";
import { createTracklistLens } from "./tracklist.js";

type S = DiscographySchema;

/** What each song is about: songs down the side, themes across. */
export const aboutLens = createCoverageLens<S>({ rows: "song", columns: "theme", link: "about" });

/** Who worked with whom: an artist featured (column) on a song by another (row). */
export const togetherLens = createCoverageLens<S>({ rows: "artist", columns: "artist", link: { path: ["features", "by"] } });

/** The releases, on the calendar, across the whole career. */
export const releasesLens = createCalendarLens<S>({
  bindings: { album: { start: "released" } },
  today: "2023-12-31",
  range: "years",
  horizon: { years: 8, title: "The discography" },
});

/** Every release, its songs in track order. */
export const tracklistLens = createTracklistLens<S>({ entries: "tracks", order: "track" });

export function views() {
  return registerDefaultViews(discographySchema, createViews(discographySchema))
    .register("song", { cardinality: "many", fidelity: "full" }, aboutLens.View, { title: "What the songs are about" })
    .register("song", { cardinality: "many", fidelity: "summary" }, aboutLens.View, { title: "What the songs are about" })
    .register("album", { cardinality: "many", fidelity: "full" }, tracklistLens.View, { title: "Tracklists" })
    .register("album", { cardinality: "many", fidelity: "summary" }, tracklistLens.View, { title: "Tracklists" })
    .register("album", { cardinality: "many", fidelity: "full" }, releasesLens.View, { title: "The releases" })
    .register("album", { cardinality: "many", fidelity: "summary" }, releasesLens.View, { title: "The releases" })
    .register("artist", { cardinality: "many", fidelity: "full" }, togetherLens.View, { title: "Who worked with whom" })
    .register("artist", { cardinality: "many", fidelity: "summary" }, togetherLens.View, { title: "Who worked with whom" });
}
