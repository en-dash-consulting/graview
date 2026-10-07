---
name: graview-new-app
description: Start a product on Graview in its own repository — the shape of the declaration, the shell that comes for free, and the CI that keeps it honest afterwards.
---

# Start a product on Graview

Graview ships as eleven packages. A product built on it lives in **its own
repository** and depends on them the way any other consumer does. This is the
setup that gets you from nothing to something that can tell you when you have
broken it.

## Start with the scaffolder

```sh
# from a framework checkout (the packages are not published yet):
pnpm install && pnpm build
pnpm graview create ../my-app --link . --name "My App" --kind thing
# once published, from anywhere:
npm create graview@latest my-app        # or: pnpm create graview my-app
```

Put the product BESIDE the framework, never inside its git tree; `--link`
names it relative to where you run the command. `--workspace` writes the
layout every real product ends up with (a root, the app under `app/`, the
harnesses beside it); `--merge` starts in a repository that already has a
README, naming collisions rather than writing over them.

It writes exactly the shape below — one kind with `creates`, `connects`,
`writes` and a `lifecycle`, one rule with its repair, the shell, the routed
face, a headless test, a CI workflow — installs it, and installs these skills
into it. Run its `verify`, then replace the first kind with the product's own.
The rest of this skill is what each part is for.

## The shape

```
src/
  domain/            # No React in here. This is what `graview check` reads.
    schema.ts        # defineNode × n, createSchema (z comes from @graview/core)
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

The domain/ui split keeps the declaration inspectable by a build, a CLI and
an agent: `graview check` reads `defineApp`, and a React import there would
drag a UI package into the checker.

## Do this

1. **Install.** The scaffold already did. Reach for `@graview/render/gpu`
   only if you want the experimental capture path; the DOM path is what ships.

2. **Declare one kind, one mutation, one rule.** Not the whole domain. The
   loop you want on day one is: declare → `graview check` → look → declare
   more.

3. **Open it empty before you believe in it.** `graview describe
   ./dist/domain/app.js` reads out what a blank installation meets; `<Begin>`
   is that as a surface, wired into the scaffolded home. See `graview-seed`.

4. **Declare the seams that make the interface smart.** These are one-line
   declarations on mutations and kinds, and every derived surface reads them:
   - `creates: ["<kind>"]` on every mutation that adds a kind — the chain
     `Begin` and `graview describe` read, and the empty card's own way in.
   - `connects: [...]` / `severs: [...]` naming the edge kinds a mutation
     makes or breaks — what makes drawn LINES selectable, offers the act from
     either end, and hides a severing act with nothing to sever.
   - `lifecycle: { field, retired }` on kinds whose members expire — counts
     say "+N past".
   - `subject: { kinds, arg }` on every mutation that acts on a thing.

5. **Take the shell.** `Inspector`, `Standing`, `ActivityRail`, `ChatPanel`,
   `QuickRelations`, `RelationKey`, `BackOut`, `Trail`, `OverviewButton` and
   `Wordmark` from `@graview/primitives` are the parts of an interface that
   are not about your domain — including a chat seat that answers from the
   graph with no API key. A shell is about eighty lines; if yours is longer,
   you are probably rebuilding something derived.

   Search comes with `Shell`: its `FindBox` answers `/` or ⌘K from
   anywhere, lights what the words find in whatever picture is open and
   dims the rest, and `#q=` makes a search a stop Back returns to. A shell
   of your own puts `<FindBox />` in its bar; nothing is declared per kind.

   The routed face is one branch in `main.tsx`: when the path starts with
   `/pages`, render `<PagesApp basename="/pages" context={{ store, brand,
   views: views(), settings }} />` from `@graview/pages`. It lands on a
   gallery of the app's pictures — every kind drawn as a card until you title
   a lens, then the lens by its name — with a list, a record and a form per
   kind, the problems and the map, at phone widths. Hand it the same `views`
   the scene draws from, or it has no pictures to land on.

6. **Register default views first, override later.** `registerDefaultViews`
   means a new kind renders sensibly at all three fidelities before you write
   anything. Write a custom view for a kind when the generic one is genuinely
   wrong, not on principle.

7. **Add the check to your build.** `"check": "graview check
   ./dist/domain/app.js"`, and a `verify` that runs typecheck, test, build
   and check in that order. The scaffold writes both.

