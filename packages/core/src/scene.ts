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
export { BLOCK, cityExtent, cityMap, heightOf, MAX_SIDE, plotsOverlap, roadsOf, sharedEdges, sideFor, toIso, villageCap, villageOf } from "./city.js";
export type { Building, CityHints, CityMap, Plot, Road } from "./city.js";
export { sceneDistricts } from "./scene-districts.js";
export type { SceneDistrict, SceneDistrictOptions } from "./scene-districts.js";
export { sceneThumbnail } from "./document/thumbnail.js";
export type { SceneThumbnailOptions, ThumbnailSource } from "./document/thumbnail.js";
