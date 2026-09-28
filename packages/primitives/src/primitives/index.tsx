import { useViewMode } from "@graview/react";
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
   * The title as a HEADING of this level, where the panel is what a page is
   * about. A panel's title is drawn as a heading and was never one to a
   * screen reader: the routed face's first screen — the way in, alone on a
   * page — had no level-one heading at all, and axe said so.
   */
  readonly heading?: 1 | 2 | 3 | 4;
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
 *
 * BOTH AXES. The scroller is `overflow: auto`, which scrolls sideways as
 * readily as down, and this asked about height alone — so at a phone's width,
 * where a panel overflows across rather than below, the region scrolled and
 * never became a stop. axe found it (`scrollable-region-focusable`) at 390px
 * on two screens of a real product; nothing found it at desk width because
 * at desk width the question never comes up.
 */
function useOverflowing(ref: { current: HTMLElement | null }): boolean {
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const check = () =>
      setOverflowing(
        element.scrollHeight > element.clientHeight + 1 ||
          element.scrollWidth > element.clientWidth + 1,
      );
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

/**
 * THE ROOM A VIEW HAS, in pixels, or null before the first measurement.
 *
 * A lens is drawn into whatever box the layout gives it — the focus card
 * in a 360px embed, a billboard, a page's column — and the ones that laid
 * themselves out for a desk (a 316px label column, seven day columns) were
 * unreadable in half of them. The width is the fact they need to choose a
 * shape by; this is the one place it is read.
 */
export function useWidth(ref: { current: HTMLElement | null }): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const read = () => setWidth(Math.round(element.getBoundingClientRect().width));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** The default container: a titled box. Most views are one of these. */
/** A panel's title: a heading of the level asked for, else the label it has always been. */
function Title({ level, style, children }: { readonly level: 1 | 2 | 3 | 4 | undefined; readonly style: CSSProperties; readonly children: ReactNode }) {
  if (level === undefined) return <strong style={style}>{children}</strong>;
  const Tag = `h${level}` as const;
  return <Tag style={{ margin: 0, ...style }}>{children}</Tag>;
}

export function Panel({
  title,
  subtitle,
  meta,
  selected,
  tone = "default",
  children,
  style,
  fit = false,
  variant,
  heading,
}: PanelProps) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const overflowing = useOverflowing(scroller);
  /*
   * A page unless the panel says otherwise, when it is ON a page.
   *
   * The two-mode contract asked every view author to thread `mode` into every
   * primitive, and three apps in, the app-written views were still drawing a
   * card — border, shadow, card-sized heading — in the middle of a full
   * screen. A contract only the framework's own views keep is not a contract.
   * An explicit `variant` still wins; this is what happens when a view says
   * nothing, which is most of the time.
   */
  const mode = useViewMode();
  const page = (variant ?? (mode === "fullscreen" ? "page" : "card")) === "page";
  return (
    <div
      data-graview-primitive="panel"
      data-graview-variant={page ? "page" : "card"}
      data-selected={selected || undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: page ? 12 : "var(--graview-gap, 7px)",
        height: page || fit ? "auto" : "100%",
        maxHeight: page ? "none" : "100%",
        padding: page ? 0 : "var(--graview-pad, 15px)",
        boxSizing: "border-box",
        // The brand's own shape. A bid desk is square; a household is round.
        borderRadius: page ? 0 : "var(--graview-radius, 12px)",
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
      {/*
        * THE WARNING TONE SAYS SO.
        *
        * The tone was a background tint and nothing else: no words, no mark,
        * nothing in the accessibility tree. Every view that draws a flagged
        * record was making a claim that only one kind of eyesight could read
        * and no screen reader could read at all, and getting it right was
        * left to each view — which the framework's own example app did not.
        * A contract only some views keep is not a contract, so the primitive
        * that carries the tone carries the mark, and a view with something
        * more specific to say says it as well.
        */}
      {tone === "warning" ? (
        <span data-graview-broken="" style={VISUALLY_HIDDEN}>
          Implicated in a problem.
        </span>
      ) : null}
      {title === undefined ? null : (
        /*
          * THE HEADING WRAPS RATHER THAN RUNNING OFF THE EDGE.
          *
          * Both halves of this row are sized in `rem` — as everything here
          * now is — so a reader on Largest doubles them, and on a phone
          * "The rotation · 2026–2029" reached eight pixels past the screen.
          * A row that cannot fit its own words on one line puts the second
          * half on the next one; nothing is lost and nothing hangs off the
          * side. The same answer the bar gives at the same width.
          */
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8, minWidth: 0 }}>
          {tone === "warning" ? (
            <span aria-hidden="true" title="Implicated in a problem" style={{ color: "var(--graview-warn)", flex: "0 0 auto" }}>
              ⚠
            </span>
          ) : null}
          <Title
            level={heading}
            style={{
              /*
               * A panel's title is the HEADING of this product.
               *
               * The display face was reaching the wordmark and nothing else,
               * because the stylesheet gives it to `h1`–`h4` and a panel title
               * is a `strong`. So a brand could name a serif and see it once,
               * in eleven-pixel letterspaced caps at the top left. This is the
               * largest text most screens have.
               */
              fontFamily: "var(--graview-font-display, inherit)",
              // A document's heading, not a card's label.
              fontSize: page ? "1.5625rem" : "0.9375rem",
              lineHeight: page ? 1.15 : 1.25,
              fontWeight: page ? 600 : 560,
              letterSpacing: page ? "-0.012em" : "0.005em",
              // A long title gives ground before the row does.
              minWidth: 0,
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </Title>
          {meta === undefined ? null : (
            <span
              style={{
                marginLeft: "auto",
                fontSize: "0.75rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                minWidth: 0,
                overflowWrap: "anywhere",
                ...FAINT_TEXT,
              }}
            >
              {meta}
            </span>
          )}
        </div>
      )}
      {subtitle === undefined ? null : (
        <div style={{ fontSize: page ? "0.90625rem" : "0.8125rem", lineHeight: 1.5, ...MUTED_TEXT }}>
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
          gap: page ? 22 : "var(--graview-gap, 7px)",
          flex: "1 1 auto",
          // A page never scrolls inside itself: the page scrolls.
          ...(page ? { overflow: "visible" } : {}),
          /*
           * A CUT ROW AND A SCROLLED ROW LOOK THE SAME, and only one of them
           * is all right.
           *
           * A card's chips sliced flat across the bottom edge read as
           * broken — somebody reported it as text being cut off, which is
           * exactly what it looks like — when in fact the panel scrolls and
           * nothing is lost. The tab stop above says so to a keyboard and to
           * a screen reader; this says the same thing to an eye. A few
           * pixels of fade is the oldest way there is to write "there is
           * more of this", and it costs nothing when there is not.
           */
          ...(overflowing && !page
            ? {
                maskImage: "linear-gradient(to bottom, #000 calc(100% - 14px), transparent)",
                WebkitMaskImage: "linear-gradient(to bottom, #000 calc(100% - 14px), transparent)",
              }
            : {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A PARAGRAPH WHOSE LINKS ARE TARGETS TOO.
 *
 * An inline link in a sentence is a link however it reads, and a harness
 * measuring every control found one at 194x17 in a product's own prose — the
 * text is sized in rem, the fingertip floor is not, and a line of body copy
 * is shorter than a fingertip. Every app that ran the audit found this, and
 * each one fixed it in its own stylesheet.
 *
 * `inline-flex` with the floor, so a link in a paragraph is as pressable as
 * a button without the sentence changing shape around it.
 */
export function Prose({ children, style }: { readonly children: ReactNode; readonly style?: CSSProperties }) {
  return (
    <div
      data-graview-primitive="prose"
      style={{ fontSize: "1rem", lineHeight: 1.6, ...style }}
    >
      <style>{`[data-graview-primitive="prose"] a { display: inline-flex; align-items: center; min-height: max(1.5rem, 24px); }`}</style>
      {children}
    </div>
  );
}

/**
 * Present to a screen reader, absent to the eye — the one idiom, written
 * once.
 *
 * Written out by hand in two places, which meant two shapes for the same
 * decision and no way for a harness to tell either of them from a caption
 * that had genuinely been cut off. `scripts/survey-ui.mjs` reported both as
 * "overflowing" on every screen of every app, twenty lines of noise that a
 * real clipped caption would have hidden behind.
 */
export const VISUALLY_HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
} as const satisfies CSSProperties;

export interface ChipProps {
  readonly label: ReactNode;
  /** Degrees around the colour wheel, as `hueFor` gives them. Kind-derived, so it is stable per kind. */
  readonly hue?: number;
  readonly selected?: boolean;
  readonly title?: string;
  /**
   * The node this chip stands for. Set it and the chip becomes a target:
   * clicking it travels to that node. Opt-in on purpose — a chip showing a
   * field value stands for nothing you can navigate to.
   */
  readonly pickId?: string;
  /**
   * What this mark CLAIMS about the current selection, said rather than
   * painted: "lit" when the selection reaches it, "dimmed" when it does not,
   * "plain" when nothing is selected.
   *
   * Every lens the framework ships says this on its own marks, and the skill
   * asks an app's lens to say it too — while the primitive an app would
   * naturally reach for could not. A lens built out of `Roster` therefore had
   * pick targets that were emphasised by opacity alone, which is a claim
   * about a picture that nothing can check: not a test, not `audit-ui`'s
   * `halfSaid`, and not a person reading the tree.
   */
  readonly emphasis?: "lit" | "dimmed" | "plain";
}

/** One small labelled thing. The glyph-fidelity workhorse. */
export function Chip({ label, hue, selected, title, pickId, emphasis }: ChipProps) {
  // A cut chip must be able to say the rest somewhere, or cutting it loses
  // information rather than tidying it. Whether it is cut is the container's
  // decision, not the label's length: an eighteen-character rotation in a
  // twenty-five-pixel calendar cell was cut to "Br…" and carried no title,
  // because only a label past twenty-eight characters used to get one.
  const full = typeof label === "string" ? label : undefined;
  // Hue identifies the kind; luminance carries the reading. A chip is an
  // outline with a trace of its hue behind it, so a dozen of them together
  // stay a list rather than becoming confetti.
  const tint = hue === undefined ? undefined : Math.round(hue);
  return (
    <span
      data-graview-primitive="chip"
      data-selected={selected || undefined}
      data-graview-pick={pickId}
      data-graview-emphasis={emphasis}
      title={title ?? full}
      style={{
        cursor: pickId ? "pointer" : undefined,
        display: "inline-flex",
        alignItems: "center",
        // A chip is a label, never a bar. As a direct child of a column flex
        // container it would otherwise stretch edge to edge, which is how
        // "dropoff" ended up as a 700-pixel-wide pill.
        alignSelf: "flex-start",
        // A chip that stands for a node is a target, and a target is at least
        // a fingertip tall. The extra pixel either side costs nothing and
        // takes every navigable chip over the line.
        minHeight: 24,
        boxSizing: "border-box",
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: "0.8125rem",
        lineHeight: 1.5,
        whiteSpace: "nowrap",
        /*
         * A chip is a SMALL labelled thing. One that is a thousand pixels wide
         * is not a chip, it is a sentence with a border — which is what a
         * rationale rendered at glyph fidelity became, overflowing its card by
         * 938 pixels and out into the scene.
         *
         * The cap lives here; the ELLIPSIS lives on the inner span, because
         * `text-overflow` does not apply to a flex container. Set here it did
         * nothing and the text was cut mid-word with no mark at all — which is
         * worse than not capping it, since a hard edge reads as a bug and an
         * ellipsis reads as a decision.
         */
        maxWidth: "28ch",
        overflow: "hidden",
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
      {/*
        * THE DOT IS THE THREAD. The same mark carries kind identity in the
        * legend's swatches, the quick-select panel and here on every chip —
        * one glyph, everywhere, so "what am I looking at" has one answer
        * wherever you look.
        */}
      {tint === undefined ? null : (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            flex: "0 0 auto",
            marginRight: 6,
            background: `hsl(${tint} 55% var(--graview-tint-lightness) / 0.9)`,
          }}
        />
      )}
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </span>
  );
}

export interface RosterProps {
  readonly items: readonly {
    id: string;
    label: ReactNode;
    hue?: number;
    /** What this mark claims about the selection. See `ChipProps.emphasis`. */
    emphasis?: "lit" | "dimmed" | "plain";
  }[];
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
          {...(item.emphasis === undefined ? {} : { emphasis: item.emphasis })}
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
      style={{ position: "relative", width: "100%", height: "100%", fontSize: "0.75rem", ...FAINT_TEXT }}
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
              fontSize: "0.75rem",
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
      stroke={hue === undefined ? "currentColor" : `hsl(${Math.round(hue)} 40% 40%)`}
      strokeWidth={width}
      strokeDasharray={DASHES[pattern]}
      strokeLinecap="round"
      opacity={0.7}
    />
  );
}
