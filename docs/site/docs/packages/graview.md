# graview

`graview` is one of the 14 npm packages of Graview, a TypeScript framework for agent-native apps built as isometric scenes. The Graview command line: start a product, check its declaration, write its agent docs, serve its store, host it for an agent over MCP, apply an act to it, sync its seed, install the authoring skills. The tool; @graview/* is the framework.

```sh
pnpm add graview
```

## What it is

The Graview command line. `graview` is the tool; `@graview/*` is the framework a product imports.

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
graview skills install .              # the authoring skills, for Claude Code and Codex
```

`serve`, `mcp`, `apply` and `sync-seed` share one store: `--data <dir>` (a folder of readable JSON, the default), `--sqlite <file>`, or — for `mcp` and `apply` — `--remote-url <url>` against a running `graview serve`. `--as` and `--roles` say who is acting; the policy judges on the host exactly as it judges in a browser.

A project made by `graview create` has this package as a devDependency, so `npm run check`, `npm run docs` and `npm run skills` reach the same version of the tool the project was scaffolded with.

Every subcommand is implemented in the package whose concern it is: `create`, `check`, `docs`, `describe`, `lens` and `figure` in `@graview/core`, `serve` and `sync-seed` in `@graview/ship`, `mcp` and `apply` in `@graview/tools`, `skills` in `@graview/skills`. This package dispatches and nothing else.

## What it exports (1)

Read off the package's own barrel, so this is what is there today.

`main`

---

The Graview command line: start a product, check its declaration, write its agent docs, serve its store, host it for an agent over MCP, apply an act to it, sync its seed, install the authoring skills. The tool; @graview/* is the framework.

The page: https://graview.dev/docs/packages/graview.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
