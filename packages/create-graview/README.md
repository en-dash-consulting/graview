# create-graview

```sh
npm create graview@latest my-app
pnpm create graview my-app
```

Once the packages are published. Until then, from a framework checkout:
`pnpm graview create ../my-app --link .`

The conventional door to `graview create`. It writes a product on Graview —
the declaration split into domain and UI, an eighty-line shell, a headless
test and a CI workflow — installs it, and says what to do next. The generator
and the command live in `@graview/core`; this package only makes `npm create`
find them.

```
--name "Field Notes"   the product's name (default: from the directory)
--kind note            the first node kind (default: item)
--link ../graview      consume the framework by path from a sibling checkout
--pm pnpm|npm          the package manager (default: whichever ran this)
--no-install           write the files and stop
```

`scripts/smoke-create.mjs` in the framework repository is what keeps this
honest: on every push it scaffolds a project from the packed tarballs,
installs it the way a stranger would, runs the project's own `verify`, and
opens it in a real browser.
