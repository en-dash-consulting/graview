# graview

The Graview command line. `graview` is the tool; `@graview/*` is the
framework a product imports.

```sh
npx graview create my-app          # a product on Graview, from nothing
npm create graview my-app          # the same, by npm's convention

graview check ./dist/domain/app.js    # the declaration, judged
graview docs ./dist/domain/app.js     # llms.txt and agents.md, derived
graview describe ./dist/domain/app.js # the app read out, for something that cannot see
graview lens <name> --roles a,b       # a lens that compiles, with its reuse test red
graview figure <entry> --kind <kind>  # the figure line for a kind
graview serve ./dist/domain/app.js    # the store behind HTTP, data in a folder
graview mcp ./dist/domain/app.js      # the same store, for an agent over MCP (stdio)
graview apply ./dist/domain/app.js --call <act> --args '{...}'   # one act, from a shell
graview sync-seed ./dist/domain/app.js --seed ./seed.json        # default content, moved without a wipe
graview preview app.json --seed seed.json   # the store AND the scene and Pages over it, no product needed
graview shots app.json --seed seed.json --places home,overview   # named places, headless, to PNGs
graview doctor                        # one Graview release in package.json, the lockfile, node_modules, the documents, React's pair
graview skills install .              # the authoring skills, for Claude Code and Codex
```

`preview` is `serve` with Graview's own faces over the store, at the
address it prints (which carries that run's key, as `serve`'s does): a JSON
document and a snapshot, looked at with nothing built and nothing else
installed — the page ships in this package. `shots` photographs the same
page headless; it needs Playwright, which you install beside the project
(`npm i -D playwright && npx playwright install chromium`).

`serve`, `mcp`, `apply` and `sync-seed` share one store: `--data <dir>` (a
folder of readable JSON, the default), `--sqlite <file>`, or — for `mcp` and
`apply` — `--remote-url <url>` against a running `graview serve`, given the
address it printed (it carries that run's key). `--as` and
`--roles` say who is acting; the policy judges on the host exactly as it
judges in a browser.

A project made by `graview create` has this package as a devDependency, so
`npm run check`, `npm run docs` and `npm run skills` reach the same version
of the tool the project was scaffolded with.

Inside a pnpm workspace, run the project's own `graview`
(`node_modules/.bin/graview`, or `pnpm exec graview`) rather than `npx -y
graview@<version>`: when the workspace already holds that release in its
hidden hoist, npx skips the install and then finds no bin, and says
`sh: graview: command not found`. `graview doctor` says when the release you
run is not the one the project pins.

Every subcommand is implemented in the package whose concern it is:
`create`, `check`, `docs`, `describe`, `lens`, `figure` and `doctor` in
`@graview/core`, `serve`, `sync-seed`, `preview` and `shots` in
`@graview/ship`, `mcp` and `apply` in `@graview/tools`, `skills` in
`@graview/skills`, `view` in `@graview/guest`. This package dispatches, and
carries the page `preview` serves (`dist/preview/`, built with the
framework) so that no product has to.
