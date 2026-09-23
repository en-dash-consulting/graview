/**
 * THE SCENE: the graph drawn as a place.
 *
 * The root component lays the graph out and draws its planes; the lines
 * and the ties between chosen things are drawn over it, measured against
 * the DOM they cross; each node is hosted and resolved to the view its
 * fidelity asks for; and the connectors between them are routed and
 * clipped to what is on screen. One file each, and this one says so.
 */

export * from "./scene-root.js";
export * from "./scene-lines.js";
export * from "./scene-helpers.js";
export * from "./view-host.js";
export * from "./where-drawn.js";
export * from "./connectors.js";
export * from "./resolved-view.js";
