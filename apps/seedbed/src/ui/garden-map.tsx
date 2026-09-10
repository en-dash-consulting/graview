import type { Store } from "@graview/core";
import { useGraview, useViolations, type ViewComponent, type ViewProps } from "@graview/react";
import type { ReactNode } from "react";
import type { SeedbedSchema } from "../domain/schema.js";

type S = SeedbedSchema;

/*
 * THE GARDEN, DRAWN AS A GARDEN.
 *
 * The board lens draws the plots as discs on a board because it was written
 * for a seating plan and has never heard of soil. This is the picture the
 * garden would draw of itself: beds as beds, a sprout per planting, the
 * caretaker's initials on the gate, and the untended plot ringed in amber
 * because that is the one thing the garden's rule is about.
 *
 * It is ONE drawing with two homes. `GardenMapView` mounts it in the scene
 * as a lens — every plot, planting and gardener a real pick target, emphasis
 * exposed in the DOM — and the pages face mounts the same drawing on the
 * home page with each plot a link. Neither home knows the other exists.
 */

export interface GardenPlanting {
  readonly id: string;
  readonly label: string;
  readonly status: "growing" | "harvested" | "failed";
  readonly sown: string;
}

export interface GardenPlot {
  readonly id: string;
  readonly label: string;
  readonly beds: number;
  readonly x: number;
  readonly y: number;
  readonly caretaker: { readonly id: string; readonly label: string } | null;
  readonly growing: readonly GardenPlanting[];
  readonly past: readonly GardenPlanting[];
  /** The rule's own words about this plot, when it is broken here. */
  readonly trouble: readonly string[];
}

export interface GardenGardener {
  readonly id: string;
  readonly label: string;
  readonly plots: readonly { readonly id: string; readonly label: string }[];
}

export interface GardenRule {
  readonly id: string;
  readonly label: string;
  readonly broken: readonly string[];
}

export interface Garden {
  readonly plots: readonly GardenPlot[];
  readonly gardeners: readonly GardenGardener[];
  readonly growing: readonly (GardenPlanting & { readonly plot: { readonly id: string; readonly label: string } | null })[];
  readonly past: readonly GardenPlanting[];
  readonly rules: readonly GardenRule[];
}

type Loose = { id: string; kind: string; label: string } & Record<string, unknown>;

