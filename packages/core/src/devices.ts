/*
 * `@graview/core/devices` — THE SCREENS A DEVICE OFFERS (Roadmap
 * f-device-nav-bar): which place a screen names (`screenPlaceOf`), the
 * strip a seat is offered — the app's own `devices.screens`, else the home
 * and its jobs, else its bar (`deviceScreensOf`) — and the checker's words
 * for a screen that cannot be offered (`deviceFindings`).
 *
 * An entry of its own: nothing on a hosted page draws a device's strip, so
 * nothing there pays for it. The e-ink render (`@graview/pages/device`)
 * reads it, as `graview check` and `editDocument` do. The shapes
 * (`AppDevices`, `DeviceScreen`) are on `@graview/core`.
 */
export { deviceScreensOf, screenGo, screenPlaceOf } from "./device-screens.js";
export type { ResolvedScreen, ScreenPlace } from "./device-screens.js";
export { deviceFindings, documentDeviceFindings, screenWords } from "./device-findings.js";
export type { DeviceFinding, DeviceFindingCode } from "./device-findings.js";
export { JOB_SCREEN_PREFIX, LONGEST_SCREEN_LABEL, MOST_DEVICE_SCREENS } from "./device-shape.js";
export type { AppDevices, DeviceScreen } from "./device-shape.js";
