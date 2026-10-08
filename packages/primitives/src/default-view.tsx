import type { AnySchema } from "@graview/core";
import { createViews, useGraview, type ReactViewRegistry, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { createContext, useContext, type ReactNode } from "react";
import { registerDefaultViews } from "./default-views.js";

/*
 * THE DEFAULT, INSIDE A VIEW OF YOUR OWN (FR-36).
 *
 * Registering a view for a cell replaces what was there, which is what the
 * registry is for — and it left a view that wanted to ADD to the
 * framework's own (a summary above the record, a badge beside the fields)
 * with no way to draw what it had replaced. A host built a second registry
 * of defaults to look it up from. `DefaultView` is that lookup, once: the
 * framework's own view for the cell it is handed, for the kind of the node
 * or nodes it is handed.
 */

const DEFAULTS = new WeakMap<object, ReactViewRegistry<AnySchema>>();

/** The framework's own views for a schema, made once. */
export function defaultViewsOf<S extends AnySchema>(schema: S): ReactViewRegistry<S> {
  let made = DEFAULTS.get(schema);
  if (!made) DEFAULTS.set(schema, (made = registerDefaultViews(schema as AnySchema, createViews(schema as AnySchema))));
  return made as unknown as ReactViewRegistry<S>;
}

/**
 * Where the default for a cell is already drawn by the surface around a
 * view: the pages face's record page is the framework's own record, so a
 * page view that wraps the default draws only what it adds there.
 */
const ELSEWHERE = createContext(false);

/** Whether the surface around is itself the default for the cell: the pages face's record page. */
export function useDefaultElsewhere(): boolean {
  return useContext(ELSEWHERE);
}

/** Marks the views inside as drawn where the surface itself is the default. */
export function DefaultViewElsewhere({ children }: { readonly children: ReactNode }) {
  return <ELSEWHERE.Provider value={true}>{children}</ELSEWHERE.Provider>;
}

/**
 * The framework's own view for this cell — `props.cardinality` ×
 * `props.fidelity` — for the kind of `props.node` (or of `props.nodes`'s
 * first member). Pass the props your view was given:
 *
 *   const Page = (props) => <><Summary node={props.node} /><DefaultView {...props} /></>;
 *
 * Draws nothing on a surface that already is the default (the record page).
 */
export function DefaultView<S extends AnySchema>(props: ViewProps<S> & { readonly kind?: string }) {
  const elsewhere = useContext(ELSEWHERE);
  const { store } = useGraview<S>();
  if (elsewhere) return null;
  const kind = props.kind ?? props.node?.kind ?? props.nodes?.[0]?.kind;
  if (!kind) return null;
  const View = defaultViewsOf(store.schema).lookup(kind, { cardinality: props.cardinality, fidelity: props.fidelity }) as ViewComponent<S> | undefined;
  if (!View) return null;
  return <View {...(props as ViewProps<S>)} />;
}
