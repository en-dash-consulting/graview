/**
 * WHAT A FACE'S FIRST DRAW OPENS, NAMED FOR A HOST'S BUILD (FR-194).
 *
 * A face is fetched as it is drawn (FR-57), and a host that knows which
 * face it opens on names that face's chunks in its page's head, so they
 * are asked for as the head is read. But a face opens doors of its own as
 * it first draws: the home's lenses, a list's arranging, the bar's
 * Activity; on the scene the relations' ribbons, the city's ground, the
 * districts' states and the way back. Each is a module fetched only once
 * the face has run — a round trip after the face's own chunk, half a
 * second and more on a phone's network — and each stays a door, so a page
 * that never draws a lens never carries one.
 *
 * So the embed says which they are, by the module each door opens, and
 * `firstDrawChunks` finds them in the host's own build: given esbuild's
 * metafile (`metafile: true`), the chunks a face's first draw asks for —
 * each door's chunk and every chunk it imports outright — to name in the
 * head beside the face's own:
 *
 *   const built = await esbuild.build({ ...yourShell, splitting: true, metafile: true });
 *   const chunks = firstDrawChunks(built.metafile, "pages");
 *   // <link rel="modulepreload" href="/<each chunk's file name>"> in the page's head
 *
 * A build tool's script, never the page's: nothing here is imported by
 * what draws, so it costs a page nothing.
 */

/** The faces a host opens on, as `mount({ face })` names them; `"graview"` is the scene at altitude. */
export type FirstDrawFace = "scene" | "graview" | "pages" | "picture";

/** A door a face opens as it is first drawn: the module it imports, by its package and its path inside the package's build, without an extension. */
export interface FirstDrawDoor {
  readonly package: string;
  readonly module: string;
}

const door = (pkg: string, module: string): FirstDrawDoor => ({ package: `@graview/${pkg}`, module });

/* Every face draws the framework's own views and the notices beside its own chunk. */
const EVERY_FACE: readonly FirstDrawDoor[] = [door("primitives", "framework-views"), door("primitives", "notice-stacks")];

/* The scene at altitude: its face, the relations' ribbons, the city's ground, the districts' states and the way back an act is offered. */
const SCENE: readonly FirstDrawDoor[] = [
  door("embed", "scene-face"),
  ...EVERY_FACE,
  door("react", "ribbons-layer"),
  door("react", "plots"),
  door("primitives", "states-bar"),
  door("primitives", "scene-way-back-door"),
];

/**
 * THE DOORS EACH FACE OPENS ON ITS FIRST DRAW: its own chunk first, then
 * what it draws with. The pages: the declared lenses' factories (a home's
 * pictures, a place), the home written as blocks, a list's arranging, the
 * bar's tools (Activity, once anything has happened) and a date's box in a
 * form.
 */
export const FIRST_DRAW_DOORS: Readonly<Record<FirstDrawFace, readonly FirstDrawDoor[]>> = {
  pages: [
    door("embed", "pages-content"),
    ...EVERY_FACE,
    door("primitives", "declared-lenses"),
    door("primitives", "home-view"),
    door("primitives", "arrange-lists"),
    door("primitives", "bar-panes"),
    door("primitives", "when-input"),
  ],
  scene: SCENE,
  graview: SCENE,
  picture: [door("embed", "picture-face"), ...EVERY_FACE],
};

/** What `firstDrawChunks` reads of esbuild's metafile: each output's entry point and what it imports. */
export interface FirstDrawMetafile {
  readonly outputs: Readonly<Record<string, { readonly entryPoint?: string; readonly imports: readonly { readonly path: string; readonly kind: string }[] }>>;
}

/** Whether a metafile's entry point is a door's module: from the workspace's sources or a package's build, through any node_modules. */
function opens(entryPoint: string, one: FirstDrawDoor): boolean {
  const path = entryPoint.replace(/\\/g, "/").replace(/\.(?:[cm]?js|tsx?|jsx)$/, "");
  const dir = one.package.replace(/^@graview\//, "");
  return path.endsWith(`${one.package}/dist/${one.module}`) || path.endsWith(`${one.package}/src/${one.module}`) || path.endsWith(`packages/${dir}/src/${one.module}`) || path.endsWith(`packages/${dir}/dist/${one.module}`);
}

/**
 * THE CHUNKS A FACE'S FIRST DRAW ASKS FOR, in a host's build: every door
 * `FIRST_DRAW_DOORS` names for the face, found by its entry point in the
 * metafile, with every chunk it imports outright — as the metafile names
 * them (its `outputs`' keys), each once. A door the build does not split
 * off (one the host's page never reaches) is passed over.
 */
export function firstDrawChunks(metafile: FirstDrawMetafile, face: FirstDrawFace): string[] {
  const outputs = metafile.outputs;
  const found = new Set<string>();
  for (const one of FIRST_DRAW_DOORS[face]) {
    const chunk = Object.keys(outputs).find((file) => {
      const entryPoint = outputs[file]!.entryPoint;
      return entryPoint !== undefined && opens(entryPoint, one);
    });
    if (chunk === undefined) continue;
    const closure = [chunk];
    for (const file of closure) {
      if (found.has(file)) continue;
      found.add(file);
      for (const imported of outputs[file]!.imports) if (imported.kind === "import-statement" && outputs[imported.path] && !found.has(imported.path)) closure.push(imported.path);
    }
  }
  return [...found];
}
