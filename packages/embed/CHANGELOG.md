# @graview/embed

## 0.1.1

### Patch Changes

- Updated dependencies [bf36bbe]
- Updated dependencies [ed02370]
- Updated dependencies [e0c8cac]
- Updated dependencies [e1b9f5c]
- Updated dependencies [cbdd94a]
- Updated dependencies [59d5dd3]
- Updated dependencies [097d684]
- Updated dependencies [e88f729]
- Updated dependencies [866d437]
- Updated dependencies [a1859c5]
- Updated dependencies [1df48c8]
- Updated dependencies [ccfe1cd]
- Updated dependencies [c307981]
- Updated dependencies [fa8bd61]
- Updated dependencies [32ea5ac]
- Updated dependencies [d76a957]
- Updated dependencies [b1eae03]
- Updated dependencies [c222b58]
- Updated dependencies [deb98ca]
- Updated dependencies [b535cb2]
- Updated dependencies [6b297f0]
- Updated dependencies [414ddde]
- Updated dependencies [a575ca9]
- Updated dependencies [3c0d822]
- Updated dependencies [f1cf758]
- Updated dependencies [b9cdc16]
- Updated dependencies [dcffc91]
- Updated dependencies [313eea3]
- Updated dependencies [6966a4e]
- Updated dependencies [0b78acc]
  - @graview/react@0.1.1
  - @graview/primitives@0.1.1
  - @graview/core@0.1.1
  - @graview/pages@0.1.1
  - @graview/studio@0.1.1
  - @graview/tools@0.1.1
  - @graview/layout@0.1.1

## 0.1.0

### Minor Changes

- b5e95a1: The first public release, 0.1.0, under the Elastic License 2.0.
  
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

### Patch Changes

- ad8549a: A Graview in somebody else's page. `@graview/embed` mounts a declared app
  into any element — `mount(el, { app, seed, face, stop, principal })` and an
  `Embed` component — with the scene, the Graview or the routed pages as its
  face, a switcher and Standing above the picture, and nothing of the Shell.
  The store lives in memory and starts from the seed; the routed face runs on
  a memory router so the host's address is never touched; the brand's fonts
  are fetched by the embed.
  
  What the framework had to grow for that, and grew: `themeCss` takes a
  `scope`, so the theme lands on the element rather than on `:root` and
  `html, body`; the panes size against the picture's own box (`cqh`) rather
  than the viewport, and the Shell's scene region is that container, so a
  pane never reaches past the picture it belongs to, on a page or in an
  embed the size of a paragraph.
- e0d5026: A kit for the picture. Everything the scene draws that is not a view — the lines, their captions, the ground's grid and lattice, the kind tags, how far the unlit recedes, the mark a broken rule leaves — is declared on `brand.kit`, any part of it, the rest as shipped. A connector's route is a named strategy (`curve`, `straight`, `orthogonal`) and its stroke a named pattern; each is one case in one file, so the next is one more case and nothing in the scene moves. Colour and visibility are per edge kind under `connectors.byEdge` or for all under `connectors.all`; a kind kept quiet is not drawn and stays selectable from the inspector. `themeCss` emits the kit as `--graview-kit-*` custom properties that the ground and the tags read. `graview check` holds an explicit line colour to 3:1 against both grounds in both schemes (`kit-contrast-below-aa`, `kit-colour-unreadable`). An embed's handle gains `setBrand`, so a page can re-dress a running Graview.
- fc024d0: A lens chooses its shape by the room it has, and a narrow embed keeps its room for the picture.
  
  The coverage matrix's 316px label column put every column past the edge of a phone-width card, behind a sideways scroll nothing announced — names and no cells. The names now take a share of the width, and where the columns still would not fit at a fingertip each the matrix stacks: each row is its name and then its cells as labelled marks that wrap. Seven day columns in a 300px box were 40px cells with three letters in them; below about 44px a column a run of days is drawn as the agenda, and coarser cells wrap into as many columns as the width holds. The calendar's six range chips become one select when the card is narrow.
  
  The scene kept a fifth of a 360px embed clear for rails it does not draw there, and the layout took six gaps more off a focused card: a lens got 145 pixels. Below a phone's width the rails are gone and the focus margin is capped at a tenth of the span. The embed's strip, whose place and seat pills wrapped to five rows, shows the places and the seats as one select each when it is narrow.
  
  And the example's season and rotation calendars, declared on the chapters and never handed to the views, are drawn on the pages that explain them.
