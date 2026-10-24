import { admitArrangement, arrange, arrangeable } from "@graview/core/arrange";
import { readableFields } from "@graview/core/words";
import { withComputed } from "@graview/core/blocks";
import {
  labelOf,
  pluralLabel,
  type AnySchema,
  type Arranged,
  type ArrangeOption,
  type Arrangement,
  type NodeOfSchema,
} from "@graview/core";
import { useGraview, useNavigation, type ViewProps } from "@graview/react";
import { withPast } from "@graview/layout/view-moves";
import { useContext, type ReactNode } from "react";
import { ArrangeBar, arrangementOf, withArrangement } from "../arrange-bar.js";
import { ExportPress, placeExportKey, shownListSaid, useShownListExport } from "../list-export.js";
import { PlaceExportContext } from "./place-export.js";

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
  /** Whether the line draws its Find box. On unless declined. */
  readonly query?: boolean;
  /** The fields Find looks in (`label` for the name): a lens's `options.search`. Every readable field when unsaid. */
  readonly search?: readonly string[];
  /** What the line offers to filter by, its choice fields standing as chips: a lens's `options.filters`. */
  readonly filters?: readonly string[];
  /** Whether the line offers "Export CSV" of what the lens shows. On unless declined, or unless the declaration offers it to nobody (`export: false`). */
  readonly exportable?: boolean;
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

const ARRANGEMENT_WORDS = ["sort", "filter", "group", "q", "archived"] as const;

export function useArranging<S extends AnySchema>(props: ViewProps<S>, options: ArrangingOptions<S> = {}): Arranging<S> {
  const { store, onExport } = useGraview<S>();
  // The place a declared lens's door says it is, and whether it offers "Export CSV" (Roadmap f-view-export-csv).
  const place = useContext(PlaceExportContext);
  const { view, go } = useNavigation();
  const said = ARRANGEMENT_WORDS.some((word) => view.within?.[word] !== undefined);
  const asked = said ? arrangementOf(view) : (options.arrangedBy ?? {});
  /*
   * WHICH RECORDS (FR-173). A lens is handed the live ones; asked for the
   * archived — `in.archived=true` or `all`, or `archived` in what the app
   * opens it arranged by — it draws its kind's records from the graph.
   */
  const handed = props.nodes ?? [];
  const archivedKind = options.kind ?? handed[0]?.kind ?? props.node?.kind;
  const all =
    asked.archived !== undefined && asked.archived !== false && archivedKind !== undefined && !options.subject
      ? (store.graph.nodesOfKind(archivedKind as never, { archived: asked.archived }) as readonly NodeOfSchema<S>[])
      : handed;
  const subject = options.subject ?? (options.only ? all.filter(options.only) : all);
  const rest = options.subject ? [] : options.only ? all.filter((node) => !options.only!(node)) : [];
  const kind = options.kind ?? subject[0]?.kind;
  const allow = both(options.allow, options.lensAllows);

  const offers = kind ? arrangeable(store.schema, String(kind)) : undefined;
  const arrangement = offers ? admitArrangement(asked, offers).arrangement : {};
  const arranged = arrange(subject, allow === false ? {} : arrangement, {
    schema: store.schema,
    graph: store.graph,
    flagged: new Set(props.flagged ?? []),
    ...(options.search ? { searchIn: options.search } : {}),
  });

  /*
   * THE PAST HAS A WAY IN FROM THE PICTURE (the tenth walk). One callout
   * current and 1,458 behind it drew a grid of one row with no line, and on
   * a phone the district saying "+1458 past" was folded away: the line is
   * drawn wherever records stand behind the horizon, and says so.
   */
  const retired = props.retired !== undefined && props.retired > 0 && (handed[0]?.kind ?? kind) === kind ? props.retired : 0;
  /*
   * "EXPORT CSV": the records the lens shows, in its order and its groups,
   * from its line and from the place menu — unless the lens declines it or
   * its declaration offers it to nobody.
   */
  const full = props.fidelity === "full" && props.budget === undefined;
  const exporting = kind !== undefined && full && options.exportable !== false;
  const shownSaid = shownListSaid(place?.export === false, { lens: place?.title ?? "", ...(place?.on !== undefined ? { on: place.on } : {}) }, () => ({ title: place?.title ?? pluralLabel(store.schema, String(kind)), schema: store.schema, graph: store.graph as never, kind: String(kind), groups: arranged.groups, grouped: arranged.grouped, onExport, words: { labelOf, readableFields, withComputed } }));
  // Said for the place menu only where a declaration names the place: its switch is the declaration's.
  useShownListExport(place && exporting ? placeExportKey(place.as) : undefined, shownSaid);
  // No row on a picture with a budget: a lens handed a few of its members is a picture of itself, with no controls.
  const bar =
    kind && allow !== false && full && (subject.length > 1 || retired > 0) ? (
      <ArrangeBar
        schema={store.schema}
        graph={store.graph}
        kind={String(kind)}
        arrangement={arrangement}
        allow={allow}
        query={options.query !== false}
        {...(options.filters ? { filters: options.filters, chips: { nodes: subject as never, flagged: new Set(props.flagged ?? []) } } : {})}
        onChange={(next) => go(withArrangement(view, next))}
        kept={{ shown: arranged.nodes.length, of: subject.length }}
        {...(retired > 0 ? { past: { count: retired, widen: () => go(withPast(view, true)) } } : {})}
        {...(exporting && !shownSaid.off ? { end: <ExportPress said={shownSaid} /> } : {})}
      />
    ) : null;

  return { nodes: [...rest, ...arranged.nodes], arranged, arrangement, bar };
}
