export { mountGuestView } from "./frame.js";
export type { GuestFrame, MountGuestViewOptions } from "./frame.js";
export { createGuestHost, createGuestLimiter, readAcross } from "./session.js";
export type { GuestHost, GuestHostOptions, GuestLimiter, GuestLimits, GuestReads, GuestStats, GuestViewInput } from "./session.js";
export { readTheme } from "./theme.js";
export type { GuestBrand } from "./theme.js";
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
 * A worker view as a place (FR-91–FR-96) — registering one, and judging
 * what it may be handed, ask and run — is `@graview/guest/host/views`, so a
 * page that draws only frames carries none of it.
 */
export { GUEST_PROTOCOL, GUEST_SANDBOX, OPAQUE_ORIGIN } from "../protocol.js";
export type { GuestPlace, GuestProps, GuestTheme } from "../protocol.js";
