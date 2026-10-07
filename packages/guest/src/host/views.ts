/*
 * A WORKER VIEW AS A PLACE: `@graview/guest/host/views`.
 *
 * Registering a worker view for its kind or as the home's body (FR-91), and
 * judging, with no worker, what it may be handed (FR-91), ask for from its
 * code (FR-92) and run at all (FR-96). Its own entry, apart from
 * `@graview/guest/host`, so a page that draws only frame guests carries none
 * of it; the worker's host and the open kit are fetched when a view is
 * first drawn.
 */
export { registerWorkerView, workerHome, workerView } from "./worker-react.js";
export type { WorkerHomeContext, WorkerViewDefinition } from "./worker-react.js";
export { checkManifest, manifestActs, workerViewProps } from "./manifest.js";
export type { ManifestAct, WorkerViewManifest, WorkerViewPropsInput } from "./manifest.js";
export { judgeCodeAct, sightIsTotal } from "./writes.js";
export type { Judged, Press, PressedField } from "./writes.js";
export { checkViewSource, viewScript } from "./view-source.js";
export type { MountWorkerViewOptions, WorkerView, WorkerViewCode, WorkerViewFailure, WorkerViewLimits } from "./view.js";
export type { GuestPlace, GuestTheme } from "../protocol.js";
export type { GuestBrand } from "./theme.js";
