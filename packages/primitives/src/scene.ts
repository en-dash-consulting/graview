/**
 * `@graview/primitives/scene` — WHAT AN EMBED'S SCENE FACE DRAWS AROUND THE
 * SCENE, WITHOUT THE LENSES (FR-79).
 *
 * Everything here is also exported from `@graview/primitives`. It is its own
 * entry for the reason `./frame` is: a bundler assigns a module to every
 * chunk that can reach it, and the main entry reaches every lens factory.
 * While nothing drew a lens the factories were shaken out; now a declared
 * lens draws them, so a face that reached them through the main entry
 * carried all six whether or not the app declared one. The scene face
 * imports from here, and the factories come with the first lens that is
 * drawn (`fetchDeclaredLenses`).
 */
export { Companion } from "./companion.js";
export type { CompanionMode } from "./companion.js";
export { Inspector } from "./workbench/inspector.js";
export { OverviewButton } from "./workbench/back-out.js";
export { Places } from "./places.js";
export { ShowInstallation } from "./installation.js";
export { HomeLanding } from "./home-landing.js";