/** The garden as a model, read once from the graph and the rules. */
export function readGarden(
  store: Pick<Store<S>, "graph" | "violations">,
  violations = store.violations(),
): Garden {
  const nodes = store.graph.allNodes() as unknown as Loose[];
  const trouble = new Map<string, string[]>();
  for (const violation of violations) {
    for (const id of violation.nodeIds) trouble.set(id, [...(trouble.get(id) ?? []), violation.message]);
  }
  const planting = (node: Loose): GardenPlanting => ({
    id: node.id,
    label: node.label,
    status: String(node["status"] ?? "growing") as GardenPlanting["status"],
    sown: String(node["sown"] ?? ""),
  });
  const plots = nodes
    .filter((node) => node.kind === "plot")
    .map((node): GardenPlot => {
      const caretaker = (store.graph.out(node.id, "tended-by")[0] as Loose | undefined) ?? null;
      const plantings = (store.graph.in(node.id, "grows-in") as unknown as Loose[]).map(planting);
      return {
        id: node.id,
        label: node.label,
        beds: Number(node["beds"] ?? 1),
        x: Number(node["x"] ?? 0.5),
        y: Number(node["y"] ?? 0.5),
        caretaker: caretaker ? { id: caretaker.id, label: caretaker.label } : null,
        growing: plantings.filter((p) => p.status === "growing"),
        past: plantings.filter((p) => p.status !== "growing"),
        trouble: trouble.get(node.id) ?? [],
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const gardeners = nodes
    .filter((node) => node.kind === "gardener")
    .map((node): GardenGardener => ({
      id: node.id,
      label: node.label,
      plots: (store.graph.in(node.id, "tended-by") as unknown as Loose[]).map((plot) => ({ id: plot.id, label: plot.label })),
    }));
  const plantings = nodes.filter((node) => node.kind === "planting").map(planting);
  const growing = plantings
    .filter((p) => p.status === "growing")
    .map((p) => {
      const plot = (store.graph.out(p.id, "grows-in")[0] as Loose | undefined) ?? null;
      return { ...p, plot: plot ? { id: plot.id, label: plot.label } : null };
    });
  const rules = nodes
    .filter((node) => node.kind === "rule")
    .map((node): GardenRule => ({
      id: node.id,
      label: node.label,
      broken: violations.filter((v) => v.subjectId === node.id).map((v) => v.message),
    }));
  return { plots, gardeners, growing, past: plantings.filter((p) => p.status !== "growing"), rules };
}

export const initials = (label: string): string =>
  label
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** A sprout: one stem, two first leaves. The brand's own mark, small. */
export function Sprout({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V10" />
      <path d="M12 10C12 6 9 4 5 4c0 4 3 6 7 6Z" />
      <path d="M12 12c0-3 2.5-5 6.5-5 0 4-2.5 5-6.5 5Z" />
    </svg>
  );
}

export interface GardenMapPictureProps {
  readonly garden: Garden;
  /** Wraps each plot: the scene makes it a pick target, a page makes it a link. */
  readonly plot?: (plot: GardenPlot, drawn: ReactNode) => ReactNode;
  /** Ids to draw lit, dimming the rest; empty means no emphasis. */
  readonly lit?: ReadonlySet<string>;
  readonly aspect?: number;
  readonly dense?: boolean;
}

const HUE = { gardener: 28, plot: 42, planting: 122, rule: 210 } as const;

/** The drawing itself. Pure: everything it needs is in `garden`. */
export function GardenMapPicture({ garden, plot: wrapPlot, lit, aspect = 2.2, dense = false }: GardenMapPictureProps) {
  const emphasis = (ids: readonly string[]) => (!lit || lit.size === 0 ? "plain" : ids.some((id) => lit.has(id)) ? "lit" : "dimmed");
  return (
    <div
      data-testid="garden-map"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: String(aspect),
        borderRadius: 14,
        border: "1px solid var(--graview-edge)",
        // Soil under paper: the ground tint, warmed.
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--graview-panel) 92%, hsl(42 60% 50%) 8%), color-mix(in oklab, var(--graview-panel) 84%, hsl(42 50% 40%) 16%))",
        backgroundImage:
          "repeating-linear-gradient(90deg, transparent 0 46px, color-mix(in oklab, var(--graview-edge) 60%, transparent) 46px 47px)",
        overflow: "hidden",
      }}
    >
      {garden.plots.map((plot) => {
        // Sized to the ground it sits on, so the same plot is a real patch on
        // a wide page and a legible one in a card: a share of the width,
        // wider with more beds, and never a fixed number of pixels.
        const width = `${(dense ? 9 : 11) + plot.beds * (dense ? 2 : 2.6)}%`;
        const height = dense ? 44 : 72;
        const state = emphasis([plot.id, ...(plot.caretaker ? [plot.caretaker.id] : []), ...plot.growing.map((p) => p.id)]);
        const untended = plot.caretaker === null;
        const drawn = (
          <div
            data-graview-emphasis={state}
            title={[
              `${plot.label} — ${plot.beds} ${plot.beds === 1 ? "bed" : "beds"}`,
              plot.caretaker ? `looked after by ${plot.caretaker.label}` : "nobody looks after it",
              ...plot.trouble,
            ].join("\n")}
            style={{
              position: "absolute",
              left: `${plot.x * 100}%`,
              top: `${plot.y * 100}%`,
              transform: "translate(-50%, -50%)",
              width,
              height,
              boxSizing: "border-box",
              borderRadius: 8,
              padding: dense ? "3px 6px" : "5px 8px",
              display: "grid",
              alignContent: "space-between",
              // A plot is a rectangle of turned earth; an untended one is
              // ringed in the rule's amber, dashed, because the ring is the
              // rule speaking and not the soil.
              border: untended ? "1.5px dashed var(--graview-warn)" : `1px solid hsl(${HUE.plot} 40% 42% / 0.7)`,
              background: `hsl(${HUE.plot} 38% ${untended ? "34%" : "30%"} / ${state === "dimmed" ? 0.35 : 0.85})`,
              color: "hsl(40 40% 92%)",
              boxShadow: state === "lit" ? "0 0 0 2px var(--graview-accent)" : "var(--graview-lift-low)",
              opacity: state === "dimmed" ? 0.5 : 1,
              transition: "opacity 160ms ease, box-shadow 160ms ease",
              cursor: "pointer",
              fontSize: dense ? 10 : 11.5,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <strong style={{ fontFamily: "var(--graview-font-display)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {plot.label}
              </strong>
              <span
                aria-hidden="true"
                title={plot.caretaker ? plot.caretaker.label : "nobody"}
                style={{
                  marginLeft: "auto",
                  width: dense ? 16 : 20,
                  height: dense ? 16 : 20,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  fontSize: dense ? 8 : 9,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  background: plot.caretaker ? `hsl(${HUE.gardener} 55% 45%)` : "transparent",
                  border: plot.caretaker ? "none" : "1px dashed var(--graview-warn)",
                  color: plot.caretaker ? "white" : "var(--graview-warn)",
                }}
              >
                {plot.caretaker ? initials(plot.caretaker.label) : "?"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", minHeight: dense ? 12 : 18 }}>
              {Array.from({ length: plot.beds }, (_, bed) => {
                const sown = plot.growing[bed];
                const sprout = (
                  <span
                    key={bed}
                    title={sown ? `${sown.label}, sown ${sown.sown}` : "an empty bed"}
                    style={{
                      display: "inline-flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      width: dense ? 12 : 16,
                      height: dense ? 12 : 18,
                      borderRadius: 3,
                      background: sown ? "transparent" : "hsl(40 25% 20% / 0.5)",
                      color: `hsl(${HUE.planting} 55% 62%)`,
                    }}
                  >
                    {sown ? <Sprout size={dense ? 11 : 15} /> : null}
                  </span>
                );
                return sprout;
              })}
            </div>
          </div>
        );
        return <span key={plot.id}>{wrapPlot ? wrapPlot(plot, drawn) : drawn}</span>;
      })}
    </div>
  );
}

/**
 * The garden map as a LENS in the scene: the same drawing, every plot and
 * planting a pick target, emphasis from the scene's own selection.
 */
export const GardenMapView = ((props: ViewProps<S>) => {
  const { store } = useGraview<S>();
  const violations = useViolations();
  const garden = readGarden(store, violations as never);
  const lit = new Set(props.implicated ?? []);
  const flagged = new Set(props.flagged ?? []);
  const label = props.label ?? "The garden map";
  const untended = garden.plots.filter((plot) => plot.caretaker === null).length;
  const meta = untended === 0 ? `all ${garden.plots.length} tended` : `${untended} untended`;

  if (props.fidelity === "glyph") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 9px",
          borderRadius: 999,
          border: "1px solid var(--graview-edge)",
          fontSize: 12,
          color: `hsl(${HUE.planting} 45% 40%)`,
        }}
      >
        <Sprout size={12} /> {label} · {meta}
      </span>
    );
  }
  const page = props.mode === "fullscreen";
  return (
    <div
      data-testid="garden-map-lens"
      style={{
        display: "grid",
        gap: 10,
        padding: page ? 0 : 14,
        borderRadius: "var(--graview-radius, 12px)",
        background: page ? "transparent" : "var(--graview-panel)",
        border: page ? "none" : "1px solid var(--graview-edge)",
        color: "var(--graview-ink)",
        ...(page ? { height: "100%" } : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--graview-font-display)", fontSize: 17, fontWeight: 600 }}>{label}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: untended > 0 ? "var(--graview-warn)" : "var(--graview-ink-faint)" }}>
          {meta}
        </span>
      </div>
      <GardenMapPicture
        garden={garden}
        dense={props.fidelity === "summary"}
        lit={lit}
        plot={(plot, drawn) => (
          <span data-graview-pick={plot.id} data-graview-flagged={flagged.has(plot.id) ? "plot" : undefined} style={{ display: "contents" }}>
            {drawn}
          </span>
        )}
        // The plot is the target; the sprouts inside it are its beds, not
        // targets of their own — a target inside a target is a control a
        // keyboard cannot reach cleanly, and the plot's page lists them.
      />
      {props.fidelity === "full" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {garden.gardeners.map((gardener) => (
            <span
              key={gardener.id}
              data-graview-pick={gardener.id}
              data-graview-emphasis={lit.size === 0 ? "plain" : lit.has(gardener.id) ? "lit" : "dimmed"}
              title={gardener.plots.length > 0 ? `looks after ${gardener.plots.map((p) => p.label).join(", ")}` : "looks after nothing yet"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "3px 10px 3px 4px",
                borderRadius: 999,
                border: "1px solid var(--graview-edge)",
                fontSize: 12,
                opacity: lit.size > 0 && !lit.has(gardener.id) ? 0.5 : 1,
                cursor: "pointer",
              }}
            >
              <span style={{ width: 20, height: 20, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, background: `hsl(${HUE.gardener} 55% 45%)`, color: "white" }}>
                {initials(gardener.label)}
              </span>
              {gardener.label}
              <span style={{ color: "var(--graview-ink-faint)" }}>{gardener.plots.length > 0 ? gardener.plots.map((p) => p.label).join(", ") : "—"}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}) as ViewComponent<S>;
