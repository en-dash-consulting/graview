/*
 * `@graview/core/figures` — a kind's figure: the shipped set of line
 * drawings, what one says to a model asked to draw one, and the faults that
 * keep a drawn one honest.
 *
 * An entry of its own, not part of `@graview/core`: a hosted page imports
 * that barrel up front, and a bundler places a whole module in every chunk
 * that can reach it — so the shipped drawings, which only a face draws once
 * it is fetched and the checker judges, rode in what every hosted page
 * loads first. The faces, the agent's figure tool and the studio import
 * them from here.
 */
export { FIGURES, FIGURE_NAMES, figureBrief, figureFaults, figureSvg } from "./schema/figures.js";
export type { Figure } from "./schema/figures.js";
