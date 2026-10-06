import type { AnySchema, GraviewApp } from "@graview/core";
import { createViews, type ReactViewRegistry } from "@graview/react/provider";
import { registerDeclaredLenses } from "./declared-lens-doors.js";
import { registerDefaultViews } from "./default-views.js";
import { registerViewSpecs } from "./spec-views.js";

/**
 * EVERYTHING THE DECLARATION DRAWS, AS ONE REGISTRY: the framework's view
 * for every cell, the declaration's view specs over them (FR-03), every
 * lens it declares with a title as a place (FR-79), and its arrangement
 * (FR-80). What an app with no pictures of its own hands its faces, and
 * what one with pictures starts from before registering them.
 */
export function declaredViews<S extends AnySchema>(app: GraviewApp<S>): ReactViewRegistry<S> {
  return registerDeclaredLenses(registerViewSpecs(registerDefaultViews(app.schema, createViews(app.schema)), app.schema, app.viewSpecs), app);
}
