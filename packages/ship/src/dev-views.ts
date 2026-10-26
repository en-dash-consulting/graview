import type { IncomingMessage, ServerResponse } from "node:http";
import { memoryViews, type KeptViews, type KeptViewsMay } from "@graview/core";
import { DOOR_LOCKED, fromThisApp, openDoors, readBody, sendJson, type DevServerPlugin } from "./door.js";
import { answerViews } from "./views.js";

/*
 * A DEV SERVER'S VIEWS (Roadmap f-place-menu-views): the door the place
 * menu's Hide, Delete, Show and Restore go to while an app runs under
 * `pnpm dev`, and the harnesses' too — `remoteViews({ url, path:
 * DEV_VIEWS_PATH })` is the page's half. It keeps what it is told IN MEMORY,
 * for as long as the dev server runs: the names hidden, and the views
 * deleted, each for thirty days. Whoever is at the dev server's page may
 * tidy the views a chat drew; the declaration's lenses are the studio
 * door's to write, so not here. Same-origin only, like every door here.
 *
 *   GET  <path>    { hidden, removed, may }
 *   POST <path>    { hide | show | remove | restore: "<name>" }, answered
 *                  with the state after it
 */

export const DEV_VIEWS_PATH = "/__graview/views";

export interface DevViewsOptions {
  /** Where the door answers. `/__graview/views` by default. */
  readonly path?: string;
  /** What the page may tidy. Script views, by default. */
  readonly may?: KeptViewsMay;
  /** Where they are kept: memory by default, gone when the dev server stops. */
  readonly views?: KeptViews;
}

/** The dev door's handler, for a server that is not Vite's. */
export function devViewsHandler(options: DevViewsOptions = {}) {
  const views = options.views ?? memoryViews();
  const may = options.may ?? { views: true, lenses: false };
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!fromThisApp(req)) return sendJson(res, 403, { error: DOOR_LOCKED });
    try {
      const body = req.method === "POST" ? (JSON.parse((await readBody(req, 100_000, "views")) || "{}") as unknown) : undefined;
      const answer = await answerViews(req.method ?? "GET", body, may, views);
      sendJson(res, answer.status, answer.body);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  };
}

/** The dev door as a Vite plugin: `plugins: [devViews()]`. */
export function devViews(options: DevViewsOptions = {}): DevServerPlugin {
  const handler = devViewsHandler(options);
  return {
    name: "graview:dev-views",
    apply: "serve",
    configureServer(server) {
      openDoors(server);
      server.middlewares.use(options.path ?? DEV_VIEWS_PATH, (req, res) => {
        void handler(req, res);
      });
    },
  };
}
