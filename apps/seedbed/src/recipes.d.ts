/*
 * THE RECIPES' FILES, AS THE SITE BUNDLE READS THEM.
 *
 * The recipes live where the site serves them, docs/site/recipes/<slug>/,
 * outside this app's rootDir: vite.site.config.ts resolves `@recipes/` to
 * that folder, and tsc takes them as JSON it does not look inside. The
 * compiler that reads them, `compileDocument`, is what says whether they hold.
 */
declare module "@recipes/*" {
  const value: unknown;
  export default value;
}

/*
 * THE ASKS graview.dev replays, from apps/site/asks/ by the same kind of
 * alias: the turns and the season app as JSON, and each worker view as its
 * own text (`?raw`), handed to the view host exactly as a product hands it.
 */
declare module "@site-asks/*.json" {
  const value: unknown;
  export default value;
}
declare module "@site-asks/*?raw" {
  const source: string;
  export default source;
}
