import { createViews } from "@graview/react";
import { registerDeclaredLenses, registerDefaultViews } from "@graview/primitives";
import { gauntletApp } from "../domain/app.js";
import { gauntletSchema } from "../domain/schema.js";

/**
 * THE PROGRAM'S PICTURES, from its declaration alone (FR-79): what the
 * talks are about, and the timetable over talks and workshops. Both are
 * declared with titles in domain/app.ts, and the framework draws each as a
 * place — nothing here registers either.
 */
export function views() {
  return registerDeclaredLenses(registerDefaultViews(gauntletSchema, createViews(gauntletSchema)), gauntletApp);
}
