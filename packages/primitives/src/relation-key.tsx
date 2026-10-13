import { edgeWords, pluralLabel, layer, resolveKit, type AnySchema } from "@graview/core";
import { kitConnector, useKit } from "@graview/react/drawing";
import { useGraph, useGraview, useGraviewIfAny, useNavigation, useSelection } from "@graview/react/provider";
import {
  CONNECTOR_DASH,
  PROVISIONAL_DASH,
  PROVISIONAL_OPACITY,
  connectorStroke,
  connectorWidth,
} from "@graview/render";
import { useEffect, useMemo } from "react";

/**
 * What the lines mean.
 *
 * From the Graview the relations ARE the content, drawn with a color and a
 * stroke pattern per edge kind — and nothing said which was which. A picture
 * of a domain whose only legend is "these are different from each other"
 * answers the shape of the question and not the question.
 *
 * Everything here is derived: the edge kinds come from the schema, the
 * treatment from the same `connectorStyle` the scene draws with, the
 * descriptions from the declarations, and the counts from the graph. Nothing
 * is authored per app, and a new edge kind appears the day it is declared.
 *
 * Clicking one selects the kinds it joins, which is the same gesture as
 * clicking a card: from up here, "show me what this touches" is the only thing
 * selecting can mean.
 */
export function RelationKey<S extends AnySchema>({
  inside = false,
  widthOf,
}: {
  readonly inside?: boolean;
  /** From altitude, how wide the map draws a relation's ribbon, by its links and the busiest relation's: the swatch is that ribbon. */
  readonly widthOf?: (links: number, most: number) => number;
} = {}) {
  const { store, view, emphasis, setEmphasis } = useGraview<S>();
  // The same kit the scene draws with: a swatch that ignored the brand's kit would be a key you cannot trust.
  const kit = useKit();
  const { selection, set } = useSelection();
  const { show } = useNavigation();
  // Recomputed when the graph changes, so a relation nobody uses yet does not
  // sit in the key claiming to exist.
  const nodes = useGraph<S>();

  /*
   * One pass over the edges, not one per relation.
   *
   * `allEdges()` materializes a fresh array every call, and this component
   * re-renders on every diff — so scanning once per edge kind, plus again for
   * the counts, rebuilt the whole edge list six times per mutation while the
   * Graview was open.
   */
  const relations = useMemo(() => {
    const found = new Map<string, { count: number; ends: Set<string> }>();
    for (const edge of store.graph.allEdges()) {
      const entry = found.get(edge.kind) ?? { count: 0, ends: new Set<string>() };
      entry.count += 1;
      for (const id of [edge.from, edge.to]) {
        const node = store.graph.getNode(id);
        if (node) entry.ends.add(`kind:${node.kind}`);
      }
      found.set(edge.kind, entry);
    }
    return [...found.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kind, entry]) => ({ kind, count: entry.count, ends: [...entry.ends] }));
  }, [store, nodes]);
  // The busiest relation, which the widest ribbon is drawn for.
  const most = Math.max(0, ...relations.map((relation) => relation.count));

  // A key that disappears mid-hover must not leave its question standing.
  useEffect(() => () => setEmphasis(null), [setEmphasis]);

  // Under the Key it stands at every height: the lines are drawn on the ground too.
  if ((!view.overview && !inside) || relations.length === 0) return null;

  /*
   * A relation is LIT when the selection reaches one of the kinds it joins.
   *
   * Resolved the same way the scene resolves a connector endpoint: the
   * selection holds real node ids, and up here what is drawn is a kind card.
   * Comparing them directly dimmed every row at once whenever an ordinary
   * selection was carried into the Graview — a legend reading "nothing
   * matches" when nothing was asked.
   */
  const chosen = new Set<string>();
  for (const id of selection) {
    if (id.startsWith("kind:")) {
      chosen.add(id);
      continue;
    }
    const node = store.graph.getNode(id);
    if (node) chosen.add(`kind:${node.kind}`);
  }

  return (
    <section
      aria-label="What the lines mean"
      // Inside the Key's pane it is a part of it, not a landmark of its own (FR-40).
      role={inside ? "group" : undefined}
      data-testid="relation-key"
      style={inside ? { display: "grid", gap: 1 } : {
        position: "absolute",
        /*
         * The TOP-LEFT corner, mirroring the altitude control top-right.
         *
         * The bottom-left is ring ground now — the near-left districts land
         * there, and the key was sitting on them. The upper corners are the
         * one part of the ellipse that stays empty at every count.
         */
        left: 16,
        top: 14,
        zIndex: layer("rail"),
        display: "grid",
        gap: 1,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-low)",
        /*
         * AS WIDE AS THE KEY'S PANE. It was capped against a left rail the
         * scene reserved for it, and the rail is gone: drawn on its own it
         * keeps to the measure the Key's pane gives it, so a long
         * relation's words wrap where they do there.
         */
        maxWidth: KEY_PANE_WIDTH,
        // Arrives after the cards have mostly flown, rather than popping at
        // the cut.
        animation: "graview-settle 380ms 280ms ease backwards",
      }}
    >
      {/* Under "Key" the button already says what this is: no caption over it. */}
      {inside ? null : (
        <span
          style={{
            fontSize: "0.75rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--graview-ink-faint)",
            paddingBottom: 2,
          }}
        >
          {relations.length === 1 ? "1 relation" : `${relations.length} relations`}
        </span>
      )}
      {widthOf ? <LineManners aloft={view.overview === true} /> : null}
      {relations.map(({ kind: edgeKind, count, ends }) => {
        const { connector, style } = kitConnector(kit, edgeKind);
        // Every declaring kind's own words, where kinds word a shared relation apart.
        const said = relationWords(store.schema, edgeKind);
        const lit =
          emphasis !== null
            ? emphasis === edgeKind
            : chosen.size === 0 || ends.some((id) => chosen.has(id));
        return (
          <button
            key={edgeKind}
            type="button"
            title={store.schema.edge(edgeKind)?.description === undefined ? `${count} of these` : said.words}
            /*
             * Pointing at a row asks the picture the question: this relation's
             * lines come forward and the rest recede. From up here the lines
             * are the content, and a legend that cannot pick one line out of
             * the picture is a caption, not a key.
             */
            onMouseEnter={() => setEmphasis(edgeKind)}
            onMouseLeave={() => setEmphasis(null)}
            onFocus={() => setEmphasis(edgeKind)}
            onBlur={() => setEmphasis(null)}
            onClick={() => {
              // Same gesture as clicking a card: show me what this touches.
              set(ends);
              show(null);
            }}
            style={{
              all: "unset",
              // `all: unset` resets `outline` too, and an inline declaration
              // beats the stylesheet — so the theme's focus ring disappears
              // from the only controls in here unless it is restored.
              outline: "revert-layer",
              cursor: "pointer",
              display: "grid",
              gridTemplateColumns: "30px 1fr auto",
              alignItems: "center",
              gap: 8,
              minHeight: 23,
              padding: "2px 4px",
              borderRadius: 6,
              opacity: lit ? 1 : 0.4,
            }}
          >
            {/* The same stroke the scene draws, from the same helpers — a key
                whose swatch is an approximation is a key you cannot trust.
                From altitude that is the relation's ribbon, as wide as its links. */}
            <svg width="30" height="10" aria-hidden="true" style={{ display: "block", opacity: connector.visible ? 1 : 0.35 }}>
              {view.overview && widthOf ? (
                <path d="M 1 5 L 29 5" fill="none" className="graview-key-ribbon" stroke="var(--graview-ink)" strokeOpacity={0.35} strokeWidth={widthOf(count, most)} />
              ) : (
                <path
                  d="M 1 5 L 29 5"
                  fill="none"
                  stroke={connectorStroke(style)}
                  strokeWidth={connectorWidth(style, true)}
                  strokeDasharray={CONNECTOR_DASH[style.pattern]}
                  strokeLinecap="round"
                />
              )}
            </svg>
            {/*
              * THE RELATION IN ITS OWN WORDS. The row said the edge's name —
              * `for-vehicle`, `takes-in`, `offered-by` — which is the source's
              * word for it; the declaration's description is the person's,
              * and the two plurals under it say which way it reads.
              */}
            <span style={{ display: "grid", minWidth: 0 }} data-graview-relation-words={edgeKind}>
              <span style={{ fontSize: "0.8125rem", color: "var(--graview-ink)" }}>{said.words}</span>
              <span style={{ fontSize: "0.6875rem", color: "var(--graview-ink-faint)" }}>{said.ends}</span>
            </span>
            {/* A kind the kit keeps quiet says so here, the one place it is still listed. */}
            {connector.visible ? null : (
              <span data-graview-quiet={edgeKind} style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)", fontStyle: "italic" }}>
                not drawn
              </span>
            )}
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--graview-ink-faint)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </section>
  );
}

