/**
 * EVERY PORT A HARNESS NAMES, MOVED TOGETHER.
 *
 * The harnesses drive dev servers on fixed ports, and a second checkout —
 * a worktree an agent works in — that ran one on the same ports drove (or
 * refused to borrow) the first checkout's servers. `GRAVIEW_PORT_BASE`
 * moves every one of them: a port is `base + (port − 5190)`, so with
 * `GRAVIEW_PORT_BASE=5600` todo is on 5603, seedbed on 5604, rota on 5605.
 * Unset, every port is the one written here or in the app's vite config.
 *
 * A harness never writes a port number: it names what it serves — an app
 * under `apps/` (its vite config says the port) or one of `OWN` below — and
 * asks `portFor(name)` for the port or `at(name)` for the address. Every
 * port lies in 5190–5289, so a moved base keeps them all in one block of a
 * hundred (5600–5699 for a worktree).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The first port of the block, which a moved base takes the place of. */
export const PORT_FLOOR = 5190;
/** How many ports the block holds: every port a harness names is below the floor plus this. */
export const PORT_SPAN = 100;

/** The ports a harness serves that are no app's dev server, by what they are. */
export const OWN = {
  /** `graview serve` of the rota's data, for `verify-served` and `verify-desk` to open from a folder on a server. */
  served: 5196,
  /** The discography's production build, `vite preview`, for `verify-scale`. */
  "discography-preview": 5198,
  /** The app `smoke-create` scaffolds, and the linked one after it. */
  created: 5280,
  linked: 5281,
  /** `guest-sandbox`'s host page, and the chat's stand-in that frames a widget; it also logs what reaches it. */
  "guest-host": 5282,
  /** `guest-sandbox`'s other origin: the frame guests, and the widget's sandbox proxy. */
  "guest-sandbox": 5283,
  /** `guest-sandbox`'s attacker for the open kit: every request and every connection that reaches it is a view getting out. */
  "guest-attacker": 5279,
  /** The scratch app `rehearse-studio` writes, and the model it stands in for. */
  rehearsal: 5285,
  "rehearsal-model": 5286,
  /** The host's page `verify-studio` mounts the studio into through the embed, as Graview Cloud's builder does. */
  "studio-host": 5287,
  /** The host's page `verify-chrome` mounts the embed into, with a host's own actions, notices and the seat put away. */
  "chrome-host": 5288,
  /** The host's page `verify-declared` mounts a document's declared lenses and arrangement into (FR-79, FR-80). */
  "declared-host": 5284,
  /** The host's page `verify-address` serves an app at under a base path, and an article beside it (FR-106). */
  "address-host": 5278,
  /** The host's page `verify-brand` mounts the En Dash document into, to see the whole brand drawn on both faces (FR-124, FR-125). */
  "brand-host": 5276,
  /** The host's page `verify-chrome-quiet` mounts the org app and Cloud's vendor template into, to count pills and cut-off names (FR-113, FR-117, FR-118). */
  "quiet-host": 5277,
  /** The host's page `verify-long-text` mounts a workshop whose deliverable holds an email drafted in full into (FR-146–FR-148). */
  "long-text-host": 5271,
  /** `pnpm site:serve`: docs/site served as graview.dev serves it, so the site's own font loads (a file:// page cannot load one). */
  "site-preview": 5275,
  /** The OpenAI-shaped stand-in `verify-studio` points the studio's remote model at. */
  "studio-model": 5289,
};

/** The port an app's vite config claims for its dev server. */
function configPort(app) {
  const config = readFileSync(resolve(repoRoot, "apps", app, "vite.config.ts"), "utf8");
  // `port: moved(5193)`: the config moves its own dev server onto the base, and says the port it claims.
  const port = Number(/server:\s*\{[^}]*port:\s*(?:moved\()?(\d+)/.exec(config)?.[1]);
  if (!port) throw new Error(`apps/${app}/vite.config.ts names no server port`);
  return port;
}

/** A port as written, moved onto `GRAVIEW_PORT_BASE` when it is set. */
export function moved(port) {
  if (!Number.isInteger(port) || port < PORT_FLOOR || port >= PORT_FLOOR + PORT_SPAN) {
    throw new Error(`port ${port} is outside ${PORT_FLOOR}–${PORT_FLOOR + PORT_SPAN - 1}, the block GRAVIEW_PORT_BASE moves`);
  }
  const base = process.env["GRAVIEW_PORT_BASE"];
  if (!base) return port;
  const at = Number(base);
  if (!Number.isInteger(at) || at < 1024) throw new Error(`GRAVIEW_PORT_BASE=${base} is not a port to start a block at`);
  return at + (port - PORT_FLOOR);
}

/**
 * The port for what a harness serves: an app under `apps/` by its directory
 * (`"todo"`), or one of `OWN` by name (`"served"`), moved onto the base.
 */
export function portFor(name) {
  if (typeof name !== "string") throw new Error(`portFor takes what is served by name, not ${JSON.stringify(name)}`);
  return moved(Object.hasOwn(OWN, name) ? OWN[name] : configPort(name));
}

/** The address of what a harness serves: `at("todo")` is `http://localhost:5193`, or 5603 on a base of 5600. */
export function at(name) {
  return `http://localhost:${portFor(name)}`;
}

/** What the desk (apps/launcher) links to and probes: the apps it surveys, and the store server one demo opens from. */
export const DESK_SERVES = ["todo", "seedbed", "rota", "served"];

/** Each name's port, moved: what the launcher's vite config hands the page as `__GRAVIEW_PORTS__`. */
export function portsFor(names) {
  return Object.fromEntries(names.map((name) => [name, portFor(name)]));
}

/** An address read from somewhere else (a demo's stop), with any port in the block moved onto the base. */
export function movedIn(text) {
  return text.replace(/localhost:(\d+)/g, (whole, port) => {
    const number = Number(port);
    return number >= PORT_FLOOR && number < PORT_FLOOR + PORT_SPAN ? `localhost:${moved(number)}` : whole;
  });
}
