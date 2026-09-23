import type { AnySchema, NodeOfSchema } from "@graview/core";
import { useGraview, type ViewProps } from "@graview/react";
import type { ReactElement } from "react";
import { PLAN_REQUIRED_ROLES, type PlanLensOptions, type PlanLensState, buildPlanLens } from "./plan-state.js";
import { PlanView } from "./plan-view.js";

export interface PlanLens<S extends AnySchema> {
  readonly name: "plan";
  readonly requiredRoles: readonly string[];
  readonly options: PlanLensOptions;
  View(props: ViewProps<S>): ReactElement | null;
  build(
    nodes: readonly NodeOfSchema<S>[],
    edges: readonly { kind: string; from: string; to: string }[],
    schema?: S,
  ): PlanLensState;
}

export function createPlanLens<S extends AnySchema>(
  options: PlanLensOptions,
): PlanLens<S> {
  // A real component, not a method that calls hooks — the same reason the
  // framework's own board lens is written this way.
  function Bound(props: ViewProps<S>) {
    // The schema comes from the provider: `ViewProps` carries none, and
    // without it every schema-aware decision quietly takes its fallback.
    const { store } = useGraview<S>();
    return <PlanView<S> schema={store.schema} {...props} options={options} />;
  }

  return {
    name: "plan",
    requiredRoles: [...PLAN_REQUIRED_ROLES],
    options,
    View: Bound,
    build(nodes, edges, schema) {
      return buildPlanLens<S>(nodes, edges, options, schema);
    },
  };
}
