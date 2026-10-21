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
import { readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
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
  /** `graview preview` of a Cloud document and its seed, for `verify-preview`; and the `graview shots` it runs after. */
  preview: 5200,
  "preview-shots": 5201,
  /** `graview preview` of the RSVP document, for `verify-preview` to answer its form for a visitor at `/forms/rsvp`. */
  "preview-form": 5202,
  /** `graview preview` of the meetings document, for `verify-date-inputs` to type and pick a meeting's start and end on both faces. */
  "date-inputs": 5254,
  /** The discography's production build, `vite preview`, for `verify-scale`. */
  "discography-preview": 5198,
  /** The app `smoke-create` scaffolds, and the linked one after it. */
  created: 5280,
  linked: 5281,
  /** `guest-sandbox`'s host page, and the chat's stand-in that frames a widget; it also logs what reaches it. */
  "guest-host": 5282,
  /** `guest-sandbox`'s other origin: the frame guests, and the widget's sandbox proxy. */
  "guest-sandbox": 5283,
  /** `graview preview` of the architecture recipe's document, and the recipe's product face over it on a dev server of its own, for `verify-face-recipe`. */
  "face-recipe-preview": 5240,
  "face-recipe": 5241,
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
  /** The host's page `verify-offline` mounts the embed into, to take the browser offline before the person's menu has arrived (FR-139). */
  "offline-host": 5274,
  /** The host's page `verify-drawn-once` mounts Cloud's workshop into, to see a selected record drawn by one thing (FR-141–FR-143). */
  "drawn-once-host": 5273,
  /** The host's page `verify-files` mounts a house's repairs into, and the dev server's files door beside it (FR-162, FR-163). */
  "files-host": 5263,
  /** The host's page `verify-growing` mounts a roadmap grown large into: filters that stay usable, cards read at a glance. */
  "growing-host": 5258,
  /** The host's page `verify-drawn` mounts a roadmap into with a late font, a late image and a view that fails, to hold `data-graview-drawn` to what a person sees (FR-188). */
  "drawn-host": 5259,
  /** The host's page `verify-screen-reader` mounts a roadmap into, in two tabs sat down as two people, to hear what a screen reader is told. */
  "screen-reader-host": 5256,
  /** The host's page `verify-field-types` mounts a choir's rehearsals into: a phone to call, a place to map, a duration said and summed. */
  "field-types-host": 5257,
  /** The host's page `verify-app-links` mounts purchase scenarios that link other apps into, with a resolver of its own (FR-171). */
  "app-links-host": 5268,
  /** The host's page `verify-repeats` mounts a running club whose practice repeats every Tuesday into: occurrences drawn, the next one said. */
  "repeats-host": 5262,
  /** The host's page `verify-long-text` mounts a workshop whose deliverable holds an email drafted in full into (FR-146–FR-148). */
  "long-text-host": 5271,
  /** `calendar-sync-demo`'s meetings app, kept in step with the Google test calendar for a person to try by hand. */
  "calendar-sync-demo": 5267,
  /** The host's page `verify-viewport` mounts the embed into at the screen's height, to turn a phone and back (FR-165). */
  "viewport-host": 5266,
  /** The host's page `verify-a11y` mounts Cloud's two shapes of app into, inside `#graview-app`, for axe. */
  "a11y-host": 5269,
  /** `pnpm site:serve`: docs/site served as graview.dev serves it, so the site's own font loads (a file:// page cannot load one). */
  "site-preview": 5275,
  /** `verify-first-load`'s two previews of Cloud's shell: the roadmap at the Roadmap's size, and a small team's tasks. */
  "first-load-roadmap": 5250,
  "first-load-tasks": 5251,
  /** The OpenAI-shaped stand-in `verify-studio` points the studio's remote model at. */
  "studio-model": 5289,
};

/** The port an app's vite config claims for its dev server: one under `apps/` by name, or one beside the checkout by its absolute path. */
function configPort(app) {
  const where = isAbsolute(app) ? resolve(app, "vite.config.ts") : resolve(repoRoot, "apps", app, "vite.config.ts");
  const config = readFileSync(where, "utf8");
  // `port: moved(5193)`: the config moves its own dev server onto the base, and says the port it claims.
  const port = Number(/server:\s*\{[^}]*port:\s*(?:moved\()?(\d+)/.exec(config)?.[1]);
  if (!port) throw new Error(`${isAbsolute(app) ? where : `apps/${app}/vite.config.ts`} names no server port`);
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
 * An app beside the checkout — a walk's, named by its absolute path — is
 * served where its own config says: `graview create --port` may have put
 * it outside the block, and then the port is that project's to choose.
 */
export function portFor(name) {
  if (typeof name !== "string") throw new Error(`portFor takes what is served by name, not ${JSON.stringify(name)}`);
  if (isAbsolute(name)) {
    const port = configPort(name);
    return port >= PORT_FLOOR && port < PORT_FLOOR + PORT_SPAN ? moved(port) : port;
  }
  return moved(Object.hasOwn(OWN, name) ? OWN[name] : configPort(name));
}

/** The address of what a harness serves: `at("todo")` is `http://localhost:5193`, or 5603 on a base of 5600. */
export function at(name) {
  return `http://localhost:${portFor(name)}`;
}

/**
 * Every port a harness names, moved onto the base: each app under `apps/`
 * whose vite config claims one (with its directory, so a server there can
 * be told apart from somebody else's), and each of `OWN`.
 *
 * @returns {{ name: string, port: number, app: string | null }[]}
 */
export function namedPorts() {
  const apps = readdirSync(resolve(repoRoot, "apps")).flatMap((name) => {
    try {
      return [{ name, port: portFor(name), app: resolve(repoRoot, "apps", name) }];
    } catch {
      // No vite config, or one that serves nothing in development (apps/spike).
      return [];
    }
  });
  return [...apps, ...Object.keys(OWN).map((name) => ({ name, port: portFor(name), app: null }))];
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
