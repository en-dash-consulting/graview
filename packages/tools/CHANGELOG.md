# @graview/tools

## 0.0.2

### Patch Changes

- 491c7b6: A gap nobody is waiting on is not an observation. The insight provider announced an empty kind whenever any declaration had an edge into it — including the kind's own. A scaffolded project starts with exactly that shape, so its one empty district read "Nothing here yet, though Items expect to connect to these", naming the absent kind as the party waiting for it. Only other kinds count now.
- 38b0334: A line does not offer the act that would make it. Both ends of a selected relation prefill from the line itself, so a mutation that only connects that edge kind arrived with no question left and nothing to change — a one-press button that looked inert, and instead re-applied the mutation and wrote a second identical op into the history describing a change that never happened. A maker with a question still open, and a mutation that also severs the kind (a move), are both still offered.
- 5ba437c: A one-press act must be able to act. The actions strip counted only required arguments as open, so a derived edit whose every field is optional looked like a single press and, pressed with just its subject, refused on the button: "Nothing to change — give at least one of label a value." An action with nothing required left is now rehearsed with what it has, and one that would refuse asks for its optional arguments instead, each of which can be skipped; only what was actually said is applied.
- Updated dependencies [a5a867e]
- Updated dependencies [a10c8d0]
- Updated dependencies [60db3d0]
- Updated dependencies [6ecf8ec]
- Updated dependencies [3251440]
- Updated dependencies [1f232bb]
- Updated dependencies [4b96ddb]
- Updated dependencies [08befa1]
- Updated dependencies [99b4b27]
- Updated dependencies [ea93a35]
- Updated dependencies [ced759d]
- Updated dependencies [a5a867e]
- Updated dependencies [5410e86]
- Updated dependencies [5ef7e9b]
- Updated dependencies [992ac22]
  - @graview/core@0.0.2

## 0.0.1

### Patch Changes

- ec91236: A field you could set at creation, you can change. Every kind with
  settable fields no declared mutation writes gets a derived, titled edit
  act — `edit-<kind>`, "Change the drill" — registered by the store like
  any other: logged, undoable, judged by the invariants, and by the policy
  through the declared acts that already write or create the kind, so who
  may edit a drill is whoever may already retime or design one, with no
  second list. Opting out is `fixed` on `defineNode` — the field and the
  sentence saying why it never changes. Mutations can declare the fields
  they `write` (as `connects`/`severs` declare edges), and `editableFields`
  believes a declaration over the name-match guess: `finish`/`reopen`
  writing `done` stop being invisible, and a writer that takes no value is
  offered as its acts rather than a text box. `graview check` gains
  `field-without-writer` (a settable field the derived edit cannot reach,
  symmetric with `edge-without-severer`), `writes-unknown-field`,
  `fixed-unknown-field` and `fixed-but-written`; generated agent docs list
  the derived acts alongside the declared ones.
- 964d140: The DOM path is a citizen of every browser. The board no longer trusts
  `height: 100%` to transfer through `aspect-ratio` — Firefox and WebKit
  treated it as indefinite inside the panel's flex chain and collapsed the
  pitch to its border pixels, taking every slot's hit target with it; the
  width now comes from the same ResizeObserver measurement that decides when
  the board turns. The local-AI rung fails fast and says why when a browser
  has no WebGPU, and the chat header carries that reason instead of a shrug.
  The graview-new-app skill states the supported-browsers floor.
- 95cceb3: The menu scales. Past the fold a filter-as-you-type field appears in the
  inspector — it narrows the same derived list by label and why, Enter runs a
  sole survivor, Escape clears. `defineMutation` accepts `pinned: true` (the
  app naming its own act), a person can pin any offered action from the menu
  itself (kept per browser beside the intelligence config, outranking the
  app's), and a deterministic recency/frequency boost read off the op log
  ranks what a workspace actually uses ahead of what it never touches —
  decaying so the menu tracks the season. The bands stay inviolate: repairs
  first, destructive last; pins and usage only ever shuffle inside them.
- 87948ef: Code-review fixes. `edge-without-severer` is suppressed only when EVERY
  kind declaring the edge name says appendOnly — one kind's suppression no
  longer hides another's makeable-but-never-unmakeable relation. The usage
  boost stops counting acts the person took back: an op undone by a later op
  carries no weight (the old undo guard was dead code — undo ops have no
  mutation — while the retracted originals kept theirs). The action filter's
  Enter never runs a destructive sole survivor and shows it no ↵ promise;
  an empty-query Escape blurs the field so the product-wide back-out works
  on the next press. And the person's pins now reach the agent seats: a
  tool runtime's `derive` option can be a function, read fresh per call, so
  the strip, the pointer menu, the chat and the agent seat never disagree
  about the same acts.
- 0f9b0fd: Pins override in both directions, and the stars say whose they are. A
  person can now UNPIN an act the app's declaration pinned — the same star
  gesture demotes it for that browser and restores it — where before the
  star on a declared pin was a control that visibly did nothing. The
  person's pin draws in the accent, the app's in quiet body ink. And when
  the searcher is down to a sole survivor, the row says ↵ — the promise
  Enter makes, shown exactly when it holds.
- 4bd846b: The horizon, modules, selection-as-a-stop, the traditional face (@graview/pages), the intelligence seam, and the ship subpackage (persistence wiring, op-log-native migrations, export bundles, health).
- 77d1d4a: Permissions, brands and a publishable shape.
  
  - A `Principal` is an `Author` with roles, and a `Policy` of grants is enforced
    at the store — including on undo, which was a complete bypass.
  - A `Brand` declares name, logo, typography and both schemes, and
    `graview check` measures every text pair against WCAG AA.
  - `@graview/render` splits its WebGPU surface behind `@graview/render/gpu`, so
    the main entry no longer requires consumers to install `@webgpu/types`.
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