## What to make yours next

The scaffold is deliberately the framework's own face. A product replaces it
in this order, and each step has a skill and a worked chapter in
`apps/seedbed` behind it:

1. **The words.** Every edge gets `description` and `inverse` — how it reads
   from each end — or `graview check` says `edge-without-inverse` and the
   far end is captioned with the edge kind's name. Every mutation gets a
   `title` and `description`; they are the button and the tool schema.
   (`graview-node-kind`.)
2. **A lens with a name.** A lens registered over a group with a `title` is
   a PLACE — in the bar, on an embed's strip, one press from anywhere. Start
   from the three that ship; write your own when the domain has a picture of
   itself, the way the garden has a map. (`graview-lens`, chapters 10-13.)
3. **The pages.** One page in the product's words first, then, when the
   product needs to look like a product, every surface: the shell, the home,
   the lists, the records, the problems — over the same store, acts, rules
   and permissions. (`graview-pages`, chapters 9 and 13.)
4. **A seat and a policy.** Who may do what, declared once; the strip, the
   pages and the agent's tools all narrow from it. (`graview-permissions`,
   `graview-agent-seat`, chapters 5 and 7.)
5. **A brand, and shipping.** The name, the mark, the typefaces, the palette
   the checker holds to AA; a version and a migration so a stored graph is
   carried forward. (`graview-brand`, `graview-ship`, chapters 8 and 12.)

Work with an agent beside the declaration: describe a kind, let it draft the
edges, acts and rule, run `pnpm verify`, look, declare more.

## The CI a product on Graview needs

Copy the shape from the framework's own `.github/workflows/ci.yml`, minus the
packaging steps you do not need. What earns its place:

- **`tsc`** — an edge to an undeclared kind is a typecheck failure, so this
  catches a whole class before anything runs.
- **`graview check`** — everything `tsc` cannot see: a repair naming a mutation
  nobody registered, a lens role bound to a missing field, a role that may do
  nothing, a palette pair below AA. **Fail the build on errors.** Warnings are
  a judgment call; errors are not.
- **Headless tests** — the domain tier has no DOM in it. Test that your rules
  fire on graphs that break them and that their repairs resolve them; that is
  the test that catches a real regression.
- **An accessibility run, in BOTH schemes.** Copy
  `apps/todo/scripts/run-a11y.mjs`: the real accessibility tree through CDP,
  plus axe-core. A light palette that clears AA in the dark is what it catches.

Worth stealing later: a browser harness that walks your own acceptance
criteria and writes a JSON verdict (the framework has several; each names
the claim that stopped being true), and a persistence adapter test.

## Supported browsers

Build for the DOM path: Chromium, WebKit and Firefox, all three verified by
the framework (`pnpm engines`). The floor is `document.adoptedStyleSheets`
(Safari 16.4+, Firefox 101+, Chromium 99+). The altitude morph rides
`@property` and degrades to a clean cut where that is missing — write no
fallback. The chat's local-model rung needs WebGPU or Chrome's Prompt API;
without either the graph still answers and the header says why. The GPU
capture path is Chromium-only, experimental and opt-in (`attachRenderer`
from `@graview/render/gpu`; there is no URL switch) — never a requirement.

## Then find out whether it worked

```sh
pnpm verify        # typecheck, tests, build, graview check
```

Report the real output. On a new app the useful early findings are
`mutation-untitled`, `mutation-undescribed`, `edge-without-inverse` and
`required-invariant-unregistered` — things that look fine until somebody
reads the interface or an agent reads a tool schema.

## What the check cannot see

- Whether your kinds are the right kinds. The test for each: does anything
  point AT it, and does it have a life of its own? A color is a field. A
  fixture is a kind.
- Whether your mutations are the acts a person would name. They are the labels
  in the strip and the instructions in an agent's tool schema, so an opaque one
  costs twice.
- Whether the interface is any good. Run it. Run it at the size it will have: seed a
  real catalog, not a dozen rows. The scene draws what a person can read — a
  relation too long for its band is grouped by its best arrangement or closes
  on "+N more", and a district says its places by name — so a
  thousand records are a picture, not a smear. What that hides is yours to
  judge: whether the groups are the ones a person would ask for.
