import { Graph } from "@graview/core";
import { awkwardApp, awkwardGraph } from "@graview/core/testing";
import { describe, expect, it } from "vitest";
import {
  cameraLimit, EMPTY_VIEW, aggregateId, kindCardId, layout, withFocus, withOverview, withRelation } from "../../src/index.js";

/**
 * THE DERIVATION, HELD TO PROPERTIES RATHER THAN TO EXAMPLES.
 *
 * The framework derives an interface from a declaration, so its correctness
 * IS the derivation's correctness — and the derivation was only ever tested
 * against three apps with four or five kinds, short plurals and no chain
 * worth the name. A second product with ten kinds found thirty consequences
 * in an afternoon, and every one of them was the same sentence: this holds
 * for the examples and stops just past them.
 *
 * So the questions are asked of every shape, at every width, at both text
 * sizes: not "does the seedbed look right" but "is there any declaration for
 * which a card lands off the canvas".
 *
 * Nothing here is random. A generated declaration is a pure function of its
 * options, so a failure names a shape rather than a seed.
 */
const WIDTHS = [360, 390, 520, 700, 900, 1280, 1560, 1920];
const UNITS = [12, 16, 24, 32];
const COUNTS = [1, 2, 5, 8, 12];

const scene = (kinds: number, width: number, unit: number, state = EMPTY_VIEW) => {
  const app = awkwardApp({ kinds });
  const graph = Graph.from(app.schema, awkwardGraph(app, 2) as never);
  return {
    app,
    result: layout(graph as never, app.schema, state, {
      width,
      height: Math.round(width * 0.62),
      unit,
      inset: {
        left: Math.round(Math.min(264, width * 0.22)),
        right: Math.round(Math.min(128, width * 0.107)),
      },
    }),
  };
};

describe("everything the layout places is reachable, for every declaration", () => {
  /*
   * REACHABLE, which at altitude means within the camera's reach. A city
   * has a shape, and a phone is narrower than some shapes: the districts
   * keep their corners and the camera is bounded by the map's extent, so
   * every one of them can be panned to. Inside the stack nothing may leave
   * the canvas at all. `cameraLimit` is the scene's own bound, so this
   * test and the scene cannot disagree about what reachable means.
   */
  it("keeps every card within the camera's reach at every width and text size", () => {
    const outside: string[] = [];
    for (const kinds of COUNTS) {
      for (const width of WIDTHS) {
        for (const unit of UNITS) {
          const { result } = scene(kinds, width, unit);
          const height = Math.round(width * 0.62);
          const reach = result.city ? cameraLimit(result) : { x: 0, y: 0 };
          for (const node of result.nodes) {
            if (
              node.x < -reach.x - 0.5 ||
              node.x + node.width > width + reach.x + 0.5 ||
              node.y < -reach.y - 0.5 ||
              node.y + node.height > height + reach.y + 0.5
            ) {
              outside.push(
                `${kinds} kinds at ${width}x${height}/${unit}: ${node.id} at ${Math.round(node.x)}..${Math.round(node.x + node.width)}`,
              );
            }
          }
        }
      }
    }
    expect(outside.slice(0, 8)).toEqual([]);
  });

  it("never draws two districts on top of each other", () => {
    const piled: string[] = [];
    for (const kinds of COUNTS) {
      for (const width of WIDTHS) {
        for (const unit of UNITS) {
          const row = scene(kinds, width, unit).result.nodes.filter(
            (node) => node.plane === 2 && node.nestedUnder === undefined,
          );
          for (const [index, card] of row.entries()) {
            for (const other of row.slice(index + 1)) {
              const across = card.x < other.x + other.width - 1 && other.x < card.x + card.width - 1;
              const down = card.y < other.y + other.height - 1 && other.y < card.y + card.height - 1;
              if (across && down) piled.push(`${kinds} kinds at ${width}/${unit}: ${card.id} over ${other.id}`);
            }
          }
        }
      }
    }
    expect(piled.slice(0, 8)).toEqual([]);
  });

  /*
   * A DISTRICT IS READ, NOT GLANCED AT. Measured in a browser, a card holds
   * a seven- or eight-letter plural on one line down to about 132px; below
   * that the row sheds onto a card that names the rest. Either way no card
   * is drawn at a width its own name cannot survive — unless the whole span
   * is narrower than the floor, where the room wins and there is nothing
   * else to do.
   */
  it("draws no district below the width its name needs", () => {
    const squeezed: string[] = [];
    for (const kinds of COUNTS) {
      for (const width of WIDTHS) {
        for (const unit of UNITS) {
          const span = width - Math.round(Math.min(264, width * 0.22)) - Math.round(Math.min(128, width * 0.107));
          const floor = Math.min(132 * (unit / 16), span - 32);
          for (const card of scene(kinds, width, unit).result.nodes.filter((node) => node.plane === 2)) {
            if (card.width < floor - 0.5) {
              squeezed.push(`${kinds} kinds at ${width}/${unit}: ${card.id} is ${Math.round(card.width)} of ${Math.round(floor)}`);
            }
          }
        }
      }
    }
    expect(squeezed.slice(0, 8)).toEqual([]);
  });

  it("draws or names every kind, however many there are", () => {
    for (const kinds of COUNTS) {
      for (const width of WIDTHS) {
        const { app, result } = scene(kinds, width, 16);
        const row = result.nodes.filter((node) => node.plane === 2);
        const drawn = row.filter((node) => node.beyond === undefined).map((node) => node.kind);
        const named = row.flatMap((node) => [...(node.beyond ?? [])]);
        const seen = new Set([...drawn, ...named]);
        for (const kind of app.schema.kinds as readonly string[]) {
          /* The installation's own kinds are drawn only for a seat that may
             administer them, which is the provider's answer rather than the
             layout's. */
          if (kind === "user" || kind === "invitation") continue;
          expect(seen.has(kind), `${kinds} kinds at ${width}: ${kind} is neither drawn nor named`).toBe(true);
        }
      }
    }
  });

  it("holds in every arrangement, not only at rest", () => {
    const app = awkwardApp({ kinds: 8 });
    const graph = Graph.from(app.schema, awkwardGraph(app, 2) as never);
    const kinds = app.schema.kinds as readonly string[];
    const states = [
      EMPTY_VIEW,
      withOverview(EMPTY_VIEW, true),
      withFocus(EMPTY_VIEW, aggregateId(kinds[0]!)),
      withRelation(withFocus(EMPTY_VIEW, aggregateId(kinds[0]!)), kinds[1]!),
      { ...withFocus(EMPTY_VIEW, aggregateId(kinds[0]!)), zoom: true },
      { ...EMPTY_VIEW, expanded: [kindCardId(kinds[0]!)], overview: true },
    ];
    for (const width of [390, 700, 1560]) {
      for (const state of states) {
        const height = Math.round(width * 0.62);
        const result = layout(graph as never, app.schema, state, { width, height, unit: 16 });
        const reach = result.city ? cameraLimit(result) : { x: 0, y: 0 };
        for (const node of result.nodes) {
          expect(node.x, `${width} ${JSON.stringify(state).slice(0, 40)} ${node.id}`).toBeGreaterThanOrEqual(-reach.x - 0.5);
          expect(node.x + node.width).toBeLessThanOrEqual(width + reach.x + 0.5);
          expect(node.y + node.height).toBeLessThanOrEqual(height + reach.y + 0.5);
        }
      }
    }
  });
});