- e165c5b: A titled group view is a place. `register(kind, cell, view, { title })` names it; `views.places()` lists the names; the shell's bar and the embed strip show them as pills, pressed while you are there, so a lens is somewhere to go by name rather than a picture that vanished when you clicked into a member. And the list page withholds a creating act the seat may not take — struck through, with the policy's own reason — instead of offering a form that refuses on submit.
- 923bbfa: A profile on the bar. `<Profile>` is the one place that answers "who am I signed in as" and holds what belongs to the reader rather than to the installation: their own record (where an installation is declared), the seat switcher, the settings, and the scheme. Settings are declared — `app.settings`, drawn by the pane, honoured by the provider, and checked: `graview check` refuses a setting nothing can apply, one with nothing to choose between, one that opens on an answer it does not offer, two that share a name, and a root font size that is not a length. `readerSettings()` is the two every app should offer (text size and motion); `applySettings` carries them at the edge so an app's two faces agree.
  
  Two bugs surfaced underneath. The theme set `font: 0.875rem` on `html, body` — so the ROOT's own size became 0.875 of the browser's, every `rem` in the framework resolved against 14px instead of 16, and the one place a text-size setting can live was already occupied. The body is sized now; the root is left exactly as the reader has it, and "As your browser has it" stamps nothing rather than guessing. And `usePickTargets` stamped `role="button"` on every pick target including landmark elements, which ARIA forbids — three `<header role="button">` on the first screen of the demo, unnoticed because nothing had run axe over the scene. The role is now stamped only where it is legal; a target that cannot take it still gets `tabindex`. Motion is overridable by the reader: the stylesheet's reduced-motion rules are emitted once for the system's preference and once for `data-graview-motion="reduce"`, scoped so an embed honours a host's answer without restyling the host.
- e695209: A project can mount itself. `EmbedOptions.views` was typed as the erased return of `registerDefaultViews`, so passing the registry an app wrote for its own declaration — the only thing the option is for — was a type error; it is typed to the app's schema now. And a scaffolded project gains `@graview/embed` as a dependency, its dev alias, and an `embed.html` + `src/embed.tsx` to put one in, so the last rung of the pages skill is something a new project can actually climb.
- cb3fd21: `<Embed>` keeps the store it made when another seat sits down. Handed no store of its own, it built one from the declaration and the seed, and rebuilt it whenever the principal changed — the principal was in the memo's dependencies, and was handed to a `Store` that takes no such option — so a React host that changed seats lost every edit and the history with them. Who is at the keyboard is the provider's business; the store stays.
- 2cc27e9: Another seat's work is named by the seat's name. `nameOfAuthor(author, { graph, schema, seats })` reads the user node, else the seat the principal was offered under, else the id; the activity rail, the profile, and the routed face's history use it, and `PageContext` carries `seats` (the embed hands its own over). An app with seats and no installation read "user-lena" and "U user-june".
- 1272c12: An embed can offer seats. `seats: [{ label, principal }]` puts them on the strip, pressed while at the keyboard, and `handle.setSeat(principal)` changes who sits without touching the store or its history. The strip, the pages and the acts all narrow to the seat, so a policy is something a reader feels rather than reads about: sit down as the gardener and what only the coordinator may do is struck through.
- e809183: An embed's stop may name a place. `#view=the-season` is the link a page can write — `placeHref` spells it — and the scene's URL sync has resolved it to the group the place is a picture of since it existed; the embed read its `stop` through `fromUrl` alone, so a host page saying `data-stop="#view=the-season"` landed at the default view with the place's pill unpressed. The embed resolves it now, on mount and when the stop changes through the handle.
  
  A board in a room with no height of its own is sized by its width. The board lens drove its size from the measured height of the room it stood in, which a scene band and a page region have; in a chapter embed on the docs site the panel sits in a column as tall as its content, so the room measured four pixels, the board came out six by four, and every slot on it was a four-pixel target. Below a height a board could be read at, it takes the room's width and lets its aspect give the height, which is what a board in a document is.
  
  The embed has a fourth face, `picture`: one named lens and nothing else — the place the stop names, drawn at full size over the kind's current members, with no bar, no rail and no standing. A page that is about a lens shows the lens, not an app with the lens somewhere inside it; three of those stacked on the docs site's lenses section were three windows with a calendar somewhere in each. `PlacePicture` in `@graview/pages` is the component behind it, for an app's own page that wants the same.
  
  The calendar's day grid and agenda list are keyboard stops. Given less height than their rows they scroll inside themselves, and a region that scrolls with no focusable element in it is one a keyboard cannot scroll at all; each carries the span's own name.
