import { BLOCK, plotsOverlap } from "../../city.js";
import { figureFaults, FIGURE_NAMES } from "../../schema/figures.js";
import type { AnySchema } from "../../schema/schema.js";

/**
 * `note` is a QUESTION ASKED OUT LOUD, not a problem.
 *
 * Some things a checker can see are legitimate designs that the author
 * should nonetheless have looked at once: a lens written for this app and
 * never proved against another domain, a role name two vocabularies both
 * use, a kind unreachable on an empty graph. Filed as warnings they would
 * be warnings that can only ever be acknowledged, and those are the ones
 * people learn to scroll past — which costs the checker its authority on
 * the warnings that matter. So they have their own voice: counted, printed,
 * and never a failure.
 */
import type { CheckContext } from "./context.js";

export function checkPlots<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  /*
   * TWO KINDS ON ONE BLOCK. A hand-laid plot is used verbatim, so two kinds
   * laid on the same block would be drawn on top of each other, and which
   * one answers a click would be whichever was drawn second.
   */
  const laid = app.schema.definitions.filter((definition) => definition.plot !== undefined);
  for (let i = 0; i < laid.length; i++) {
    for (let j = i + 1; j < laid.length; j++) {
      const a = laid[i]!;
      const b = laid[j]!;
      if (!plotsOverlap(a.plot!, b.plot!)) continue;
      add({
        severity: "error",
        code: "plot-overlap",
        where: `defineNode("${b.kind}").plot`,
        message: `"${a.kind}" at (${a.plot!.col}, ${a.plot!.row}) and "${b.kind}" at (${b.plot!.col}, ${b.plot!.row}) stand on the same block.`,
        fix: `Move one of them at least ${BLOCK} cells away, or drop the plot and let the map place it.`,
      });
    }
  }
}

export function checkFigures<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  /*
   * A FIGURE THAT CANNOT BE DRAWN IS A BLANK NOBODY EXPLAINS.
   *
   * Every fault here looks fine in the file and fails on a screen: art with
   * no `viewBox` cannot be sized by anything that draws it, a literal
   * color ignores the scheme and the kind's hue — and is therefore
   * invisible in one of the two, which nobody notices until somebody
   * switches — and a name that is not in the shipped set is a silent gap
   * where a drawing should be.
   */
  for (const definition of app.schema.definitions) {
    for (const [where, figure] of [
      [`defineNode("${definition.kind}").figure`, definition.figure],
      [`brand.figures["${definition.kind}"]`, app.brand?.figures?.[definition.kind]],
    ] as const) {
      if (!figure) continue;
      for (const fault of figureFaults(figure)) {
        add({
          severity: "error",
          code: "figure-undrawable",
          where,
          message: `The figure for "${definition.kind}" cannot be drawn: ${fault}`,
          fix: `Give it one viewBox and currentColor strokes with no fill, or name one of: ${FIGURE_NAMES.join(", ")}.`,
        });
      }
    }
  }
}
