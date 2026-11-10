/**
 * `@graview/react/ground` — THE CITY'S STREETS, FOR A PICTURE OF IT DRAWN
 * ELSEWHERE.
 *
 * The relations between districts as the scene finds them (`ribbonsOf`), as
 * wide as how many run along them (`ribbonWidth`), and routed down the
 * gutters of the lattice the way the scene routes them (`routeOnTheGround`).
 * The pages' city behind a page draws its roads with these.
 *
 * Apart from `@graview/react` on purpose: the router is the scene's to fetch
 * when it draws its ribbons, and named from the main entry it rode into every
 * face that imports that entry before it draws. Fetched from here, it comes
 * only with what asks for it.
 */
export { ribbonsOf } from "./map-choice.js";
export type { Ribbon } from "./map-choice.js";
export { RIBBON_WIDTH, ribbonWidth } from "./ribbon-width.js";
export { routeOnTheGround } from "./ribbons.js";
export type { RouteInput } from "./ribbons.js";
// The same router a ribbon at a time between frames, remembered for the picture it routed: a city stepped back to twice is routed once.
export { routeBetweenFrames, routesRemembered, routingsSoFar } from "./ribbons.js";
