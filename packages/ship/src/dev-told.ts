import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import type { Author } from "@graview/core";
import type { ToldStore } from "@graview/core/told";
import { DOOR_LOCKED, fromThisApp, openDoors, readBody, sendJson, type DevServerPlugin } from "./door.js";
import { fileTold } from "./file-told.js";
import { TOLD_MAX_BYTES, toldDoor } from "./told.js";

/**
 * WHAT PEOPLE TELL GRAVIEW, KEPT BY THE DEV SERVER (Roadmap f-menu-learns):
 * `/__graview/told` answers as `graview serve`'s `/graview/told` does, and
 * keeps `told.json` in the app's `.generated/` (ignored by git) unless
 * `file` says where — so ratings and suggestions survive a reload in
 * `pnpm dev`. `aiThroughDevServer` finds it and hands the page `HostAi.told`.
 *
 * A dev server has no sessions: it believes the page about who told it, as
 * every dev door believes the page it serves, and whoever is at the page
 * keeps the app (the Studio's pin, exclude and delete). Serve only, like
 * the other doors; a build carries none of it.
 */
export const DEV_TOLD_PATH = "/__graview/told";

export interface DevToldOptions {
  /** Where the tellings are kept: `.generated/told.json` under the dev server's root, unsaid. */
  readonly file?: string;
  readonly path?: string;
  /** A host's own store in place of the file. */
  readonly store?: ToldStore;
}

/** The door's handler, for a server that is not Vite's. */
export function devToldHandler(options: DevToldOptions & { readonly root?: string } = {}) {
  const store = options.store ?? fileTold(options.file ?? join(resolve(options.root ?? process.cwd()), ".generated", "told.json"));
  const door = toldDoor({ store, curates: () => true });
  const path = options.path ?? DEV_TOLD_PATH;
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!fromThisApp(req)) return sendJson(res, 403, { error: DOOR_LOCKED });
    const url = (req.url ?? "/").split("?")[0]!;
    const rest = url.startsWith(path) ? url.slice(path.length) : url === "/" ? "" : url;
    const method = req.method ?? "GET";
    let text = "";
    try {
      text = method === "GET" || method === "DELETE" ? "" : await readBody(req, TOLD_MAX_BYTES * 2, "a telling");
    } catch (error) {
      return sendJson(res, 413, { error: error instanceof Error ? error.message : String(error), reason: "limit" });
    }
    /* Who: the page's word for a new one; for a change, who told it. */
    let by: Author = { kind: "human", id: "developer" };
    try {
      const asked = text ? (JSON.parse(text) as { telling?: { by?: Author } }) : {};
      const said = asked.telling?.by;
      if (method === "POST" && said && typeof said.kind === "string" && said.kind !== "visitor") by = { kind: said.kind as Author["kind"], ...(typeof said.id === "string" ? { id: said.id } : {}) };
      else if (rest.length > 1) {
        const id = decodeURIComponent(rest.slice(1));
        by = (await store.list()).find((one) => one.id === id)?.by ?? by;
      }
    } catch {
      // Not JSON: the door says so.
    }
    const answer = await door(method, rest, text, by);
    if (answer.status === 204) {
      res.statusCode = 204;
      res.end();
      return;
    }
    for (const [name, value] of Object.entries(answer.headers ?? {})) res.setHeader(name, value);
    sendJson(res, answer.status, answer.body);
  };
}

/** The dev server's door to what people tell Graview. */
export function devTold(options: DevToldOptions = {}): DevServerPlugin {
  return {
    name: "graview:dev-told",
    apply: "serve",
    configureServer(server) {
      openDoors(server);
      const handler = devToldHandler({ ...options, root: (server.config as { root?: string } | undefined)?.root ?? process.cwd() });
      server.middlewares.use(options.path ?? DEV_TOLD_PATH, (req, res) => {
        void handler(req, res);
      });
    },
  };
}

