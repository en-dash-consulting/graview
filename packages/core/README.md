# @graview/core

Everything a Graview app declares, and the checker that verifies it.

- **Schema** — `defineNode` and `createSchema`. Zod is the single source of
  runtime validation, TypeScript types and JSON Schema.
- **Graph** — nodes and edges, with a tracked reader so a mutation records
  what it read as well as what it wrote.
- **Mutations** — `defineMutation`. Every change is a typed, named,
  describable act; nothing writes the graph directly.
- **Invariants** — rules that judge the graph and name the mutations that
  would repair them. That naming is the seam derived affordances ride on.
- **Operation log** — the graph is a fold over it. Author, intent, reads and
  writes on every op, which is what makes selective undo a dependency
  question rather than a stack.
- **Permissions** — a `Principal` is an `Author` with roles, so what the log
  blames is what the policy judged.
- **Theme** — the token contract, the two shipped palettes, and a contrast
  checker that measures a brand's palette before it ships.
- **`graview check`** — reads a declaration and reports what is wrong with it,
  in terms an agent can act on.
- **Documents** — `@graview/core/document`: a whole app as one JSON object,
  compiled by `compileDocument` into the same app `defineApp` declares and
  never run as code; `toDocument` writes an app back out. Rules say what must
  hold in a small, budgeted language (`expressionRule`). Every command that
  takes an entry takes `--document <file>`.

```sh
npx graview create my-app          # a product on Graview, started (also: npm create graview)
npx graview check ./dist/domain/app.js
npx graview docs ./dist/domain/app.js
```

`create` writes the declaration split into domain and UI, a shell, a headless
test and a CI workflow, initialises a repository, installs, and says what to
do next. `--link <path>` consumes the framework from a sibling checkout by
path instead of a registry — the only way that works until the packages are
published — and refuses a framework that is not built.
The generator behind it is `@graview/core/scaffold`, a pure function from a
name and a first kind to a list of files, for a host that provisions apps.
