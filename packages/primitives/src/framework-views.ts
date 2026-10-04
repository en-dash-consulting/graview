import type { AnySchema } from "@graview/core";
import type { ViewSpecsByKind } from "@graview/core/document";
import { createViews, type ReactViewRegistry } from "@graview/react/provider";
import { registerDefaultViews } from "./default-views.js";
import { registerViewSpecs } from "./spec-views.js";

/*
 * THE FRAMEWORK'S OWN VIEWS FOR A SCHEMA: its default view for every cell,
 * and the declaration's view specs over them (FR-03), made once per schema
 * and specs. What `./view-doors.tsx` draws through, fetched with the first
 * face that draws a view (FR-57).
 */
const MADE = new WeakMap<object, Map<ViewSpecsByKind | undefined, ReactViewRegistry<AnySchema>>>();

export function frameworkViews<S extends AnySchema>(schema: S, specs: ViewSpecsByKind | undefined): ReactViewRegistry<S> {
  let bySpecs = MADE.get(schema);
  if (!bySpecs) MADE.set(schema, (bySpecs = new Map()));
  let made = bySpecs.get(specs);
  if (!made) bySpecs.set(specs, (made = registerViewSpecs(registerDefaultViews(schema as AnySchema, createViews(schema as AnySchema)), schema as AnySchema, specs)));
  return made as unknown as ReactViewRegistry<S>;
}