- 9b3a623: An embed is a region with a name. `label` named every landmark inside an embed and left its root a plain div, so on a host page the strip, the seats and the picture sat outside any landmark: a reader moving by landmark could not reach the app, and two embeds were indistinguishable at the top. The root is a `<section>` named by `label` now — or by the app's own name when the page does not say — and the scaffolded host page has the `<main>` the embed deliberately does not bring.
- a6f64b0: Every size the framework draws is the reader's to change, and a test says so.
  
  The text-size setting works by one number on the root element, which is why every size here is written in `rem` or `em`. A single `font-size: 10px` opts one control out of it entirely — and four of them had. Set to Largest, every name in the city doubled while the district's own "open" control stayed ten pixels tall, along with the "+N past" tag, the altitude caption and every `<code>` span. The profile's mark was an 18-pixel circle around a letter that had doubled, and the name beside it was clipped to "Nobody in p…" by a 220-pixel cap.
  
  All of it is measured now rather than asserted: a probe loads the app at the browser's own size and at Largest and diffs every box. What came back was fifteen boxes that never moved while the text doubled. The framework's are fixed — four stylesheet rules, the profile's mark and name width, and five sizes in an embed's own chrome — and a new test walks the source of every package a person installs and fails on a font size written in pixels, in either spelling. A list in a commit message is not a guard.
  
  The demos had the same bug in bulk and are converted too: the garden's own product design (28 sizes), the launcher, and Things' views. `apps/promo` keeps its pixels on purpose — a 1920×1080 video composition has no reader and no setting.
  
  A district's drawing now keeps up with its name. The drawing is sized as a fraction of its card, the card is laid out in pixels off the stage, and the nameplate is sized in `rem` — so at Largest a doubled name stood over a drawing that had not moved at all, a postage stamp under a headline. It has a floor in `em` now, capped at the card: a first cut without the cap overflowed and the drawings were sliced off at the bottom edge, a plot reading as a V rather than a bed.
  
  **What still does not scale, named rather than hidden:** the scene's card geometry. `graview-kind-card` is 230×97 at every text size, because the layout sizes cards as fractions of the stage in pixels while their text is in `rem`. Making the city itself grow with the reader means fewer districts fitting on the ring, which is a layout change with its own design decisions — worth doing, not worth pretending is done.
