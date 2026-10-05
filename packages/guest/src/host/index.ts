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
export type { KitRefusal, KitRefusalReason, KitRenderer, KitRendererOptions } from "./kit.js";
export type { GuestKitElement, Kit, KitComponent, KitEvent, KitProperty, KitPropertyType, KitTone } from "../kit.js";
export { guestView } from "./react.js";
export type { GuestViewOptions } from "./react.js";
export { GUEST_PROTOCOL, GUEST_SANDBOX, OPAQUE_ORIGIN } from "../protocol.js";
export type { GuestProps } from "../protocol.js";
