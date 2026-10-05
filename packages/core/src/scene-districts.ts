import type { GraviewApp } from "./app.js";
import { beginning } from "./beginning.js";
import { cityMap, type Plot } from "./city.js";
import type { AnySchema } from "./schema/schema.js";
import { hueFor } from "./theme/derive.js";

/*
 * THE DISTRICTS THE SCENE DRAWS, WITHOUT THE SCENE (FR-74).
 *
 * From altitude the Scene stands each kind on its plot of the declaration's
 * own map (`cityMap`), walked in the order a blank installation fills its
 * kinds (`beginning(app).order`), in the kind's hue (`hueFor` with the
 * brand's accents). Those three are all declaration — no graph, no DOM, no
 * window size — so a host listing apps can ask for them in Node or a worker
 * and get the same corners the live Scene puts them on.
 */

export interface SceneDistrict {
  readonly kind: string;
  /** What the kind is called in the plural — what the district says it holds. */
  readonly label: string;
  /** Degrees, 0–359, rounded as the Scene rounds it for a plot. */
  readonly hue: number;
  /** Its plot on the map, in lattice cells. */
  readonly plot: Plot;
  /** How many stand on it, as given; 0 when nothing was said. */
  readonly count: number;
}

export interface SceneDistrictOptions {
  /** How many of each kind stand today: a populated kind takes a larger plot on the same corner. */
  readonly counts?: Readonly<Record<string, number>>;
}

/**
 * Every kind's district, in the order the Scene walks the map — the same
 * plot and hue it draws for this app.
 */
export function sceneDistricts<S extends AnySchema>(app: GraviewApp<S>, options: SceneDistrictOptions = {}): readonly SceneDistrict[] {
  const order = beginning(app).order.map((entry) => entry.kind);
  const counts = options.counts ?? {};
  const map = cityMap(app.schema, { order, counts });
  const accents = app.brand?.accents;
  return order
    .filter((kind) => map.has(kind))
    .map((kind) => {
      const definition = app.schema.tryDefinition(kind) as { plural?: string } | undefined;
      const count = counts[kind];
      return {
        kind,
        label: definition?.plural ?? `${kind}s`,
        hue: Math.round(hueFor(kind, accents)),
        plot: map.get(kind)!,
        count: typeof count === "number" && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
      };
    });
}
