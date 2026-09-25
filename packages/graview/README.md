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
graview skills install .              # the authoring skills, for Claude Code and Codex
```

A project made by `graview create` has this package as a devDependency, so
`npm run check`, `npm run docs` and `npm run skills` reach the same version
of the tool the project was scaffolded with.

Every subcommand is implemented in the package whose concern it is:
`create`, `check`, `docs`, `describe`, `lens` and `figure` in
`@graview/core`, `serve` in `@graview/ship`, `skills` in `@graview/skills`.
This package dispatches and nothing else.
