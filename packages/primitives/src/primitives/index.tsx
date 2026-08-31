import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * A rich primitive set, not a visualization library.
 *
 * These cover the common cases so a new node kind renders sensibly before
 * anyone writes a custom view. Everything is an ordinary component with
 * ordinary props — the timeline lens is built from exactly these, which makes
 * it the worked example of the authoring API rather than a privileged
 * insider.
 */

export interface PanelProps {
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  /** Dimmed trailing text: counts, times, status. */
  readonly meta?: ReactNode;
  readonly selected?: boolean;
  readonly tone?: "default" | "muted" | "warning";
  readonly children?: ReactNode;
  readonly style?: CSSProperties;
  /**
   * Size to the content rather than filling the box the scene gave it.
   *
   * A focused single node was drawn as a 500-pixel white rectangle with four
   * lines of text in the top corner — an empty page with a debug dump in it.
   * A week's calendar genuinely wants the whole box; one nap does not. The
   * scene centres a fitted panel in its band, so a short one reads as
   * deliberate rather than as a rendering that failed halfway.
   */
  readonly fit?: boolean;
  /**
   * A card in the scene; a DOCUMENT on a page.
   *
   * The same component renders in both places — that is the two-mode contract
   * — but a card is a thing with edges sitting on a ground, and a full page is
   * not. Lifting a short record out of the scene drew a bordered box 250
   * pixels tall floating in six hundred pixels of nothing, which reads as a
   * rendering that stopped rather than as a document that is short.
   *
   * `page` drops the border, the shadow, the fill and the fixed height, and
   * lets the title be a heading rather than a card's label. Nothing else
   * changes, so a view does not fork.
   */
  readonly variant?: "card" | "page";
}

const TONES: Record<NonNullable<PanelProps["tone"]>, CSSProperties> = {
  default: { background: "var(--graview-panel, #ffffff)", color: "var(--graview-ink, #1a1a1a)" },
  muted: { background: "var(--graview-panel-muted, #f7f5f1)", color: "var(--graview-ink, #1a1a1a)" },
  warning: { background: "var(--graview-panel-warning, #fdf3ec)", color: "var(--graview-ink, #1a1a1a)" },
};

/**
 * Secondary text: a COLOUR, never an opacity.
 *
 * `opacity: 0.7` on small text reads as "quieter" and computes as whatever
 * the background happens to be — which is how four elements here landed at
 * 3.32:1 against a 4.5:1 requirement without anyone choosing an unreadable
 * colour. A token composites against a known ground and can be checked.
 * axe-core checks it on every run of `scripts/run-a11y.mjs`.
 */
export const MUTED_TEXT: CSSProperties = { color: "var(--graview-ink-muted, #55514a)" };

/** Even quieter, still above 4.5:1 on both panel grounds. */
export const FAINT_TEXT: CSSProperties = { color: "var(--graview-ink-faint, #625d55)" };

/**
 * Whether an element has more content than it is showing.
 *
 * Measured rather than assumed, because the answer decides whether the
 * element becomes a tab stop. A scroll region with nothing focusable inside
 * it is unreachable by keyboard — but making every panel focusable would put
 * a stop in front of every card whether or not there is anything to scroll
 * to, which is the same mistake as the matrix's empty cells.
 */
function useOverflowing(ref: { current: HTMLElement | null }): boolean {
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const check = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
    // No dependency list: children change shape as the graph does, and this
    // has to stay true across those without every caller remembering to say so.
  });
  return overflowing;
}