/** The Key's pane's width (`LinesKey`), and the widest the key is drawn on its own. */
export const KEY_PANE_WIDTH = "min(280px, calc(100% - 28px))";

/**
 * What a relation is called where a person reads it: the declaration's
 * description, capitalized, and which kinds it runs between in their
 * plurals — "The vehicle it is for", "Deals → Vehicles". The edge's name is
 * the source's word for it and only stands in when nothing else was said.
 *
 * EACH KIND WORDS ITS OWN END of a relation several kinds declare: given
 * the kind a line leaves, it is said in that kind's words; without one,
 * every reading is said — kinds that word it alike together, the others
 * after them ("The artist whose song it is · The artist whose release it is").
 */
export function relationWords(schema: AnySchema, edgeKind: string, fromKind?: string): { readonly words: string; readonly ends: string } {
  const from = schema.edge(edgeKind)?.from ?? [];
  const readings = new Map<string, string[]>();
  for (const kind of fromKind !== undefined && from.includes(fromKind) ? [fromKind] : from.length > 0 ? from : [""]) {
    const words = edgeWords(schema, kind, edgeKind, "out");
    readings.set(words, [...(readings.get(words) ?? []), kind]);
  }
  const plural = (kind: string) => (kind === "*" ? "anything" : pluralLabel(schema, kind));
  const said = [...readings].map(([words, kinds]) => {
    // A string `to` ("*") is one element, not its letters.
    const to = kinds.flatMap((kind) => (schema.tryDefinition(kind)?.edges[edgeKind] as { readonly to?: readonly string[] | "*" } | undefined)?.to ?? []);
    const ends = kinds[0] && to.length > 0 ? `${kinds.map(plural).join(", ")} → ${(to.includes("*") ? ["*"] : [...new Set(to)]).map(plural).join(", ")}` : "";
    return [words.charAt(0).toUpperCase() + words.slice(1), ends] as const;
  });
  return { words: said.map(([words]) => words).join(" · "), ends: said.flatMap(([, ends]) => (ends ? [ends] : [])).join(" · ") };
}

