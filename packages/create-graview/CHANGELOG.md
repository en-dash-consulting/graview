# create-graview

## 0.0.1

### Patch Changes

- 34c1600: A product on Graview can be started rather than assembled. `graview create
  <dir>` — and its conventional door, `npm create graview` — writes the project
  the `graview-new-app` skill describes: one declared kind with `creates`,
  `connects`, `writes` and a horizon, one rule that names its repair, an
  eighty-line shell of framework parts, the routed face, persistence in the
  browser, a headless test and a CI workflow; then installs it, installs the
  authoring skills into it, and says what to do next. `--link <path>` makes
  the same project consume the framework from a sibling checkout by path, the
  way the first-party products do, with the one thing that shape needs and
  nothing said about: tsc pointed at a single copy of zod. The generator is
  `@graview/core/scaffold`, a pure function from a name and a first kind to a
  list of files, for a host that provisions apps in-process. The skill now
  begins with the scaffolder. `scripts/smoke-create.mjs` keeps all of it
  honest on every push: scaffold from the packed tarballs, install with no
  workspace, run the project's own `verify`, open it in a real browser, then
  the same by path.
  
  The rehearsal also caught two primitives mixing a `border` shorthand with a
  `borderColor` that came and went across renders — the Standing button and
  the affordance strip — which React reports on every rerender; both now set
  the longhand, and the browser console of a scaffolded app is empty.
  
  A premortem of the first hour closed the gaps between "the harness passes"
  and "a person succeeds": the root `pnpm build` now builds every package a
  linked project resolves types from (pages and ship were missing, so a fresh
  clone could not scaffold); `graview create` refuses a framework that is not
  built and says how to build it, warns when the project would land inside the
  framework's own tree, initialises a repository, and in link mode writes a CI
  workflow that checks the framework out beside the app and builds it first;
  a project declares Node 22, tells pnpm 10 about esbuild's postinstall, and
  runs `check` and `docs` cold; and the README leads with the path that works
  today rather than the one that works once the packages are published.
  
  And the shell is a primitive. `Shell` in `@graview/primitives` is the command
  bar, the scene, the inspector and the rail — with the landmarks assistive
  technology expects, once — so an app supplies a home, a sentence for when
  nothing is wrong, and a seat. The scaffold, the todo example and the empty
  example all use it now instead of carrying eighty drifting lines each.
- Updated dependencies [ec91236]
- Updated dependencies [e38fe86]
- Updated dependencies [5cd68d6]
- Updated dependencies [95cceb3]
- Updated dependencies [094f3cc]
- Updated dependencies [090ab39]
- Updated dependencies [a94d8f5]
- Updated dependencies [87948ef]
- Updated dependencies [4bd846b]
- Updated dependencies [cfdad5a]
- Updated dependencies [34c1600]
- Updated dependencies [329da2e]
- Updated dependencies [77d1d4a]
- Updated dependencies [04eaefe]
- Updated dependencies [f24ef6e]
  - @graview/core@0.0.1