/** The default container: a titled box. Most views are one of these. */
export function Panel({
  title,
  subtitle,
  meta,
  selected,
  tone = "default",
  children,
  style,
  fit = false,
  variant = "card",
}: PanelProps) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const overflowing = useOverflowing(scroller);
  const page = variant === "page";
  return (
    <div
      data-graview-primitive="panel"
      data-graview-variant={variant}
      data-selected={selected || undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: page ? 12 : 7,
        height: page || fit ? "auto" : "100%",
        maxHeight: page ? "none" : "100%",
        padding: page ? 0 : 15,
        boxSizing: "border-box",
        borderRadius: page ? 0 : 12,
        // A lit edge over the panel's own ground. Not `backdrop-filter`: a
        // captured subtree has nothing behind it, so the effect is a no-op on
        // the GPU path and the panel would differ between renderers.
        border: page
          ? "none"
          : `1px solid ${
              selected ? "var(--graview-accent, #2f6f5e)" : "var(--graview-edge, #e4e0d8)"
            }`,
        boxShadow: page
          ? "none"
          : selected
            ? "0 0 0 1px var(--graview-accent-dim), var(--graview-lift-low)"
            : "var(--graview-lift-low)",
        overflow: page ? "visible" : "hidden",
        ...TONES[tone],
        ...(page ? { background: "transparent" } : {}),
        // The panel's own ground, handed to the scroll shadow so its cover
        // gradients match whatever tone this panel is.
        ["--graview-panel-bg" as string]: TONES[tone].background,
        ...style,
      }}
    >
      {title === undefined ? null : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <strong
            style={{
              // A document's heading, not a card's label.
              fontSize: page ? 25 : 15,
              lineHeight: page ? 1.15 : 1.25,
              fontWeight: page ? 600 : 560,
              letterSpacing: page ? "-0.012em" : "0.005em",
            }}
          >
            {title}
          </strong>
          {meta === undefined ? null : (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                ...FAINT_TEXT,
              }}
            >
              {meta}
            </span>
          )}
        </div>
      )}
      {subtitle === undefined ? null : (
        <div style={{ fontSize: page ? 14.5 : 13, lineHeight: 1.5, ...MUTED_TEXT }}>
          {subtitle}
        </div>
      )}
      {/*
        * Content that outgrows the panel SCROLLS rather than disappearing.
        *
        * A scene is sized to its container and nothing else scrolls, so a
        * view taller than its plane's band was simply truncated — silently,
        * with no edge to tell you there was more. That is the same class of
        * failure as a span you could not click: the interface looked
        * finished and was not.
        */}
      <div
        ref={scroller}
        // A page does not scroll inside itself — the page scrolls — so it must
        // not carry the scroll region's cover gradients either. They paint the
        // panel's own ground, which on a page is a white band across a
        // document that has no card behind it.
        className={page ? undefined : "graview-scroll"}
        // A tab stop ONLY where there is something to scroll to, and named by
        // the panel so it is not an anonymous stop in the order.
        {...(overflowing && !page
          ? {
              tabIndex: 0,
              role: "region",
              ...(typeof title === "string" ? { "aria-label": title } : {}),
            }
          : {})}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: page ? 22 : 7,
          flex: "1 1 auto",
          // A page never scrolls inside itself: the page scrolls.
          ...(page ? { overflow: "visible" } : {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

export interface ChipProps {
  readonly label: ReactNode;
  /** 0..1 around the colour wheel. Kind-derived, so it is stable per kind. */
  readonly hue?: number;
  readonly selected?: boolean;
  readonly title?: string;
  /**
   * The node this chip stands for. Set it and the chip becomes a target:
   * clicking it travels to that node. Opt-in on purpose — a chip showing a
   * field value stands for nothing you can navigate to.
   */
  readonly pickId?: string;
}

/** One small labelled thing. The glyph-fidelity workhorse. */
export function Chip({ label, hue, selected, title, pickId }: ChipProps) {
  // A capped chip must be able to say the rest somewhere, or capping it loses
  // information rather than tidying it.
  const full = typeof label === "string" && label.length > 28 ? label : undefined;
  // Hue identifies the kind; luminance carries the reading. A chip is an
  // outline with a trace of its hue behind it, so a dozen of them together
  // stay a list rather than becoming confetti.
  const tint = hue === undefined ? undefined : Math.round(hue * 360);
  return (
    <span
      data-graview-primitive="chip"
      data-selected={selected || undefined}
      data-graview-pick={pickId}
      title={title ?? full}
      style={{
        cursor: pickId ? "pointer" : undefined,
        display: "inline-flex",
        alignItems: "center",
        // A chip is a label, never a bar. As a direct child of a column flex
        // container it would otherwise stretch edge to edge, which is how
        // "dropoff" ended up as a 700-pixel-wide pill.
        alignSelf: "flex-start",
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 12,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
        /*
         * A chip is a SMALL labelled thing. One that is a thousand pixels wide
         * is not a chip, it is a sentence with a border — which is what a
         * rationale rendered at glyph fidelity became, overflowing its card by
         * 938 pixels and out into the scene.
         *
         * Capped and ellipsised, with the whole text in the tooltip. Thirty
         * characters is about where a label stops being glanceable anyway.
         */
        maxWidth: "28ch",
        overflow: "hidden",
        textOverflow: "ellipsis",
        letterSpacing: "0.01em",
        // Lightness and alpha come from the THEME: the same tint that reads
        // as a lit outline in the dark reads as a wash on paper, and a fixed
        // pair only ever works in one of them.
        border: `1px solid ${
          selected
            ? "var(--graview-accent)"
            : tint === undefined
              ? "var(--graview-edge)"
              : `hsl(${tint} 55% var(--graview-tint-lightness) / 0.45)`
        }`,
        background:
          tint === undefined
            ? "var(--graview-panel-muted)"
            : `hsl(${tint} 55% var(--graview-tint-lightness) / calc(var(--graview-tint-alpha) * 0.65))`,
        color: "var(--graview-ink, #1a1a1a)",
        boxShadow: selected ? "0 0 14px -4px var(--graview-accent)" : undefined,
      }}
    >
      {label}
    </span>
  );
}

export interface RosterProps {
  readonly items: readonly { id: string; label: ReactNode; hue?: number }[];
  readonly max?: number;
  readonly selectedIds?: readonly string[];
  /** True when the item ids are real node ids, so each chip can be a target. */
  readonly pick?: boolean;
}

/**
 * A list of chips that degrades honestly: past `max` it says how many more
 * rather than truncating silently, because "and 9 more" is information and a
 * clipped list is a lie.
 */
export function Roster({ items, max = 8, selectedIds = [], pick = false }: RosterProps) {
  const shown = items.slice(0, max);
  const hidden = items.length - shown.length;
  return (
    <div
      data-graview-primitive="roster"
      style={{ display: "flex", flexWrap: "wrap", gap: 6, alignContent: "flex-start" }}
    >
      {shown.map((item) => (
        <Chip
          key={item.id}
          label={item.label}
          {...(item.hue === undefined ? {} : { hue: item.hue })}
          {...(pick ? { pickId: item.id } : {})}
          selected={selectedIds.includes(item.id)}
        />
      ))}
      {hidden > 0 ? <Chip label={`+${hidden} more`} /> : null}
    </div>
  );
}

export interface AggregateProps {
  readonly label: ReactNode;
  readonly count: number;
  readonly items?: readonly { id: string; label: ReactNode; hue?: number }[];
  readonly onExpand?: () => void;
  /** Something inside is implicated in a current problem. */
  readonly flagged?: boolean;
}

/**
 * A group standing in for a kind.
 *
 * First-class, not a scale fallback: "People" is a legitimate view of a kind,
 * which is why expanding it is the same mechanism as collapsing back.
 */
export function Aggregate({ label, count, items, onExpand, flagged }: AggregateProps) {
  return (
    <Panel
      title={label}
      meta={flagged ? `⚠ ${count}` : count}
      tone={flagged ? "warning" : "muted"}
      style={onExpand ? { cursor: "zoom-in" } : undefined}
    >
      {items && items.length > 0 ? <Roster items={items} max={6} pick /> : null}
    </Panel>
  );
}

export interface AxisProps {
  readonly ticks: readonly { at: number; label: ReactNode }[];
  readonly orientation?: "horizontal" | "vertical";
  /** Total extent in the same units as `at`. */
  readonly extent: number;
}

/** Labelled ticks along one dimension. The timeline's hours and days. */
export function Axis({ ticks, orientation = "vertical", extent }: AxisProps) {
  const horizontal = orientation === "horizontal";
  return (
    <div
      data-graview-primitive="axis"
      style={{ position: "relative", width: "100%", height: "100%", fontSize: 11, ...FAINT_TEXT }}
    >
      {ticks.map((tick) => (
        <div
          key={String(tick.label)}
          style={{
            position: "absolute",
            ...(horizontal
              ? { left: `${(tick.at / extent) * 100}%`, top: 0 }
              : { top: `${(tick.at / extent) * 100}%`, left: 0 }),
          }}
        >
          {tick.label}
        </div>
      ))}
    </div>
  );
}

export interface GridProps {
  readonly columns: readonly { id: string; label: ReactNode }[];
  /** Extent of the cross axis, in the caller's own units. */
  readonly extent: number;
  readonly gutter?: number;
  /** Absolutely positioned children, placed by the caller inside a column. */
  readonly children?: ReactNode;
}

/** Named columns over a continuous cross axis. A week over hours. */
export function Grid({ columns, extent, gutter = 46, children }: GridProps) {
  return (
    <div
      data-graview-primitive="grid"
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
    >
      <div
        style={{
          display: "flex",
          paddingLeft: gutter,
          paddingBottom: 6,
          borderBottom: "1px solid var(--graview-edge, #e4e0d8)",
        }}
      >
        {columns.map((column) => (
          <div
            key={column.id}
            style={{
              flex: 1,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              textAlign: "center",
              ...MUTED_TEXT,
            }}
          >
            {column.label}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          marginLeft: gutter,
          // Column rules and hour rules, drawn as a background rather than as
          // elements: a measured surface costs nothing and adds no nodes for
          // the capture pass to rasterise.
          backgroundImage: `repeating-linear-gradient(to right, var(--graview-edge) 0 1px, transparent 1px calc(100% / ${columns.length})), repeating-linear-gradient(to bottom, var(--graview-edge) 0 1px, transparent 1px 12.5%)`,
          backgroundSize: `100% 100%, 100% 100%`,
        }}
        data-graview-extent={extent}
      >
        {children}
      </div>
    </div>
  );
}

export interface ConnectorProps {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly kind?: string;
  readonly pattern?: "solid" | "dashed" | "dotted";
  readonly hue?: number;
  readonly width?: number;
}

const DASHES: Record<NonNullable<ConnectorProps["pattern"]>, string | undefined> = {
  solid: undefined,
  dashed: "6 4",
  dotted: "1 4",
};

/** One drawn relationship. Stroke treatment carries the edge's meaning. */
export function Connector({
  x1,
  y1,
  x2,
  y2,
  kind,
  pattern = "solid",
  hue,
  width = 1.5,
}: ConnectorProps) {
  return (
    <line
      data-graview-primitive="connector"
      data-graview-connector={kind}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={hue === undefined ? "currentColor" : `hsl(${Math.round(hue * 360)} 40% 40%)`}
      strokeWidth={width}
      strokeDasharray={DASHES[pattern]}
      strokeLinecap="round"
      opacity={0.7}
    />
  );
}
