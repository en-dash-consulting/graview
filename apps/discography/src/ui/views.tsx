import { createViews } from "@graview/react";
import { createCoverageLens, registerDeclaredLenses, registerDefaultViews } from "@graview/primitives";
import { discographyApp } from "../domain/app.js";
import { discographySchema, type DiscographySchema } from "../domain/schema.js";
import { createTracklistLens } from "./tracklist.js";

type S = DiscographySchema;

/** Who worked with whom: an artist featured (column) on a song by another (row). */
export const togetherLens = createCoverageLens<S>({ rows: "artist", columns: "artist", link: { path: ["features", "by"] } });

/** Every release, its songs in track order. */
export const tracklistLens = createTracklistLens<S>({ entries: "tracks", order: "track" });

/**
 * The catalogue's pictures. What the songs are about and the releases are
 * declared, with titles, in domain/app.ts, and drawn by the framework as
 * places (FR-79); laid over last, the releases stay what the albums'
 * district draws when an address names no picture. The tracklist is this
 * app's own lens, and who worked with whom walks a path through a song.
 */
export function views() {
  const own = registerDefaultViews(discographySchema, createViews(discographySchema))
    .register("album", { cardinality: "many", fidelity: "full" }, tracklistLens.View, { title: "Tracklists" })
    .register("album", { cardinality: "many", fidelity: "summary" }, tracklistLens.View, { title: "Tracklists" })
    .register("artist", { cardinality: "many", fidelity: "full" }, togetherLens.View, { title: "Who worked with whom" })
    .register("artist", { cardinality: "many", fidelity: "summary" }, togetherLens.View, { title: "Who worked with whom" });
  return registerDeclaredLenses(own, discographyApp);
}
