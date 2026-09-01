import type { AnySchema, GraviewApp, Operation, Store } from "@graview/core";
import type { GraphSnapshot } from "./snapshot.js";

/**
 * THE ANTI-LOCK-IN CLAIM, as a data shape. Everything a deployment is —
 * the graph, its whole attributed history, and the version it stands at —
 * leaves in one JSON-serialisable bundle, and re-imports into any other
 * deployment of the same declaration: hosted to self-hosted and back.
 * A tenant who cannot leave was never a customer, only a hostage.
 */
export interface AppBundle {
  readonly format: "graview-bundle";
  readonly bundleVersion: 1;
  readonly app: string;
  readonly version: number;
  readonly exportedAt: string;
  readonly snapshot: GraphSnapshot;
  readonly log: readonly Operation[];
}

export function exportBundle<S extends AnySchema>(
  app: GraviewApp<S>,
  store: Store<S>,
  options: { readonly log?: readonly Operation[]; readonly now?: () => string } = {},
): AppBundle {
  return {
    format: "graview-bundle",
    bundleVersion: 1,
    app: app.name,
    version: app.version ?? 1,
    exportedAt: (options.now ?? (() => new Date().toISOString()))(),
    snapshot: store.snapshot() as GraphSnapshot,
    // The persisted log when the caller has one (it holds migration runs and
    // prior sessions); the in-memory log otherwise.
    log: options.log ?? store.log.all(),
  };
}

/** Refuses a bundle for a different app or a newer format, plainly. */
export function assertBundle<S extends AnySchema>(app: GraviewApp<S>, bundle: AppBundle): void {
  if (bundle.format !== "graview-bundle") {
    throw new Error(`Not a graview bundle (format "${(bundle as { format?: string }).format}")`);
  }
  if (bundle.bundleVersion > 1) {
    throw new Error(
      `Bundle format ${bundle.bundleVersion} is newer than this ship understands (1). Upgrade @graview/ship, then import.`,
    );
  }
  if (bundle.app !== app.name) {
    throw new Error(`This bundle is for "${bundle.app}", not "${app.name}"`);
  }
  if (bundle.version > (app.version ?? 1)) {
    throw new Error(
      `Bundle is at version ${bundle.version}; this declaration only reaches ${app.version ?? 1}. ` +
        `Upgrade the app, then import.`,
    );
  }
}
