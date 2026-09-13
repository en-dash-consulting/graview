# @graview/embed

## 0.0.2

### Patch Changes

- 7b58faf: A Graview in somebody else's page. `@graview/embed` mounts a declared app
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
- a5a867e: A kit for the picture. Everything the scene draws that is not a view — the lines, their captions, the ground's grid and lattice, the kind tags, how far the unlit recedes, the mark a broken rule leaves — is declared on `brand.kit`, any part of it, the rest as shipped. A connector's route is a named strategy (`curve`, `straight`, `orthogonal`) and its stroke a named pattern; each is one case in one file, so the next is one more case and nothing in the scene moves. Colour and visibility are per edge kind under `connectors.byEdge` or for all under `connectors.all`; a kind kept quiet is not drawn and stays selectable from the inspector. `themeCss` emits the kit as `--graview-kit-*` custom properties that the ground and the tags read. `graview check` holds an explicit line colour to 3:1 against both grounds in both schemes (`kit-contrast-below-aa`, `kit-colour-unreadable`). An embed's handle gains `setBrand`, so a page can re-dress a running Graview.
- a10c8d0: A titled group view is a place. `register(kind, cell, view, { title })` names it; `views.places()` lists the names; the shell's bar and the embed strip show them as pills, pressed while you are there, so a lens is somewhere to go by name rather than a picture that vanished when you clicked into a member. And the list page withholds a creating act the seat may not take — struck through, with the policy's own reason — instead of offering a form that refuses on submit.
- 60db3d0: A project can mount itself. `EmbedOptions.views` was typed as the erased return of `registerDefaultViews`, so passing the registry an app wrote for its own declaration — the only thing the option is for — was a type error; it is typed to the app's schema now. And a scaffolded project gains `@graview/embed` as a dependency, its dev alias, and an `embed.html` + `src/embed.tsx` to put one in, so the last rung of the pages skill is something a new project can actually climb.
- beb2665: An embed can offer seats. `seats: [{ label, principal }]` puts them on the strip, pressed while at the keyboard, and `handle.setSeat(principal)` changes who sits without touching the store or its history. The strip, the pages and the acts all narrow to the seat, so a policy is something a reader feels rather than reads about: sit down as the gardener and what only the coordinator may do is struck through.
- 99b4b27: An embed is a region with a name. `label` named every landmark inside an embed and left its root a plain div, so on a host page the strip, the seats and the picture sat outside any landmark: a reader moving by landmark could not reach the app, and two embeds were indistinguishable at the top. The root is a `<section>` named by `label` now — or by the app's own name when the page does not say — and the scaffolded host page has the `<main>` the embed deliberately does not bring.
- 5123cf3: The chapters on the page that explains Graview are the app itself: each of
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
- a5a867e: The installation is in the graph. `declareInstallation({ roles, admin })` gives an app a user kind and an invitation kind, the acts on them — invite, welcome, revoke the invitation, remove, grant, revoke — as ordinary mutations the policy judges, a module drawn only for those who administer it, and a `self: true` grant so a person's derived edit is theirs on their own record and nobody else's. A module may declare `visibility: "admin"`; the store answers `mayAdminister` and `kindsKeptFrom` from the policy; the provider keeps such kinds out of the picture for a seat that may not see them and until the stop says `show=<module>`; the bar and the embed strip offer "Show the installation" to the seat that may; the pages list an administered module's kinds only for that seat. `reachLens` draws what each role reaches from the same `permits` the store refuses with. The checker counts derived acts and self grants when it asks whether a role may do anything.
- 992ac22: What the page taught the framework, folded back in. A board slot holds several occupants, each name its own target, and the bench lists only what is in no slot. The coverage lens reads its rows and columns from the graph, as the board already did, so no app wraps it to hand over the other kind. A titled registration names the picture. `focus=agg:plot` is a stop's short form for `aggregate:plot`. An embed infers its face from its stop and its scheme from the host page, and `mountWhenNear` mounts many embeds as a reader comes near them. The scaffold's views file says how a lens becomes a place.
- Updated dependencies [2e494a0]
- Updated dependencies [2a02849]
- Updated dependencies [3cb9a2a]
- Updated dependencies [29f771a]
- Updated dependencies [d70f2d6]
- Updated dependencies [491c7b6]
- Updated dependencies [7b58faf]
- Updated dependencies [e76d298]
- Updated dependencies [a5a867e]
- Updated dependencies [a10c8d0]
- Updated dependencies [44dabf1]
- Updated dependencies [38b0334]
- Updated dependencies [95fa221]
- Updated dependencies [a9a6210]
- Updated dependencies [5ba437c]
- Updated dependencies [60db3d0]
- Updated dependencies [b99fd51]
- Updated dependencies [0d868a5]
- Updated dependencies [6ecf8ec]
- Updated dependencies [3251440]
- Updated dependencies [1f232bb]
- Updated dependencies [aca0f2d]
- Updated dependencies [4b96ddb]
- Updated dependencies [08befa1]
- Updated dependencies [99b4b27]
- Updated dependencies [5b824e3]
- Updated dependencies [06fcf0c]
- Updated dependencies [f579faa]
- Updated dependencies [d7ea1a1]
- Updated dependencies [e982538]
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
  - @graview/primitives@0.0.2
  - @graview/pages@0.0.2
  - @graview/tools@0.0.2
  - @graview/layout@0.0.2
  - @graview/core@0.0.2
