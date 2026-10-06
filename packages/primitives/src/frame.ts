/**
 * `@graview/primitives/frame` — WHAT EVERY FACE'S FRAME DRAWS, WITHOUT THE
 * WORKBENCH (FR-57).
 *
 * Everything here is also exported from `@graview/primitives`. It is its
 * own entry because a bundler splits a page by which files its first chunk
 * can reach, and `@graview/primitives` reaches the workbench, the companion
 * and the lenses: an embed that took its theme from it carried the scene's
 * panels into a page that drew only the pages. The embed's frame — the
 * theme, the strip's Profile and Standing, the views every face draws —
 * imports from here; the workbench is fetched with the face that draws it.
 * Nothing in this module's files may import a barrel: not this package's,
 * and not `@graview/react` (`@graview/react/provider` instead).
 */
/* The sheet without the scene's own rules: the scene face draws those (`sceneCss`, from `./scene`) — FR-104. */
export { DARK, GRAVIEW_BRAND, LIGHT, SCHEMES, themeBaseCss, themeVariables } from "./theme.js";
export type { Brand, Scheme, ThemeCssOptions, ThemeTokens } from "./theme.js";
export { Profile } from "./profile.js";
export type { HostAction } from "./profile.js";
export { createNoticeBoard, Notices, TOAST_MS } from "./notices.js";
export type { HeldNotice, Notice, NoticeAction, NoticeBoard, NoticeHandle, NoticeTone } from "./notices.js";
export { Standing } from "./workbench/standing.js";
export { descentTarget } from "./workbench/descent.js";
export { fetchFrameworkViews, frameworkViewDoors, registerFrameworkViews } from "./view-doors.js";
export { useWidth, VISUALLY_HIDDEN } from "./primitives/measure.js";
export { fetchDeclaredLenses, fetchHomeView, registerDeclaredLenses } from "./declared-lens-doors.js";
