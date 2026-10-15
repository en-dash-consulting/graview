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