- c3c93ce: An embed does not say a landmark's name twice. It prefixes every landmark inside it with its own label, and a picture whose panel bore the same name — "The pipeline", in an embed labelled "The pipeline" — became a region called "The pipeline · The pipeline". A region of the embed's own name is the embed's region, so it is named once and becomes a group rather than a second region of that name.
- 7188978: The chapters on the page that explains Graview are the app itself: each of
  the twelve is mounted live by `@graview/embed`, from the same declaration
  and seed its photograph was taken from, with the scene, the Graview and the
  routed pages a click apart, and the site harness judges the page with all
  twelve on it.
  
  Putting twelve Graviews in boxes the size of a paragraph found what a window
  had hidden. The ring's nearest district ran past the bottom of a short
  canvas; rails reserved in pixels took a third of a narrow one; several
  embeds on one page carried identical landmarks, and a face written to own
  the document put a `main` inside the page's; the coverage grid's columns
  crushed to nothing in a narrow box; a link on the routed face was a line of
  text and not a target. So: the ring is only as tall as leaves that card
  whole; the rails are in proportion; an embed names its landmarks after
  itself and a page is a `main` only when it owns the document (`PageMain`,
  `context.embedded`); a coverage column is a fingertip wide at the least;
  and a page link is tall enough to press.
  
  Using the live chapters found four more, all fixed where they live: the
  inspector pane was fixed to the window and so opened at the page's edge
  over the host's navigation — it is positioned within the scene's own box
  now, and the pointer menu is clamped to it; a focused card in a box the
  height of a paragraph was cut across its own facts — a short canvas gives
  the focus more of itself; a line at altitude ran to a district even when
  the district was opened and drawing the very member the line is about — it
  lands on the member; and the dashed marks for a pinned or considered card
  were drawn around the whole natural box and the kind tag rather than the
  drawing. The embed's strip shows two faces, the picture and the pages,
  since altitude is the scene's own control.
  
  From altitude a focused GROUP shown by the framework's own list is its
  district, opened — the scaled list in the middle and the same names in the
  district were one thing drawn twice, and a reader said so. A group with a
  view of its own (a week, a board) keeps its scaled card, and then its
  district stays shut. The framework's own group views carry a mark
  (`markDefaultView`, `isDefaultView`) so a scene can tell. And a line's hit
  stroke now keeps out of the cards an end is drawn inside, so a line to Ravi
  never takes the click meant for June above him.
