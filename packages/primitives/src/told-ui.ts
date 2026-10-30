import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).
/*
 * WHAT PEOPLE TELL GRAVIEW, ONE CHUNK (Roadmap f-menu-learns): the card's
 * telling and its thumbs, the menu's suggestions and the Studio's panel,
 * with `@graview/core/told`, fetched together by whichever door asks first
 * (`quick-ask.tsx`, `menu-told-door.ts`, `told-panel-door.tsx`) — one
 * request, and no piece of it on a page that never tells Graview anything.
 */
export { changeTelling, examplesHere, keepTelling, RateTelling, seenOnThisPage, tellingDraftOf, toldListed, watchTelling } from "./told-card.js";
export { readToldHere, toldSuggestionsFrom } from "./menu-told.js";
export { ToldPanel } from "./told-panel.js";
