# @graview/studio

## 0.0.2

### Patch Changes

- a5a867e: Studio: the declaration itself as a graph. `@graview/studio` declares a meta-schema with the same `defineNode` an app uses — kinds, fields, edges, acts, rules, roles, grants, lenses and the brand as nodes — so the declaration is a Graview app over itself. `createStudio(app)` reads a declaration into a store; the ordinary acts change it (add-kind, rename-kind, add-field, add-edge, add-act, add-rule, name-repair, add-role, grant, and their removals), each an op with an author, an intent and an inverse; `studio.check()` runs `graview check` on what the declaration would become and `studio.apply()` refuses while it finds errors, otherwise hands back the new app and the migration a stored graph needs (records of a removed kind go, a dropped field is unset, a required field starts). `studio.files()` writes the declaration back as the `src/domain/` files `graview create` writes. An agent seat proposes by acting under its own batch; a person keeps it or `decline`s it, the way any turn of an agent's is undone. `createStudioLens(app)` is a place: what the checker says, judged on every change.
- Updated dependencies [2e494a0]
- Updated dependencies [2a02849]
- Updated dependencies [a5a867e]
- Updated dependencies [a10c8d0]
- Updated dependencies [60db3d0]
- Updated dependencies [6ecf8ec]
- Updated dependencies [3251440]
- Updated dependencies [1f232bb]
- Updated dependencies [4b96ddb]
- Updated dependencies [08befa1]
- Updated dependencies [99b4b27]
- Updated dependencies [f579faa]
- Updated dependencies [d7ea1a1]
- Updated dependencies [ea93a35]
- Updated dependencies [ced759d]
- Updated dependencies [666cc05]
- Updated dependencies [5123cf3]
- Updated dependencies [a5a867e]
- Updated dependencies [5410e86]
- Updated dependencies [5ef7e9b]
- Updated dependencies [992ac22]
- Updated dependencies [22a4a6d]
  - @graview/react@0.0.2
  - @graview/core@0.0.2
