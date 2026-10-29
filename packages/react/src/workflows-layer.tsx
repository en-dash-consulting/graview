import { pluralOf, SCENE_LAYERS, type AnySchema, type GraviewApp } from "@graview/core";
import { lastRunWords, toIso, workflowSpots, workflowsOnTheMap, type MapAct, type MapWorkflow, type SpotPlot } from "@graview/core/scene";
import type { InterpolatedLayout } from "@graview/layout";
import { useMemo, type ReactElement } from "react";
import type { WorkflowRuns } from "./context.js";
import "./provider.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * THE APP'S WORKFLOWS ON THE MAP (Roadmap f-jobs-declared). A workflow is
 * the app's own actor at work on some districts, so from altitude it
 * stands in the street beside the district it writes (`workflowSpots`),
 * a wire to every kind its steps read (dashed) and write (solid) — what
 * the declaration says it touches, nothing guessed. Under its title it
 * says how its last run went when the host hands its log of runs
 * (`workflowRuns`); a paused one is drawn dimmed and says it is paused.
 *
 * Fetched with the ground it stands on (`plots.tsx`), drawn only for an
 * app that declares a workflow: everything it knows is handed in, as the
 * ribbons' layer is, so it reaches into none of the provider's modules.
 * The pointer passes through it to the ground: it is said, not pressed.
 */

export interface WorkflowsLayerProps {
  readonly frame: InterpolatedLayout;
  readonly width: number;
  readonly height: number;
  /** The pan baked into the frame's cards, so a workflow stands in the street it is drawn beside. */
  readonly pan: { readonly x: number; readonly y: number };
  readonly app: GraviewApp<AnySchema>;
  /** Every act the app has, the derived ones too (`store.allMutations()`): what a step that runs one writes. */
  readonly acts: readonly MapAct[];
  /** The host's log of runs; unsaid, no last run is said. */
  readonly runs?: WorkflowRuns | undefined;
  /** The graph's version: a run's ops change it, and the last run is read again. */
  readonly graphVersion: unknown;
  /** The kinds not drawn for this seat: a wire to one is not drawn. */
  readonly hiddenKinds: ReadonlySet<string>;
}

const CSS = `.graview-workflows{position:absolute;left:0;top:0;pointer-events:none;z-index:${SCENE_LAYERS.plots};opacity:var(--graview-altitude);transition:opacity 640ms cubic-bezier(.33,0,.2,1)}
.graview-workflow-wire{fill:none;stroke:var(--graview-accent);stroke-width:1.5;stroke-opacity:.7;stroke-linecap:round}
.graview-workflow-wire[data-wire=reads]{stroke-dasharray:3 4;stroke-opacity:.55}
.graview-workflow-spot{fill:var(--graview-accent);stroke:var(--graview-panel);stroke-width:1.5}
.graview-workflow{position:absolute;transform:translate(10px,-50%);max-width:16rem;padding:.25rem .5rem;border-radius:.375rem;background:var(--graview-panel);color:var(--graview-ink);border:1px solid color-mix(in oklab,var(--graview-accent) 45%,transparent);font-size:.75rem;line-height:1.25;box-shadow:0 1px 2px color-mix(in oklab,var(--graview-ink) 12%,transparent)}
.graview-workflow-title{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.graview-workflow-last{display:block;color:var(--graview-ink-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.graview-workflows [data-graview-workflow-status=paused]{opacity:.45}`;

/** The kinds a workflow touches, said by what each is called: "reads routines; writes events". */
const touchWords = (workflow: MapWorkflow, schema: AnySchema): string => {
  const said = (kinds: readonly string[]) => kinds.map((kind) => pluralOf(schema, kind).toLowerCase()).join(", ");
  return [workflow.reads.length > 0 ? `reads ${said(workflow.reads)}` : "", workflow.writes.length > 0 ? `writes ${said(workflow.writes)}` : ""].filter(Boolean).join("; ");
};

export function WorkflowsLayer({ frame, width, height, pan, app, acts, runs, graphVersion, hiddenKinds }: WorkflowsLayerProps): ReactElement | null {
  const workflows = useMemo(() => workflowsOnTheMap(app, acts), [app, acts]);
  const city = frame.city;
  const plots = new Map<string, SpotPlot>();
  for (const node of frame.nodes) {
    if (node.plot && Math.round(node.plane) === 2 && !hiddenKinds.has(node.kind)) plots.set(node.kind, node.plot);
  }
  const spots = workflowSpots(workflows, plots);
  // Read again whenever the graph changes: a run's ops are what move it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const said = useMemo(() => new Map(workflows.map((workflow) => [workflow.name, runs ? lastRunWords(runs.last(workflow.name)) : undefined])), [workflows, runs, graphVersion]);
  if (!city || spots.length === 0) return null;
  const cell = city.cell;
  const tilt = city.tilt ?? 0.5;
  const x0 = city.originX + pan.x;
  const y0 = city.originY + pan.y;
  const at = (col: number, row: number) => {
    const iso = toIso(col, row, cell, tilt);
    return { x: x0 + iso.x, y: y0 + iso.y };
  };
  const byName = new Map(workflows.map((workflow) => [workflow.name, workflow]));
  return (
    <>
      <style>{CSS}</style>
      <div className="graview-workflows" data-graview-workflows={spots.length} style={{ width, height }}>
        <svg aria-hidden="true" width={width} height={height} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {spots.map((spot) => {
            const workflow = byName.get(spot.name)!;
            const from = at(spot.col, spot.row);
            const wires = [...workflow.writes.map((kind) => [kind, "writes"] as const), ...workflow.reads.filter((kind) => !workflow.writes.includes(kind)).map((kind) => [kind, "reads"] as const)];
            return (
              <g key={spot.name} data-graview-workflow-status={workflow.status}>
                {wires.map(([kind, way]) => {
                  const plot = plots.get(kind);
                  if (!plot) return null;
                  const to = at(plot.col + plot.side / 2, plot.row + plot.side / 2);
                  return <path key={kind} className="graview-workflow-wire" data-wire={way} data-graview-workflow-wire={`${spot.name}:${kind}`} d={`M${from.x.toFixed(1)} ${from.y.toFixed(1)}L${to.x.toFixed(1)} ${to.y.toFixed(1)}`} />;
                })}
                <circle className="graview-workflow-spot" cx={from.x.toFixed(1)} cy={from.y.toFixed(1)} r={4} />
              </g>
            );
          })}
        </svg>
        {spots.map((spot) => {
          const workflow = byName.get(spot.name)!;
          const from = at(spot.col, spot.row);
          const paused = workflow.status === "paused";
          const last = said.get(spot.name);
          const line = [paused ? "Paused" : "", last ?? ""].filter(Boolean).join(" · ");
          const touches = touchWords(workflow, app.schema);
          return (
            <div
              key={spot.name}
              className="graview-workflow"
              role="group"
              aria-label={`Workflow: ${workflow.title}${paused ? ", paused" : ""}. ${touches ? `${touches.replace(/^./, (first) => first.toUpperCase())}.` : ""}${last ? ` ${last}.` : ""}`}
              data-graview-workflow={spot.name}
              data-graview-workflow-status={workflow.status}
              data-graview-workflow-beside={spot.beside}
              style={{ left: from.x, top: from.y }}
            >
              <span className="graview-workflow-title">{workflow.title}</span>
              {line ? <span className="graview-workflow-last">{line}</span> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
