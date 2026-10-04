import type { AnySchema } from "@graview/core";
import { useGraview, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { useEffect, useRef } from "react";
import { mountGuestView, type GuestFrame } from "./frame.js";
import type { GuestLimits, GuestViewInput } from "./session.js";

export interface GuestViewOptions {
  /** Where the guest's code is served. */
  readonly url: string;
  /** The view's name: what the rail says an act came through. */
  readonly name: string;
  /** Where the frame first stands before the guest asks for a height. 160px by default. */
  readonly height?: number;
  readonly limits?: GuestLimits;
}

const inputOf = (props: ViewProps<AnySchema>): GuestViewInput => ({
  ...(props.node ? { node: { id: props.node.id } } : {}),
  ...(props.nodes ? { nodes: props.nodes.map((node) => ({ id: node.id })) } : {}),
  ...(props.label !== undefined ? { label: props.label } : {}),
  fidelity: props.fidelity,
  cardinality: props.cardinality,
  mode: props.mode,
  selected: props.selected,
  ...(props.implicated ? { implicated: props.implicated } : {}),
  ...(props.flagged ? { flagged: props.flagged } : {}),
});

/**
 * A VIEW SOMEBODY ELSE WROTE, registered like any other:
 *
 *   views.register("recipe", { fidelity: "full", cardinality: "one" },
 *     guestView({ url: "https://recipes.example/card.html", name: "recipe-card" }));
 *
 * It draws an iframe sandboxed to scripts alone, pushes the view's props as
 * the seat at the keyboard sees them, applies what the guest asks for as
 * that seat, and goes to a record by selecting it.
 */
export function guestView(options: GuestViewOptions): ViewComponent<AnySchema> {
  function GuestView(props: ViewProps<AnySchema>) {
    const { store, principal, setSelection } = useGraview<AnySchema>();
    const holder = useRef<HTMLDivElement>(null);
    const frame = useRef<GuestFrame | null>(null);
    const latest = useRef(props);
    latest.current = props;
    useEffect(() => {
      const element = holder.current;
      if (!element) return;
      const mounted = mountGuestView(element, {
        url: options.url,
        view: options.name,
        store,
        principal,
        input: () => inputOf(latest.current),
        onNavigate: (id) => setSelection([id]),
        ...(options.limits ? { limits: options.limits } : {}),
      });
      mounted.iframe.style.height = `${options.height ?? 160}px`;
      frame.current = mounted;
      return () => {
        mounted.dispose();
        frame.current = null;
      };
    }, [store, principal, setSelection]);
    useEffect(() => frame.current?.update(), [props]);
    return <div ref={holder} data-guest={options.name} />;
  }
  GuestView.displayName = `GuestView(${options.name})`;
  return GuestView;
}
