---
"graview": minor
"create-graview": minor
"@graview/core": minor
"@graview/layout": minor
"@graview/tools": minor
"@graview/render": minor
"@graview/react": minor
"@graview/primitives": minor
"@graview/pages": minor
"@graview/ship": minor
"@graview/studio": minor
"@graview/embed": minor
"@graview/skills": minor
---

The first public release, 0.1.0, under the Elastic License 2.0.

`graview` is the tool and `@graview/*` is the framework. The command line is
its own package now: `npx graview create my-app` from nothing, and inside a
project `graview check`, `graview docs`, `graview describe`, `graview lens`,
`graview figure`, `graview serve` and `graview skills`. The `graview-serve`
and `graview-skills` bins are gone — `serve` and `skills` are subcommands —
and `@graview/core` no longer carries a bin of its own. A scaffolded project
takes `graview` as its devDependency in place of `@graview/skills`, and
`create-graview` (what `npm create graview` runs) depends on `graview`.

Every package moves in lockstep from here, so the `^<version>` range
`graview create` writes for each `@graview/*` dependency is always one that
exists.
