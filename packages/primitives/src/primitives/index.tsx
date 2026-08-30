import type { CSSProperties, ReactNode } from "react";

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
}

const TONES: Record<NonNullable<PanelProps["tone"]>, CSSProperties> = {
  default: { background: "var(--graview-panel, #ffffff)", color: "var(--graview-ink, #1a1a1a)" },
  muted: { background: "var(--graview-panel-muted, #f7f5f1)", color: "var(--graview-ink-muted, #5b5750)" },
  warning: { background: "var(--graview-panel-warning, #fdf3ec)", color: "var(--graview-ink, #1a1a1a)" },
};

/** The default container: a titled box. Most views are one of these. */
export function Panel({
  title,
  subtitle,
  meta,
  selected,
  tone = "default",
  children,
  style,
}: PanelProps) {
  return (
    <div
      data-graview-primitive="panel"
      data-selected={selected || undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        height: "100%",
        padding: 14,
        boxSizing: "border-box",
        borderRadius: 10,
        border: selected
          ? "2px solid var(--graview-accent, #2f6f5e)"
          : "1px solid var(--graview-edge, #e4e0d8)",
        overflow: "hidden",
        ...TONES[tone],
        ...style,
      }}
    >
      {title === undefined ? null : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <strong style={{ fontSize: 16, lineHeight: 1.25 }}>{title}</strong>
          {meta === undefined ? null : (
            <span style={{ marginLeft: "auto", opacity: 0.6, fontSize: 12 }}>{meta}</span>
          )}
        </div>
      )}
      {subtitle === undefined ? null : (
        <div style={{ opacity: 0.7, fontSize: 13 }}>{subtitle}</div>
      )}
      {children}
    </div>
  );
}

export interface ChipProps {
  readonly label: ReactNode;
  /** 0..1 around the colour wheel. Kind-derived, so it is stable per kind. */
  readonly hue?: number;
  readonly selected?: boolean;
  readonly title?: string;
}

/** One small labelled thing. The glyph-fidelity workhorse. */
export function Chip({ label, hue, selected, title }: ChipProps) {
  const color = hue === undefined ? undefined : `hsl(${Math.round(hue * 360)} 45% 32%)`;
  const background = hue === undefined ? undefined : `hsl(${Math.round(hue * 360)} 55% 94%)`;
  return (
    <span
      data-graview-primitive="chip"
      data-selected={selected || undefined}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
        border: `1px solid ${selected ? "var(--graview-accent, #2f6f5e)" : "var(--graview-edge, #e4e0d8)"}`,
        background: background ?? "var(--graview-panel-muted, #f7f5f1)",
        color: color ?? "inherit",
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
}

/**
 * A list of chips that degrades honestly: past `max` it says how many more
 * rather than truncating silently, because "and 9 more" is information and a
 * clipped list is a lie.
 */
export function Roster({ items, max = 8, selectedIds = [] }: RosterProps) {
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
}

/**
 * A group standing in for a kind.
 *
 * First-class, not a scale fallback: "People" is a legitimate view of a kind,
 * which is why expanding it is the same mechanism as collapsing back.
 */
export function Aggregate({ label, count, items, onExpand }: AggregateProps) {
  return (
    <Panel
      title={label}
      meta={count}
      tone="muted"
      style={onExpand ? { cursor: "zoom-in" } : undefined}
    >
      {items && items.length > 0 ? <Roster items={items} max={6} /> : null}
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
      style={{ position: "relative", width: "100%", height: "100%", fontSize: 11, opacity: 0.65 }}
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
export function Grid({ columns, gutter = 44, children }: GridProps) {
  return (
    <div
      data-graview-primitive="grid"
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
    >
      <div style={{ display: "flex", paddingLeft: gutter }}>
        {columns.map((column) => (
          <div
            key={column.id}
            style={{ flex: 1, fontSize: 12, opacity: 0.7, textAlign: "center" }}
          >
            {column.label}
          </div>
        ))}
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 0, paddingLeft: gutter }}>
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
