/**
 * `@graview/primitives/frame` — WHAT EVERY FACE'S FRAME DRAWS, WITHOUT THE
 * WORKBENCH (FR-57).
 *
 * Everything here is also exported from `@graview/primitives`. It is its
 * own entry because a bundler splits a page by which files its first chunk
 * can reach, and `@graview/primitives` reaches the workbench, the seat's
 * panel and the lenses: an embed that took its theme from it carried the scene's
 * panels into a page that drew only the pages. The embed's frame — the
 * theme, the strip's Profile and Standing, the views every face draws —
 * imports from here; the workbench is fetched with the face that draws it.
 * Nothing in this module's files may import a barrel: not this package's,
 * and not `@graview/react` (`@graview/react/provider` instead).
 */
/*
 * TIED DOORS (the headroom after 0.1.29). A bundler splits what a page loads
 * first by WHICH of its doors (each part fetched with `import()`) reach each
 * file: the frame's files reached by the inspector and the seat's panel went
 * in one chunk, those reached by the inspector alone in another, and a page
 * fetched twenty-three chunks before it drew — each with its own list of
 * names in and out, each compressed alone. A door is fetched by a page that
 * has already drawn its frame, so each door imports the barrel the page drew
 * first — this one, `@graview/react/provider` or `@graview/core` — for
 * nothing but that: the files every door reaches are then one set, and a
 * hosted page loads thirteen chunks before it draws, about 4 KB gzipped
 * less. The import costs a door nothing at run time (what it names is
 * already there). Only a barrel every page that fetches the door has drawn
 * first: the embed's faces and a guest's host are fetched by pages that
 * never load `@graview/embed`'s or `@graview/guest/host`'s whole barrel, and
 * a door tied to one of those carried it in.
 * `a-hosted-page-keeps-to-its-budget` counts the chunks.
 */
/* The sheet without the scene's own rules: the scene face draws those (`sceneCss`, from `./scene`) — FR-104. */
export { DARK, GRAVIEW_BRAND, LIGHT, SCHEMES, themeBaseCss, themeVariables } from "./theme.js";
export type { Brand, Scheme, ThemeCssOptions, ThemeTokens } from "./theme.js";
export { Profile } from "./profile.js";
export { AppMark, AppTitle, useFavicon } from "./app-title.js";
export { AppBar, BarFindContext, barPlaceAt, barPlaces, BAR_HEIGHT, BAR_PHONE, FEWEST_STANDING, HOME_KEY, HOME_PATH, PLACE_GAP, placesThatStand, TOOL, toolStyle, useBarFind } from "./app-bar.js";
export { scenePlacesOf, useScenePlaces, WHOLE_KEY, WHOLE_LABEL, type ScenePlaces } from "./scene-places.js";
export type { BarFace, BarFaces, BarFind, BarGo, BarPlace, BarPlaceGroup, BarSwitch } from "./app-bar.js";
export type { HostAction } from "./profile.js";
export { createNoticeBoard, fetchNotices, NoticeBoardContext, Notices, TOAST_MS } from "./notices.js";
export { appKeyOf, readerLenses } from "./reader-lenses.js";
export type { HeldNotice, Notice, NoticeAction, NoticeBoard, NoticeHandle, NoticeTone } from "./notices.js";
export { Standing, StandingDot, standingWords } from "./workbench/standing.js";
export { descentTarget } from "./workbench/descent.js";
export { fetchFrameworkViews, frameworkViewDoors, registerFrameworkViews } from "./view-doors.js";
export { useViewportHeight, useWidth, VISUALLY_HIDDEN } from "./primitives/measure.js";
export { fetchDeclaredLenses, fetchHomeView, registerDeclaredLenses, registerReaderLenses } from "./declared-lens-doors.js";
