export { mountGuestView } from "./frame.js";
export type { GuestFrame, MountGuestViewOptions } from "./frame.js";
export { createGuestHost, createGuestLimiter } from "./session.js";
export type { GuestHost, GuestHostOptions, GuestLimiter, GuestLimits, GuestStats, GuestViewInput } from "./session.js";
/*
 * A worker guest's host — mountGuestWorker and the kit's renderer — is
 * `@graview/guest/host/worker`, not here: a page that draws only frames
 * loads none of it, and `guestView({ worker })` fetches it when it draws one.
 */
export type { GuestWorker, GuestWorkerFailure, GuestWorkerSource, MountGuestWorkerOptions } from "./worker.js";
export type { KitLinks, KitRefusal, KitRefusalReason, KitRenderer, KitRendererOptions } from "./kit.js";
export type { GuestKitElement, Kit, KitComponent, KitEvent, KitProperty, KitPropertyType, KitTone } from "../kit.js";
export { guestView } from "./react.js";
export type { GuestViewOptions } from "./react.js";
/*
 * A worker view as a place (FR-91): registered for its kind, or drawn as
 * the home's body, with its host's half fetched when it is first drawn.
 */
export { registerWorkerView, workerHome, workerView } from "./worker-react.js";
export type { WorkerHomeContext, WorkerViewDefinition } from "./worker-react.js";
export { checkManifest, manifestActs, workerViewProps } from "./manifest.js";
export type { ManifestAct, WorkerViewManifest, WorkerViewPropsInput } from "./manifest.js";
/* Writes that cannot leak (FR-92): when an act from a view's code may apply at all. */
export { judgeCodeAct, sightIsTotal } from "./writes.js";
export type { Judged, Press, PressedField } from "./writes.js";
export type { MountWorkerViewOptions, WorkerView, WorkerViewFailure, WorkerViewLimits } from "./view.js";
export { GUEST_PROTOCOL, GUEST_SANDBOX, OPAQUE_ORIGIN } from "../protocol.js";
export type { GuestProps } from "../protocol.js";
