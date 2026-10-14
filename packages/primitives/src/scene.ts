/**
 * `@graview/primitives/scene` — WHAT AN EMBED'S SCENE FACE DRAWS AROUND THE
 * SCENE, WITHOUT THE LENSES (FR-79).
 *
 * Everything here is also exported from `@graview/primitives`. It is its own
 * entry for the reason `./frame` is: a bundler assigns a module to every
 * chunk that can reach it, and the main entry reaches every lens factory.
 * While nothing drew a lens the factories were shaken out; now a declared
 * lens draws them, so a face that reached them through the main entry
 * carried all six whether or not the app declared one. The scene face
 * imports from here, and the factories come with the first lens that is
 * drawn (`fetchDeclaredLenses`).
 */
/* The scene's own rules, drawn by the scene face after the frame's sheet (FR-104). */
export { sceneCss } from "./scene-css.js";
export { SeatField } from "./seat-field.js";
export { DraftDoor } from "./draft-door.js";
export type { SeatFieldProps, SeatStart } from "./seat-field.js";
export { LinesKey } from "./lines-key.js";
/* What is chosen from altitude, beside the map at a size a person reads: a lens, a record's links, a district. */
export { MapPanel, mapPanelShows } from "./map-panel-door.js";
export type { MapPanelShowing } from "./map-panel-door.js";
export { Inspector } from "./workbench/inspector-door.js";
export { OverviewButton } from "./workbench/back-out.js";
export { Places } from "./places.js";
export { ShowInstallation } from "./installation.js";
export { FindBox } from "./find.js";
export { viewsCss } from "./views-css.js";
/* What the scene puts in the one bar — its Find and its Activity — and what it keeps on its picture: the same on the whole-page Shell and an embed. */
export { SceneBarTools, SceneTrail, useCallLog } from "./scene-bar.js";
/* The way back after an act, on the scene as on the pages (FR-152, FR-153): an offer on the board, and ⌘Z. */
export { SceneWayBack } from "./scene-way-back.js";
// The app as it was (Roadmap f-playback): the timeline, fetched when somebody first looks back.
export { PastBar, prefetchTimeline } from "./past-bar.js";
export type { TimelineFace } from "./past-bar.js";
