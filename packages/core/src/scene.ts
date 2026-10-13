/*
 * `@graview/core/scene` — the city: the map drawn from a declaration, in
 * lattice cells, the districts the scene draws on it, and a picture of it
 * made without a browser.
 *
 * An entry of its own, not part of `@graview/core` or
 * `@graview/core/document`: a hosted page imports both barrels up front, and
 * a bundler places a whole module in every chunk that can reach it — so the
 * city, which only the scene draws once it is fetched, rode in what every
 * hosted page loads first. The scene, the layout and a host drawing a
 * thumbnail import it from here.
 */
export { BLOCK, cityExtent, cityMap, districtState, MAX_SIDE, plotsOverlap, sharedEdges, sideFor, TILTED, toIso, TOP_DOWN } from "./city.js";
export type { CityHints, CityMap, DistrictState, Plot, Road, StateTier } from "./city.js";
export { districtBlocks, heightOf, roadsOf, TIER_HEIGHT, villageCap, villageOf } from "./village.js";
export type { Block, Building, LaneRest } from "./village.js";
export { sceneDistricts } from "./scene-districts.js";
export type { SceneDistrict, SceneDistrictOptions } from "./scene-districts.js";
export { sceneThumbnail } from "./document/thumbnail.js";
export type { SceneThumbnailOptions, ThumbnailSource } from "./document/thumbnail.js";
