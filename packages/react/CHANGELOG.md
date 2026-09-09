# @graview/react

## 0.0.1

### Patch Changes

- 37bb6af: The constellation says what it means: relations drawn at full strength from
  above the stack (where the lines are the content rather than an aside),
  receding when a kind is selected so its own relations stand out, and a derived
  `RelationKey` naming each edge kind with the exact stroke the scene draws.
- e38fe86: The generic full page is a document rather than a card stranded on a viewport:
  a real header, a centred column, a heading that is the whole thing rather than
  a truncated copy of the body, field names in words, and no value repeated
  because the heading already said it. The name is now the rename control.
- 80f859b: Fixes from a code review of the constellation work: a selection is resolved
  onto what is actually drawn before it is compared with a connector's endpoints
  (it blanked the whole Graview otherwise), clicking a kind card up there selects
  it, and the connector stroke treatment has one home so a legend cannot drift
  from the line it claims to show. `GraviewProvider` gains `initialSelection`.
  
  Also: a lens now gets the schema from the provider, so an optional field absent
  on one node is data rather than a binding error — one unplanned task used to
  throw for a whole view.
- 7cebca3: The inspector states a violation once: the message used to appear as an
  observation AND as the repairs' ⚠ heading, under a title that opened the
  same words — now the heading carries it (name-trimmed, since the title is
  right there) and the duplicate observation is dropped wherever the
  heading shows. Pinch is altitude: a trackpad pinch on the canvas rises to
  the Graview and descends from it, one discrete step per gesture, with the
  browser's page zoom kept out of it. The city reads better: an opened
  district is a proper panel (name and count on one line, roster under a
  hairline, the block fading behind), nameplates never wrap mid-word, the
  kind tag wears its kind's hue, the pinned mark hugs the drawn content
  rather than the layout box, and stand-in ties stay on the ground — from
  altitude the constellation already draws the district relations.
