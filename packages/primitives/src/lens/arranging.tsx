import {
  admitArrangement,
  arrange,
  arrangeable,
  type AnySchema,
  type Arranged,
  type ArrangeOption,
  type Arrangement,
  type NodeOfSchema,
} from "@graview/core";
import { useGraview, useNavigation, type ViewProps } from "@graview/react";
import type { ReactNode } from "react";
import { ArrangeBar, arrangementOf, withArrangement } from "../arrange-bar.js";

/**
 * A LENS ARRANGES BEFORE IT DRAWS.
 *
 * The board, the timeline and the calendar each take their nodes and place
 * them; none of them took a sort, a filter or a group, so the only way to
 * see this week's shifts at the hall was to look for them. The arrangement
 * lives in the stop (`in.sort`, `in.filter`, `in.group`, `in.q`) beside the
 * calendar's own `in.at`, so an arranged picture is a link and Back
 * restores it; this hook reads it, applies it to the nodes a lens is about
 * to draw, and hands back the row to draw above them. Each lens says what
 * it has no place for — a board has nowhere to group — and an app declines
 * the rest with `arrange: false`.
 */

export interface ArrangingOptions<S extends AnySchema> {
  /** What the app declared on the lens. Everything is on unless declined. */
  readonly allow?: ArrangeOption;
  /** What the lens itself has no place for. Composed with `allow`; a part either declines is off. */
  readonly lensAllows?: ArrangeOption;
  /** What the picture opens arranged by, when the stop says nothing. */
  readonly arrangedBy?: Arrangement;
  /** The nodes the arrangement is ABOUT; the rest pass through first, untouched. A board's slots, say. */
  readonly only?: (node: NodeOfSchema<S>) => boolean;
  /** The nodes to arrange instead of `props.nodes` — a board's occupants, found through the store. */
  readonly subject?: readonly NodeOfSchema<S>[];
  /** The kind whose declaration offers the arrangement. The subject nodes' kind when unsaid. */
  readonly kind?: string;
  readonly query?: boolean;
}

export interface Arranging<S extends AnySchema> {
  /** What to draw: the untouched nodes, then the subject nodes as arranged. */
  readonly nodes: readonly NodeOfSchema<S>[];
  readonly arranged: Arranged<NodeOfSchema<S>>;
  readonly arrangement: Arrangement;
  /** The row, at full fidelity and unless declined; null otherwise. */
  readonly bar: ReactNode;
}

const both = (a: ArrangeOption | undefined, b: ArrangeOption | undefined): ArrangeOption => {
  if (a === false || b === false) return false;
  const one = a === undefined || a === true ? {} : a;
  const two = b === undefined || b === true ? {} : b;
  return {
    sort: one.sort !== false && two.sort !== false,
    filter: one.filter !== false && two.filter !== false,
    group: one.group !== false && two.group !== false,
  };
};

const ARRANGEMENT_WORDS = ["sort", "filter", "group", "q"] as const;

export function useArranging<S extends AnySchema>(props: ViewProps<S>, options: ArrangingOptions<S> = {}): Arranging<S> {
  const { store } = useGraview<S>();
  const { view, go } = useNavigation();
  const all = props.nodes ?? [];
  const subject = options.subject ?? (options.only ? all.filter(options.only) : all);
  const rest = options.subject ? [] : options.only ? all.filter((node) => !options.only!(node)) : [];
  const kind = options.kind ?? subject[0]?.kind;
  const allow = both(options.allow, options.lensAllows);

  const said = ARRANGEMENT_WORDS.some((word) => view.within?.[word] !== undefined);
  const asked = said ? arrangementOf(view) : (options.arrangedBy ?? {});
  const offers = kind ? arrangeable(store.schema, String(kind)) : undefined;
  const arrangement = offers ? admitArrangement(asked, offers).arrangement : {};
  const arranged = arrange(subject, allow === false ? {} : arrangement, {
    schema: store.schema,
    graph: store.graph,
    flagged: new Set(props.flagged ?? []),
  });

  const bar =
    kind && allow !== false && props.fidelity === "full" && subject.length > 1 ? (
      <ArrangeBar
        schema={store.schema}
        graph={store.graph}
        kind={String(kind)}
        arrangement={arrangement}
        allow={allow}
        query={options.query !== false}
        onChange={(next) => go(withArrangement(view, next))}
        kept={{ shown: arranged.nodes.length, of: subject.length }}
      />
    ) : null;

  return { nodes: [...rest, ...arranged.nodes], arranged, arrangement, bar };
}
