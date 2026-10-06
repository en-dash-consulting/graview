import { createViews } from "@graview/react";
import { createCoverageLens, registerDeclaredLenses, registerDefaultViews } from "@graview/primitives";
import { rotaApp } from "../domain/app.js";
import { rotaSchema, type RotaSchema } from "../domain/schema.js";

type S = RotaSchema;

/**
 * FIVE PICTURES OF ONE ROSTER, and not one of them written — or registered —
 * here.
 *
 * The coverage grid came from a requirements matrix, the week from a
 * household's calendar, the fortnight and the quarter from the framework's
 * own calendar lens. The declaration says which of the app's kinds, fields
 * and edges answer each lens's roles and what each picture is called
 * (`lenses` in domain/app.ts), and the framework draws each as a place.
 */
export function rotaViews() {
  return registerDeclaredLenses(registerDefaultViews(rotaSchema, createViews(rotaSchema)), rotaApp);
}

/**
 * WHO IS COVERING WHAT, as numbers: the grid the place draws, for a test
 * that reads the cells rather than the picture. Made from the declaration's
 * own options, so it is the grid the place shows.
 */
export const coverage = createCoverageLens<S>({ rows: "shift", columns: "volunteer", link: "covered-by" });