- e0d5026: The installation is in the graph. `declareInstallation({ roles, admin })` gives an app a user kind and an invitation kind, the acts on them — invite, welcome, revoke the invitation, remove, grant, revoke — as ordinary mutations the policy judges, a module drawn only for those who administer it, and a `self: true` grant so a person's derived edit is theirs on their own record and nobody else's. A module may declare `visibility: "admin"`; the store answers `mayAdminister` and `kindsKeptFrom` from the policy; the provider keeps such kinds out of the picture for a seat that may not see them and until the stop says `show=<module>`; the bar and the embed strip offer "Show the installation" to the seat that may; the pages list an administered module's kinds only for that seat. `reachLens` draws what each role reaches from the same `permits` the store refuses with. The checker counts derived acts and self grants when it asks whether a role may do anything.
- b7d3209: The keyboard always lands somewhere. When an act removes, disables or hides the control the keyboard was on — Escape closing a menu, a chip's × dropping the selection, Back taking the page away, "Send" while the answer comes — it lands on the nearest thing that still stands where it was, or on the same control when a re-render drew it again (`useTheKeyboardLandsSomewhere`, installed by `Shell` and `<Embed>`). The studio hands the keyboard back to whatever opened it when it closes, and a routed page that replaces another lands it on the new page's heading. Eight walk findings were this one rule broken on eight surfaces; the browser harnesses' watch found it on about forty more.
- daccd55: The studio is a place on the bar. `<StudioPlace app={...} />` opens the running app's own declaration — kinds, fields, edges, acts, rules, roles and grants as districts, "What the checker says" as a place, the ordinary acts to change them, the studio's own history and undo, and an agent seat that proposes a repair for a rule that names none. Applying runs `graview check`, refuses on errors naming them, and otherwise offers the files `graview create` writes as downloads. Offered to the seat that administers where an app declares something administered, and to whoever is here where it does not — so a scaffolded project has it on day one. `Shell` takes it as a slot (the studio already depends on the shell's primitives); the embed strip takes it boxed, so a studio cannot escape onto somebody else's page.
  
  `ArgShape` gains `{ type: "boolean" }`. Without it "Add a field", whose `required` is a plain boolean, was derived NOWHERE — the studio's central act, in the studio, unreachable because nothing could ask one question. The strip asks it as two buttons rather than a text field somebody has to know to type "true" into.
  
  And what the studio does not model, it no longer destroys: a kind's `display.labels`, `display.hide`, `fixed` and `fieldRoles` are carried from the checkout through both the declaration and the written schema, narrowed to the fields that still exist. A `display.format` is a function and cannot be written; the file says so where it finds one, and `WrittenFile.kept` names it, instead of losing it silently.
- e7151d4: The type scale goes up a step. The framework's own text ran from 9px to 12.5px at a 16px root — a scale built around a 12.5px body, which a person reading a product for an hour called small, and which was small. Body text is 14px now, small text 13, marks and captions 12, the smallest label 11, and headings a notch up with them. The cards the layout sizes in the reader's own unit follow: a district's floor is 148px rather than 132 so "COMPONENTS" in 14px capitals holds one line, the districts' row is a little taller, and a focused card may take 1200px of a wide screen rather than 1040. The companion and the quick relations keep to the rail's share of a narrow scene rather than standing over the picture at 1000px.
- 55c4151: The compiler says when code is unused (`noUnusedLocals`, `noUnusedParameters`), and what it found is gone. `Occupants` draws the others and nothing else: its props are `width` and `whereIs`, the walking seat's pad, reach and pointer plumbing removed. `SceneProps`, `ResolvedViewProps` and `DoorProps` lose a type parameter nothing read, and `placeOthers` a `height` it never used. One `violationKey`, exported from `@graview/core` (no longer from `@graview/react`); one zod `unwrap` in core; the structure and invariant providers name a node the way its kind does, through core's `labelOf`, rather than by its `label` field alone.
- 6e8a02c: What the page taught the framework, folded back in. A board slot holds several occupants, each name its own target, and the bench lists only what is in no slot. The coverage lens reads its rows and columns from the graph, as the board already did, so no app wraps it to hand over the other kind. A titled registration names the picture. `focus=agg:plot` is a stop's short form for `aggregate:plot`. An embed infers its face from its stop and its scheme from the host page, and `mountWhenNear` mounts many embeds as a reader comes near them. The scaffold's views file says how a lens becomes a place.
- 59cef8c: Who is where. Other people stand on your map at the plot their stop focuses, in the audience row of the showing they are watching, with their robots beside them captioned as theirs and the thing they point at outlined in their hue — placed by each viewer's own `whereIs` from a presence payload that is never a pixel and never enters the op log. `PresenceChannel` has two implementations in ship: a BroadcastChannel between tabs of one origin, beside the browser adapter, and two routes on the served store folded into the poll the remote store already makes. A per-tab session fills `Author.session` on a tab's ops and its presence key alike. Clicking a figure follows that person until you move yourself or press Escape; sharing is a reader setting in the profile pane; an embed broadcasts nothing unless handed a channel. `openRemote` now carries `applyAll` and `undo` to the wire.
- Updated dependencies [23d05c6]
- Updated dependencies [fb781c2]
- Updated dependencies [e8d10b1]
- Updated dependencies [dfba092]
- Updated dependencies [dd65d38]
- Updated dependencies [390028c]
- Updated dependencies [bff0b71]
- Updated dependencies [400a6df]
- Updated dependencies [f4dbcc8]
- Updated dependencies [5d634ca]
- Updated dependencies [8031925]
- Updated dependencies [eacd252]
- Updated dependencies [c7a3519]
- Updated dependencies [2aae30f]
- Updated dependencies [60b3e2b]
- Updated dependencies [73690fb]
- Updated dependencies [862fd42]
- Updated dependencies [475cc83]
- Updated dependencies [f11e51b]
- Updated dependencies [7546a38]
- Updated dependencies [09a23a3]
- Updated dependencies [78e568e]
- Updated dependencies [7246f46]
- Updated dependencies [92a2f73]
- Updated dependencies [dfbba3f]
- Updated dependencies [8bdbe72]
- Updated dependencies [509162f]
- Updated dependencies [8c14e4c]
- Updated dependencies [3f86b09]
- Updated dependencies [ad8549a]
- Updated dependencies [9f6593b]
- Updated dependencies [188bc6e]
- Updated dependencies [1ebfd44]
- Updated dependencies [a23e496]
- Updated dependencies [e0d5026]
- Updated dependencies [4ab1b6d]
- Updated dependencies [fc024d0]
- Updated dependencies [41abe03]
- Updated dependencies [e165c5b]
- Updated dependencies [b83e46f]
- Updated dependencies [f7c6c19]
- Updated dependencies [04bfcc3]
- Updated dependencies [6a043bf]
- Updated dependencies [406b774]
- Updated dependencies [a012583]
- Updated dependencies [e119b49]
- Updated dependencies [45c4b9c]
- Updated dependencies [14e22ab]
- Updated dependencies [4aa0f93]
- Updated dependencies [da81e1e]
- Updated dependencies [b7f83cc]
- Updated dependencies [1373dfb]
- Updated dependencies [5b5e5a3]
- Updated dependencies [aa90b02]
- Updated dependencies [c3879ba]
- Updated dependencies [fb5b3ad]
- Updated dependencies [cc3ddbc]
- Updated dependencies [923bbfa]
- Updated dependencies [e695209]
- Updated dependencies [ccc912a]
- Updated dependencies [7c0e701]
- Updated dependencies [73e3b86]
- Updated dependencies [190c4a8]
- Updated dependencies [e59fa1f]
- Updated dependencies [63ba472]
- Updated dependencies [69aed60]
- Updated dependencies [d042ff2]
- Updated dependencies [fadebb9]
- Updated dependencies [f801b4d]
- Updated dependencies [8e872b5]
- Updated dependencies [708871a]
- Updated dependencies [c5e4ac7]
- Updated dependencies [42c2c96]
- Updated dependencies [9a3fe4b]
- Updated dependencies [c3033f4]
- Updated dependencies [2cc27e9]
- Updated dependencies [b90b6c7]
- Updated dependencies [a5d4967]
- Updated dependencies [97067b6]
- Updated dependencies [490eccd]
- Updated dependencies [e809183]
- Updated dependencies [8041853]
- Updated dependencies [83a40ed]
- Updated dependencies [4c4d52a]
- Updated dependencies [b9b0635]
- Updated dependencies [60efe3b]
- Updated dependencies [40f39ff]
- Updated dependencies [5e6d4e7]
- Updated dependencies [03b9c5a]
- Updated dependencies [5297528]
- Updated dependencies [ce13ec8]
- Updated dependencies [ff7de41]
- Updated dependencies [959955f]
- Updated dependencies [71de067]
- Updated dependencies [22e0668]
- Updated dependencies [9b3a623]
- Updated dependencies [b5e43ab]
- Updated dependencies [5a00a1f]
- Updated dependencies [d59b6c8]
- Updated dependencies [6af312b]
- Updated dependencies [887d768]
- Updated dependencies [455ef3e]
- Updated dependencies [de75e21]
- Updated dependencies [2c25067]
- Updated dependencies [b3ed5f6]
- Updated dependencies [73b30dc]
- Updated dependencies [e9f07b3]
- Updated dependencies [d36e6fa]
- Updated dependencies [7244498]
- Updated dependencies [b1fbc32]
- Updated dependencies [b79ef9a]
- Updated dependencies [05aaa72]
- Updated dependencies [f4dbcc8]
- Updated dependencies [796bf9e]
- Updated dependencies [a6f64b0]
- Updated dependencies [d907771]
- Updated dependencies [0bb6827]
- Updated dependencies [b5e95a1]
- Updated dependencies [894f0f1]
- Updated dependencies [130e9c6]
- Updated dependencies [c9c34de]
- Updated dependencies [3f5d3ba]
- Updated dependencies [2dd2f0e]
- Updated dependencies [1e773a5]
- Updated dependencies [7a61e87]
- Updated dependencies [1794980]
- Updated dependencies [171075a]
- Updated dependencies [4450ee4]
- Updated dependencies [9bad891]
- Updated dependencies [3e3bfff]
- Updated dependencies [a5d842b]
- Updated dependencies [0c465b9]
- Updated dependencies [2b2df36]
- Updated dependencies [a9381af]
- Updated dependencies [d9bfdb8]
- Updated dependencies [8976510]
- Updated dependencies [d5227b5]
- Updated dependencies [0c320d9]
- Updated dependencies [30adc63]
- Updated dependencies [3815bcf]
- Updated dependencies [0c0fa22]
- Updated dependencies [8a2fdf2]
- Updated dependencies [73690fb]
- Updated dependencies [fb6eb5d]
- Updated dependencies [216ba97]
- Updated dependencies [5343a1d]
- Updated dependencies [45c7a2c]
- Updated dependencies [6dd2cfd]
- Updated dependencies [45c7a2c]
- Updated dependencies [ddf1ea9]
- Updated dependencies [6e0fbb7]
- Updated dependencies [b846b32]
- Updated dependencies [d3e1201]
- Updated dependencies [3376126]
- Updated dependencies [7188978]
- Updated dependencies [5572c41]
- Updated dependencies [e3a7de6]
- Updated dependencies [3af8da7]
- Updated dependencies [5aa8776]
- Updated dependencies [76e50a5]
- Updated dependencies [481340c]
- Updated dependencies [3e719c8]
- Updated dependencies [206670e]
- Updated dependencies [f80138a]
- Updated dependencies [ada0f00]
- Updated dependencies [e0d5026]
- Updated dependencies [59c1fdb]
- Updated dependencies [71fd426]
- Updated dependencies [2c20c53]
- Updated dependencies [4472467]
- Updated dependencies [8d43e33]
- Updated dependencies [7783759]
- Updated dependencies [89f4855]
- Updated dependencies [f240a12]
- Updated dependencies [859c128]
- Updated dependencies [53ad439]
- Updated dependencies [e0d5026]
- Updated dependencies [494c1a1]
- Updated dependencies [0ea3f62]
- Updated dependencies [b7d3209]
- Updated dependencies [bd1f27b]
- Updated dependencies [90a3344]
- Updated dependencies [6dd2cfd]
- Updated dependencies [aeb1693]
- Updated dependencies [6a043bf]
- Updated dependencies [0a3504a]
- Updated dependencies [b7fa5e3]
- Updated dependencies [1d121a7]
- Updated dependencies [9ff994c]
- Updated dependencies [4c66166]
- Updated dependencies [61d76a0]
- Updated dependencies [8894627]
- Updated dependencies [e30d22f]
- Updated dependencies [fc7103b]
- Updated dependencies [9767a5e]
- Updated dependencies [8dbae9a]
- Updated dependencies [591a15a]
- Updated dependencies [7840cd5]
- Updated dependencies [e9e495f]
- Updated dependencies [636a00d]
- Updated dependencies [0a6a3fe]
- Updated dependencies [a0ffc2f]
- Updated dependencies [7be1ad2]
- Updated dependencies [d22655e]
- Updated dependencies [0d1fd39]
- Updated dependencies [60e4bf5]
- Updated dependencies [a38a5af]
- Updated dependencies [098c784]
- Updated dependencies [ae188cc]
- Updated dependencies [851feb6]
- Updated dependencies [6dd2cfd]
- Updated dependencies [43cf40d]
- Updated dependencies [315ce3b]
- Updated dependencies [d9bfdb8]
- Updated dependencies [f8f0e29]
- Updated dependencies [3506c69]
- Updated dependencies [8ca3d2e]
- Updated dependencies [daccd55]
- Updated dependencies [dfb6120]
- Updated dependencies [e5e43e8]
- Updated dependencies [6520856]
- Updated dependencies [be9fb19]
- Updated dependencies [e7151d4]
- Updated dependencies [ce13ec8]
- Updated dependencies [e7735c1]
- Updated dependencies [1eedcff]
- Updated dependencies [ccaa5f4]
- Updated dependencies [49d4458]
- Updated dependencies [bd1f27b]
- Updated dependencies [95196d7]
- Updated dependencies [1636ddc]
- Updated dependencies [55c4151]
- Updated dependencies [5856676]
- Updated dependencies [6e8a02c]
- Updated dependencies [3cb6d60]
- Updated dependencies [cb196b1]
- Updated dependencies [5b401bb]
- Updated dependencies [cf193fc]
- Updated dependencies [228039c]
- Updated dependencies [968e1d1]
- Updated dependencies [59cef8c]
  - @graview/primitives@0.1.0
  - @graview/core@0.1.0
  - @graview/layout@0.1.0
  - @graview/react@0.1.0
  - @graview/pages@0.1.0
  - @graview/tools@0.1.0
  - @graview/studio@0.1.0
