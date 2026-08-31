---
name: graview-new-app
description: Start a product on Graview in its own repository — the shape of the declaration, the shell that comes for free, and the CI that keeps it honest afterwards.
---

# Start a product on Graview

Graview ships as six packages. A product built on it lives in **its own
repository** and depends on them the way any other consumer does. This is the
setup that gets you from nothing to something that can tell you when you have
broken it.

## The shape

```
src/
  domain/            # No React in here. This is what `graview check` reads.
    schema.ts        # defineNode × n, createSchema
    mutations.ts     # defineMutation × n — every change is a named, typed act
    invariants.ts    # defineInvariant × n — rules that name their repairs
    policy.ts        # who may do what, if anyone
    brand.ts         # name, mark, typeface, palette
    app.ts           # defineApp({ ... }) — one object, the whole surface
  ui/
    views.tsx        # registerDefaultViews, then your own where you care
    app.tsx          # the provider, the scene, the workbench
  main.tsx
```

The domain/ui split is not tidiness. `graview check` and the docs generator
both consume `defineApp`, and the moment a React import reaches that file the
checker has to load a UI package to look at your schema. Keep it clean and the
whole declaration stays inspectable by a build, a CLI and an agent.

## Do this

1. **Install.**
   ```sh
   pnpm add @graview/core @graview/layout @graview/tools @graview/render \
            @graview/react @graview/primitives react react-dom zod
   ```
   Only reach for `@graview/render/gpu` if you want the experimental capture
   path; the main entry is pure geometry and the DOM path is what ships.

2. **Declare one kind, one mutation, one rule.** Do not model the whole domain
   first. The loop you want running on day one is: declare → `graview check` →
   look at it → declare more.

3. **Take the shell.** `Inspector`, `Standing`, `ActivityRail`, `BackOut`,
   `Trail`, `OverviewButton` and `Wordmark` from `@graview/primitives` are the
   parts of an interface that are not about your domain. A second app's shell
   came to about eighty lines; if yours is longer, you are probably rebuilding
   something derived.

4. **Register default views first, override later.** `registerDefaultViews`
   means a new kind renders sensibly at all three fidelities before you write
   anything. Write a custom view for a kind when the generic one is genuinely
   wrong, not on principle.

5. **Add the check to your build.** In `package.json`:
   ```json
   "scripts": {
     "check": "graview check ./dist/domain/app.js",
     "verify": "pnpm typecheck && pnpm test && pnpm build && pnpm check"
   }
   ```

## The CI a product on Graview needs

Copy the shape from the framework's own `.github/workflows/ci.yml`, minus the
packaging steps you do not need. What earns its place:

- **`tsc`** — an edge to an undeclared kind is a typecheck failure, so this
  catches a whole class before anything runs.
- **`graview check`** — everything `tsc` cannot see: a repair naming a mutation
  nobody registered, a lens role bound to a missing field, a role that may do
  nothing, a palette pair below AA. **Fail the build on errors.** Warnings are
  a judgement call; errors are not.
- **Headless tests** — the domain tier has no DOM in it. Test that your rules
  fire on graphs that break them and that their repairs resolve them; that is
  the test that catches a real regression.
- **An accessibility run, in BOTH schemes.** Copy
  `the household example/scripts/run-a11y.mjs`. It reads the real accessibility tree
  through CDP and runs axe-core. A light palette that clears AA in the dark is
  the failure this catches, and nothing else will.

Two things worth stealing later rather than at the start: a browser harness
that walks your own acceptance criteria and writes a JSON verdict (the
framework has five, and each names the claim that stopped being true rather
than a pass count), and a persistence adapter test if you are not using memory.

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

Report the real output. On a new app the useful early findings are
`mutation-untitled`, `mutation-undescribed` and
`required-invariant-unregistered` — all three are things that look fine until
somebody reads the interface or an agent reads a tool schema.

## What the check cannot see

- Whether your kinds are the right kinds. The test for each: does anything
  point AT it, and does it have a life of its own? A colour is a field. A
  fixture is a kind.
- Whether your mutations are the acts a person would name. They are the labels
  in the strip and the instructions in an agent's tool schema, so an opaque one
  costs twice.
- Whether the interface is any good. Run it.
