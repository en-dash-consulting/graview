import { main } from "graview";

/**
 * `npm create graview <dir>` resolves to the `create-graview` bin, by npm's
 * convention. This package is that door and nothing else: the command lives
 * in `graview` and the generator in `@graview/core`, so a project made this
 * way and one made with `graview create` are the same project.
 */
export function createGraview(argv: readonly string[]): Promise<number> {
  return main(["create", ...argv]);
}