/**
 * ONE RELATION'S MARK, on its own: the same stroke the scene draws and the
 * key lists, for any surface that names an edge kind — the routed face's
 * map of the kinds, a record's relation groups. Works with or without the
 * scene's provider: outside one, the brand's kit is resolved from what the
 * caller hands over, or the default kit stands.
 */
export function RelationMark({ edgeKind, kit: given, width = 30 }: { readonly edgeKind: string; readonly kit?: Parameters<typeof resolveKit>[0]; readonly width?: number }) {
  const context = useGraviewIfAny();
  const kit = useMemo(() => resolveKit(given ?? context?.brand?.kit), [given, context?.brand?.kit]);
  const { connector, style } = kitConnector(kit, edgeKind);
  return (
    <svg width={width} height="8" aria-hidden="true" data-testid="relation-mark" data-graview-relation={edgeKind} style={{ display: "inline-block", verticalAlign: "middle", opacity: connector.visible ? 1 : 0.35 }}>
      <path d={`M 1 4 L ${width - 1} 4`} fill="none" stroke={connectorStroke(style)} strokeWidth={connectorWidth(style, true)} strokeDasharray={CONNECTOR_DASH[style.pattern]} strokeLinecap="round" />
    </svg>
  );
}

/**
 * ONE MANNER OF LINE PER MEANING, said once. From altitude a line means one
 * of three things, and any link may be unsure (FR-172), and the Key says which before it lists the relations: a
 * ribbon between two districts, as wide as the links along it; a chosen
 * record's link to a record the map draws, solid, ending on it; and its
 * links into a district, dashed, for records the map does not draw one by
 * one. Color and dash no longer tell relations apart — each line says its
 * relation in words where it is drawn.
 */
function LineManners({ aloft }: { readonly aloft: boolean }) {
  const row = { display: "grid", gridTemplateColumns: "30px 1fr", alignItems: "center", gap: 8, minHeight: 23, padding: "2px 4px" } as const;
  const said = { fontSize: "0.75rem", color: "var(--graview-ink-muted)" } as const;
  return (
    <div role="group" aria-label="The lines" data-testid="line-manners" style={{ display: "grid", gap: 1, paddingBottom: 6, marginBottom: 4, borderBottom: "1px solid var(--graview-edge)" }}>
      {aloft ? (<>
      <div style={row} data-graview-manner="ribbon">
        <svg width="30" height="10" aria-hidden="true"><path d="M 1 5 L 29 5" stroke="var(--graview-ink)" strokeOpacity={0.35} strokeWidth={6} /></svg>
        <span style={said}>A relation between two districts, as wide as the links along it — point at one for its words</span>
      </div>
      <div style={row} data-graview-manner="record">
        <svg width="30" height="10" aria-hidden="true"><path d="M 1 5 L 25 5" stroke="var(--graview-accent)" strokeWidth={1.8} strokeLinecap="round" /><circle cx={26} cy={5} r={3} fill="var(--graview-accent)" /></svg>
        <span style={said}>A chosen record's link to another record, labeled with the relation</span>
      </div>
      <div style={row} data-graview-manner="district">
        <svg width="30" height="10" aria-hidden="true"><path d="M 1 5 L 29 5" stroke="var(--graview-accent)" strokeWidth={1.8} strokeDasharray="5 4" /></svg>
        <span style={said}>A chosen record's links into a district, with how many</span>
      </div>
      </>) : null}
      {/* A link made less than sure (FR-172) is drawn so wherever it is drawn, until a person keeps it. */}
      <div style={row} data-graview-manner="unsure">
        <svg width="30" height="10" aria-hidden="true"><path d="M 1 5 L 29 5" stroke="var(--graview-accent)" strokeOpacity={PROVISIONAL_OPACITY} strokeWidth={1.8} strokeDasharray={PROVISIONAL_DASH} strokeLinecap="round" /></svg>
        <span style={said}>Unsure: a link its maker was less than sure of, until a person keeps it — point at its words for what it was based on</span>
      </div>
    </div>
  );
}