- 76792f1: The lines land. Selection ties used to aim centre-to-centre whatever the
  geometry: two drawings stacked in one column got a vertical straight
  THROUGH every row between them (whose 14px hit corridor then stole those
  rows' clicks), a tie between adjacent rows was silently dropped as too
  short, and the single-smallest-element anchor rule tied a 3.2-row dot to
  a 5.2-row label — or to a chip in the activity rail. Routing is now a
  pure, tested decision (`tieRoute`): stacked drawings stitch along their
  common right edge in the gutter, row-mates stitch over the top, and only
  clear air takes the direct arc. Anchors pick the CLOSEST pair among all
  of a node's drawings, chrome (inspector, activity rail, chat panel) is
  declared off-stage and never anchors a line, and a tie whose far end is
  only a stand-in — the kind's district, when nothing draws the node itself
  — recedes to a whisper and takes no pointer instead of crossing the scene
  at full strength five lines at a time.
- 23ab0fe: A relation between two members of the same kind is drawn as a loop in the
  Graview rather than dropped. The legend was counting `waits-for 3` while the
  picture drew nothing.
- a94d8f5: A mark says what it is about, chrome stops sitting on the scene, a full page
  is a place rather than a picture of one — and a pass over every screen.
  
  **The board.** It drew a slot and the person in it with the same warning tint,
  so a rule about the LEFT MIDFIELD position marked the midfielder standing in
  it — a picture asserting something untrue about a person. The disc now carries
  the slot's trouble and the name carries the occupant's, and a key names each
  mark with the violation message that put it there. Zone names moved out of the
  field into a rail beside it, because inside they were drawn at exactly the
  place a left back stands and read as "DEFENCELB".
  
  **The strip.** It floated over a scene laying itself out into the whole window,
  so selecting anything covered the row of kind cards; it now reports its
  measured height through `bottomInset` and the scene lays out into the space it
  actually has. It showed four actions out of fifteen behind "+11 more"; it now
  fills the row it has. It printed "Pay the deposit · task · \"Pay the deposit\"
  was due 2026-08-28" — the same four words twice in one line — and now trims the
  restatement while keeping the date.
  
  **Navigation.** The home crumb named the place you were standing in, so it was
  a dead control printed an inch above a panel whose own heading said the same
  words; it appears only once you have left home. Apps with a place switcher pass
  no home crumb at all, since the pressed pill already is one. Rising to the
  Graview moved in beside the other place controls instead of sitting at the far
  end of the bar among the buttons that do things.
  
  **The kinds plane.** Six kinds sharing a parent were fanned into six
  seventy-pixel slivers whose labels ran together and whose longest wrapped
  mid-word. At most two nest now; the rest keep their ranking and take their own
  slots. Siblings offset by 14% rather than 45%, so neither hides the other's
  label.
  
  **Legibility.** Connector captions may be wider than the run they caption and
  carry their own ground, so "attends a block, or rides along on a run" is no
  longer cut to "attends a block, or rides alo…" with a hairline through it.
  Coverage row labels and column headers are sized for the words apps actually
  write, and the header band is sized from the labels present rather than from
  the longest anyone might write. Chips, crumbs, editable values, legend rows,
  timeline moments and the dismiss control are all at least 24 pixels.
  
  **And a way to keep it that way.** `scripts/audit-ui.mjs` (`pnpm audit`) drives
  twenty screens across the four apps and measures what a photograph makes you
  squint at: cards drawn on top of each other, captions cut mid-word, controls
  under a fingertip, the same string twice, chrome covering the scene. A
  deliberate tuck states itself in the DOM (`data-graview-nested`) so a checker
  can tell it from a collision.
  
  **The capture path survives a pointer.** This was recorded for months as "a
  click crashes the renderer process", and that was a symptom. Bisected in
  Chromium 154: a plain hover over a captured view kills the process just as
  reliably, a click on the ground beside one does not, and selecting the same node
  from the keyboard does not either. What is fatal is the browser's own hit-test
  descending into a `layoutsubtree` canvas child. The hosts carry
  `pointer-events: none` on that path now, which costs nothing —
  `updateElementGeometry` does not redirect hit-testing in this build, so a DOM
  hit-test on a captured view was already returning where the element was laid out
  rather than where it was drawn, and `PointerRouter` was already supplying the
  right answer. `scripts/verify-capture.mjs` (`pnpm capture`) holds the claim in
  three parts: the pointer survives, a click still reaches the node it drew, and
  the keyboard still reaches the views.
  
  **An agent seat says what it would do, and goes quiet when there is nothing to
  do.** All four apps had the same forty lines of chrome around four different
  scripts, and the same three faults in every one: the button never said how much
  there was to do, it stayed live and silently did nothing once there was none,
  and a refusal from the store arrived as an unhandled rejection in the console.
  
  The coaching example's was worse than that and had never worked. It ran as a roleless
  agent against a policy that grants selection to the coach, so every press threw
  `Not permitted: select-player on a position — coach can`, changed nothing, and
  said so nowhere. A seat is an agent acting FOR the person sitting in it, so it
  now carries that principal's roles — which turns the bug into the demonstration
  the app was built to make: as a coach the button picks the team; switch to
  analyst and it is refused in the same breath the actions strip refuses it.
  
  The chrome moved into `AgentSeat` in the workbench, where the rest of the
  not-about-the-domain chrome already lives. An app supplies a count, the
  mutation it is really asking for, and the turn itself. `scripts/verify-seat.mjs`
  (`pnpm seat`) holds 17 criteria across the four seats: each states its count,
  each turn changes the graph, each goes quiet afterwards, none throws, and one
  policy narrows the seat as well as the strip.
  
  **The kinds plane became a plane of glyphs.** It took a fifth of the window to
  draw cards covering a tenth of it: 190 by 107 each, holding a name, a number,
  two clamped lines of prose and a row of dots. The comments admit where the dots
  came from — the card "was a name, a number and a great deal of empty
  rectangle", so something was invented to fill it. That is backwards. The
  description moved to the tooltip, the dots became a three-pixel proportion bar
  that says the same thing faster, and the band went from 19% of the height to
  11%. The focus got 84 pixels back.
  
  **The scene can be moved.** Pins have been in the model since the first commit
  — `ViewState.pins`, a round trip through the URL, `layout()` letting a pin beat
  the computed position — with no gesture attached to any of it. Dragging a card
  now sets one. Dragging the ground pans, which needed `ViewState.pan` to exist
  at all; it is view state rather than a camera held to one side, so it is in the
  address, it interpolates, and it comes back when someone opens the link. A move
  is an ADJUSTMENT of the stop you are on rather than a new one, so `useUrlSync`
  replaces instead of pushing and one drag is one history entry rather than
  sixty. The trail gains a "moved ×" crumb, and Escape takes it off before it
  takes anything else off. `scripts/verify-moving.mjs` (`pnpm moving`) holds ten
  criteria, including the one that matters most: a drag is not a click.
  
  Pointer capture is taken when the drag STARTS, not when the pointer goes down.
  Taken on pointer-down it redirects the compatibility mouse events too, so every
  click on an inner target was reported against the host instead — double-clicking
  a task opened its card rather than travelling into it, and `verify-navigation`
  went from 14 criteria to 2.
  
  **Selecting something no longer moves the picture.** Insetting the scene only
  while the strip was showing fixed the collision and bought a worse fault: every
  click reflowed the whole scene, so the thing you clicked slid out from under
  the pointer as its actions appeared. The room is reserved permanently and the
  strip appears inside it. A one- or two-row strip — nearly every selection —
  moves nothing at all; an unusually tall one still pushes rather than covers,
  because being tall is rare and being covered is never right.
  
  **A brand has a third axis, and the apps use all of them.** Palette and
  wordmark were not enough: with `brandFromAccent` deriving everything from one
  hex over a shared base, four apps looked like the same application four times
  in different colours. `Brand.shape` adds a corner radius and a density
  multiplier, emitted as `--graview-radius`, `--graview-pad` and `--graview-gap`,
  so a bid desk can be square and tight and a household planner round and roomy
  without a component knowing whose product it is. The display face now reaches a
  panel's title, which is the largest text on most screens — it had been reaching
  the wordmark and nothing else, because the stylesheet gives it to `h1`–`h4` and
  a panel title is a `strong`.
  
  Each app now declares a real typeface: Figtree for the checklist, Fraunces over
  a rounded sans for the household, a Plex face for the bid desk, a narrow grotesque for the club.
  Three of them had declared `ui-sans-serif` and `ui-serif`, which resolve to the
  same faces everywhere and so were no declaration at all.
  
  `verify-brand.mjs` asserted the literal string "Inter" — a test that passes for
  exactly one brand and fails the moment anyone rebrands, which is the opposite
  of the claim it exists to check. It asks the declaration now: whatever the
  brand put first in its stack is what the page must render in, the face must
  actually have loaded rather than fallen through the stack, the display face
  must reach the headings, and the shape must reach the pixels. Nine criteria,
  up from six.
  
  **Two bugs found by the survey while doing it.** A kind card's title and count
  had ended up inside the proportion bar's conditional, so a kind with no members
  rendered an empty card. And every shrink on the kinds plane is proportional —
  secondary at 0.74, tucked at 0.8 of that, tucked again by how many share a
  parent — so at a glyph-sized band the multiplications landed under the content
  and the cards clipped by four or five pixels. Proportion is right until it
  crosses the floor; there is a floor now.
- 4bd846b: The horizon, modules, selection-as-a-stop, the traditional face (@graview/pages), the intelligence seam, and the ship subpackage (persistence wiring, op-log-native migrations, export bundles, health).
- b156490: The garden is grown a chapter at a time, and photographed. The empty
  example carries seven chapters — one kind; a second kind and an edge; a
  rule as data with its repair; plantings and the horizon; a seat for an
  agent; the garden remembering; who may do what — each a real declaration
  with the seed it has earned and the stop worth a picture. `?chapter=N`
  opens any of them, `scripts/progression.mjs` renders every one in both
  schemes and records what it saw, and the docs and marketing page teach
  from those pictures rather than from prose that can drift.
  
  Taking the pictures found three things. From altitude with nothing
  focused, the Focus control did nothing in every app that opens from the
  city; it now descends into the selected district, or the first one
  declared. The altitude ring ran under the inspector's pane, so a district
  could be drawn where nobody could reach it; layout takes an `inset` and
  the scene reserves the left rail. And the empty example's custom plot view
  at full fidelity showed a large blank card where the generic view shows
  the fields and the caretaker; it now overrides only the summary.
- 77d1d4a: Permissions, brands and a publishable shape.
  
  - A `Principal` is an `Author` with roles, and a `Policy` of grants is enforced
    at the store — including on undo, which was a complete bypass.
  - A `Brand` declares name, logo, typography and both schemes, and
    `graview check` measures every text pair against WCAG AA.
  - `@graview/render` splits its WebGPU surface behind `@graview/render/gpu`, so
    the main entry no longer requires consumers to install `@webgpu/types`.
- 04eaefe: A declaration can now say how its fields read — hide an ordering key, label a
  field, format a stored value — and an edge can carry an `inverse` so it reads
  correctly from both ends. Booleans render as words. Chips ellipsise (the
  `text-overflow` never applied, being on a flex container). And `Backtrack`
  makes the browser's own back and forward visible, because an interface whose
  navigation is the browser's should not require knowing that.
- Updated dependencies [ec91236]
- Updated dependencies [37bb6af]
- Updated dependencies [e38fe86]
- Updated dependencies [964d140]
- Updated dependencies [80f859b]
- Updated dependencies [5cd68d6]
- Updated dependencies [95cceb3]
- Updated dependencies [094f3cc]
- Updated dependencies [090ab39]
- Updated dependencies [23ab0fe]
- Updated dependencies [a94d8f5]
- Updated dependencies [87948ef]
- Updated dependencies [0f9b0fd]
- Updated dependencies [4bd846b]
- Updated dependencies [cfdad5a]
- Updated dependencies [34c1600]
- Updated dependencies [b156490]
- Updated dependencies [329da2e]
- Updated dependencies [77d1d4a]
- Updated dependencies [04eaefe]
- Updated dependencies [f24ef6e]
  - @graview/core@0.0.1
  - @graview/tools@0.0.1
  - @graview/layout@0.0.1
  - @graview/render@0.0.1
