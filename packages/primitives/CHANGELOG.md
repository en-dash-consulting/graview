# @graview/primitives

## 0.1.17

### Patch Changes

- cc690c4: The framework's own look is Graview's identity from the design kit's revision 03, and the identity is data a host can read. Paper, reading ink, muted text, En Dash navy and turquoise (`GRAVIEW_COLORS`: `#f7f7f2`, `#18213a`, `#586174`, `#001769`, `#00e5b9` — the corrected values; the earlier approximations of the navy and turquoise appear nowhere in the repository), Montserrat and its three weights (`GRAVIEW_FACE`, `WEIGHTS`: 550 for headings, 450 for reading, 600 for action labels), display tracking (`DISPLAY_TRACKING`, −0.025em), how the logo is used (`LOGO_RULES`: 140 px at the least, clear space half the symbol's height, the micro cut at 16–24 px and the regular from 32) and the shared-plane symbol itself, the kit's own outlines as an inline SVG in `currentColor` with its point in `--graview-mark-point` (`graviewSymbol`, named by `aria-label` so it can be drawn many times without repeating an id; `symbolCut` picks the micro cut under 28 px, where it measured clearer at 25–27 at 1x and 2x). The shipped schemes are built on it: the light one on paper with ink and navy as the accent, the dark one on a navy ground `#0a0f1f` with the navy's hue made light (`#9aabff`, navy text on it) as the accent; turquoise is in neither, because it is a point and a fill and never text (1.5:1 on paper). Neither paints a wash behind the scene any more, `brandFromAccent` keeps its base's wash rather than adding a glow, and a button's hover firms its edge in the dark where it glowed. `TYPOGRAPHY.body` names Montserrat first and the system's sans after it; the framework never fetches it — a host imports the optional copy, `@graview/primitives/montserrat.css` (32 KB of woff2, weights 400–700, Latin, cut from the kit's font under the SIL Open Font License, which ships beside it), or the system sans stands in as before — and the embed does not ask Google Fonts for it. The sheet writes the weights as `--graview-weight-display`, `--graview-weight-body` and `--graview-weight-label`, sets the body, headings and buttons with them, and sets the two largest headings at the display tracking; a brand that names its own faces gets 600, 400 and 600 and may name its own (`typography.weights`). The default radius is 8 px where it was 12, and the scene's open district name, a pinned view's outline and a focused view's ring follow `--graview-radius` where they said 12 px. `GraviewMark` (`@graview/primitives`) draws the symbol for a host that shows Graview's own identity; the framework puts it in no app. The primitives README says the three layers — the identity, the semantic tokens, the app's brand — and how selection and relations read against any district's color without leaning on color.
  
  Compatibility: the look, which is not one of the five surfaces (docs/stability.md says so now); ops, stored formats, the wire, the declaration, check's finding codes and tool schemas are unchanged. Changed defaults: `LIGHT` and `DARK` (every token but the state colors and the tint and grid numbers; `wash` is `"none"` in both), `TYPOGRAPHY.body` (`"Montserrat", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`), `SHAPE.radius` 8 (so `--graview-radius: 8px` and `--graview-radius-sm: 6px` for a brand that sets none), `typographyOf` returns `weights` beside the three stacks, the derived wash of `brandFromAccent`, and `SYSTEM_STACKS["system-sans"]`, which keeps its old value and no longer follows `TYPOGRAPHY.body`. New: `GRAVIEW_COLORS`, `GRAVIEW_FACE`, `WEIGHTS`, `PLAIN_WEIGHTS`, `DISPLAY_TRACKING`, `LOGO_RULES`, `graviewSymbol`, `symbolCut` and `SymbolOptions` (`@graview/core`); `Brand.typography.weights`; the custom properties `--graview-weight-display`, `--graview-weight-body`, `--graview-weight-label` and `--graview-mark-point` (read, never written by the framework); `GraviewMark` and the entries `./montserrat.css` and `./montserrat-latin.woff2` (`@graview/primitives`, whose `sideEffects` now names `*.css` so a bundler keeps the import). The embed's `familiesOf` and `fontsLink` leave Montserrat out. A brand that declares its own schemes, faces and radius draws as before but for headings at its display weight (600 unless it names one, where the browser's bold was 700), `h1` and `h2` tracked at −0.025em, and buttons' labels at 600; one derived from an accent over the shipped schemes takes the new grounds, panels and inks with its own accent. What Graview Cloud changes: nothing it must; to wear the identity it imports `@graview/primitives/montserrat.css` (or serves Montserrat itself), reads `GRAVIEW_COLORS`, `WEIGHTS` and `LOGO_RULES` rather than restating them, and draws `GraviewMark` or `graviewSymbol` where it shows Graview's own mark, with `--graview-mark-point` set to the turquoise for the two-color mark. Its harnesses that compare a rendered ground, panel or accent with the old `#f6f4f0`, `#0c6e78` or `#6fdcea` read the new values.
- b124330: What the review after 0.1.16 found in the old documents and the switch (FR-134, FR-136, FR-137), fixed. A document 0.1.16 wrote whose scene was called something of 25 to 40 characters stopped compiling: `pages.overview` took 40, and the `pages.scene` it is now read as took 24, so the respelling narrowed the key. `pages.scene` and `pages.pages` take 40 again, and the bar cuts a long word on the switch with an ellipsis, whole on hover. `arrange-pages` refused `overview` as a key it did not know, so a chat or a tool written before 0.1.17 could no longer rename the scene; it reads `overview` as `scene` now, and `scene` wins when both are said. `editDocument` with no edits gave the document back as stored, old keys and all, where any other edit list gives it in the current spelling; it gives the current spelling too, so a studio opened on a stored document and applied with no change hands back what `toDocument` writes. A declaration whose switch would say one word twice (`pages: { scene: "Lists", pages: "Lists" }`, or `scene: "Pages"`) is warned of by `graview check` as `pages-faces-alike`. In an embed narrower than `pagesBelow`, a reader who pressed Scene could not get back: Pages told the host the face, and a host that keeps its own face drew the scene still. Pages now stands the scene aside again, as it stood before, and the host's face is kept for when there is room. A home view written as blocks drew the app's description over its own headline, like an eyebrow; the description now follows the home's headline, and a home with none, or one a worker draws, still says it first. The profile's choices (who you sit as, the app's settings, the scheme) and the footer's "Answers come from" were capsules ringed in the accent; they are quiet boxes now, the one chosen pressed the way the bar's switch presses a face. The hosted page carries 570.1 KB compiling and 526.4 KB handed a compiled app, within their 570.5 and 526.5: the embed says an address within the app one way where it said it four.
  
  Compatibility: additive, for the document. `pages.scene` and `pages.pages` take up to 40 characters (were 24 in the unreleased build, and `pages.overview` took 40), `arrange-pages` reads `overview` as `scene`, and `editDocument([])` gives the document in the current spelling. A new check warning, `pages-faces-alike`. `@graview/primitives` and `/pages` gain `HomeLine`, the line said under a home's headline. Markup: the app's line on a home made of blocks (`app-subtitle`) is the next sibling of the home's first headline rather than the first child of `home-view`; the setting, seat and scheme buttons keep their test ids and `aria-pressed`, and their pressed look is a tint rather than an accent ring. Ops, stored formats, the compiled-app format, wire messages and tool names and schemas are unchanged. `capabilities().shipped` is unchanged.
- b124330: The scene and the pages are two things, and the bar says so; the places move out of the bar; and a home view is the front page on a desk too (FR-136, FR-137, FR-138). Nick, on 0.1.16 at a desk: "the new nav kinda sucks, and i don't see a way to go to the scene vs pages anymore". FR-132 had made the scene "Overview", one of the places laid along the bar as tabs, and on Graview Cloud's workshop app — two pictures named in sentences ("What the workshop covers", "Email to Todd") beside three kinds' lists — the tabs filled the bar's top edge and wrapped to a second row, the page under the bar repeated them ("On the overview ↗", the other pictures again), and the home a chat wrote stood as a card over the scene's top right. Right after the app's name the bar now has one switch: "Scene" and "Pages", an icon and a word each (the icons alone on a phone, the words their accessible names), two buttons whose `aria-pressed` says which face is drawn. Scene draws the scene under the bar; Pages goes back to the page the reader was on. A declaration may call them something else (`pages: { scene: "The farm", pages: "Lists" }`; `arrange-pages` takes `scene` and `pages`), and the scene keeps its address, `/places/overview`, so links, `where()`, `setPath` and `setApp` are as they were. On Pages, the place you are on is one control after the switch, its name and a chevron, that opens every place the app has: the home first, then Lists (one per kind) and Pictures (each named lens, and how the kinds connect), each with its mark in its kind's hue, a long name wrapped inside the list. Every place is two presses away, the keyboard reaches the switch, the control and every entry, and Escape gives it back to the control. The bar is one row of 48 px, its rule included, whatever the app holds, every control on the row's middle line; on a phone the place control is the page's first line, under the bar. A picture's page keeps only its own link, "All deliverables as a list"; the other places are the list's. An app with a home view — the declaration's `views.home`, or a worker view attached to `"home"` — opens on Pages at its home, full width under the bar, on a desk as on a phone, when the host names no face; under address routing it does so at the bare address whatever face the host names, and `where()` says so. Without a home view nothing changes. Why the old claim missed the wrap: "at most one bar row on a desk" counted the distinct tops of the bar's three regions (the app, the places, the tools), and a tab that wraps inside the places' region moves no region's top; it ran on two apps whose place names were short, at 1280 px. `pnpm verify quiet` now measures every control on the bar by its own box on a document shaped like Cloud's and on the same with thirty places, at 1000, 1024, 1280 (also at twice the pixels) and 1440 px and at 390, in three engines and both schemes: one row of at most 48 px, every control on the row's middle and none at the top edge, the switch saying Scene and Pages and marking the one drawn, every place in two presses by pointer and by keyboard, nothing calling the scene "the overview", a picture's page not repeating the places, and a home view opening full width under the bar. `pnpm verify address` holds that the switch is a step Back undoes and that an app with a home view opens on it at the bare address; `pnpm verify declared` that the front page made of data is where the app opens and nothing floats over the scene. The hosted page carries 569.9 KB compiling (from 566.3) and 526.1 KB handed a compiled app (from 522.6), the switch and the place list 2.4 KB of it and the embed's opening 0.8 KB; its budgets rise by that to 570.5 KB and 526.5 KB, which leaves Cloud's shell 24.5 KB under its 595. `capabilities().shipped` gains FR-136, FR-137 and FR-138.
  
  Compatibility: markup, options and addresses a host holds, and the document's `pages`. Gone: the bar's place tabs (`.graview-bar-places`, `.graview-bar-tab`, `.graview-bar-measure`), `app-places-more` and `app-places-more-list`, the overview's entry `app-place-overview` (the scene is the switch's), the routed face's `place-stop` and `sibling-pictures` under a picture's title, the scene's landing for a home view (`home-landing`, `home-landing-away`, and `HomeLanding` from `@graview/primitives` and `/scene`), `OVERVIEW_KEY` (`@graview/primitives`, `/frame`, `/pages`), `overviewTitle` (`@graview/core`) and `OverviewLink` (`@graview/pages`), and `barPlaces`'s `overview` option. New: the switch `[data-testid="app-faces"]` (`role="group"`) with `app-face-scene` and `app-face-pages` (`aria-pressed`); the place control `app-places-open`, its words `app-place-current`, its list `app-places` (a `nav`, now opened by the control and `hidden` until it is) with groups `[data-place-group="home|lists|pictures"]` and entries `app-place-<key>` (`home`, `kind:<kind>`, `place:<kind>:<as>`, `connections`) carrying `data-place-path`; on a phone the place line `app-place-line` (`[data-graview-place-line]`); a picture's own `place-as-list`; `AppBar`'s `faces` (`BarFaces`, `BarFace`), `BarPlace.group` and `.kind` (`BarPlaceGroup`), `BAR_HEIGHT`, `HOME_KEY` and `HOME_PATH`; `sceneTitle` and `pagesTitle` (`@graview/core`), `SceneLink` (`@graview/pages`, saying "In the scene ↗" where `OverviewLink` said "On the overview ↗"), `EmbedProps.onOpening`, and `opensOnTheHome` (`@graview/embed`). `barPlaces` lists the home first and has no overview. `POPOVERS.places` (`@graview/react`) is the place list: its trigger `app-places-open`, its pane `app-places`. The document's `pages.overview` is respelled `pages.scene` (a line in `RESPELLED`, so a stored document keeps its word on the switch), and `pages` gains `pages`; `arrange-pages` takes `scene` and `pages`, and still reads `overview` as `scene`, and its sentences say "the switch calls the scene …". An embed whose host names no face opens on Pages at the home when the app has a home view and its `pages.first` names no other place (`where().face` is `"pages"`), where it opened on the scene; under `routing: "address"` the bare address, with no fragment and no entry the router wrote, does so whatever `face` the host names, and `<Embed>`'s `onFace` is told `"pages"`. `placesOf(app)` marks the home `first` when the app has a home view and no `pages.first`. What Graview Cloud changes: its harnesses press `app-face-scene` and `app-face-pages` where they pressed `app-place-overview` and a place's tab, and reach a place by `app-places-open` and then `app-place-<key>`; they read the face drawn from `aria-pressed` on the switch, and the place from `app-place-current`. A shell that mounts on the Graview at the app's bare address now lands on the home view when the app has one; one that wants the scene there links to `/places/overview`. A chat tool may send `arrange-pages` with `scene` where it sent `overview`; the old word still works. Ops, stored formats, the compiled-app format, wire messages and tool names are unchanged.
- Updated dependencies [cc690c4]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
  - @graview/core@0.1.17
  - @graview/react@0.1.17
  - @graview/layout@0.1.17
  - @graview/render@0.1.17
  - @graview/tools@0.1.17

## 0.1.16

### Patch Changes

- 87e43d3: A host's press leaves the reader's keyboard where it is, and two embeds on one page name their search apart. Putting the seat away from its header moves the keyboard to the tab, and opening it from the tab moves the keyboard to the header (FR-78). It did so for any click, so a host page whose own script puts the seat away after the mount, as graview.dev's landing page and demos do, took the reader's keyboard into the embed before they had touched it: the first Tab no longer reached the page's skip link. The keyboard now follows the control only when it was on the control. Every landmark inside an embed is named after the embed (FR-128), but the sweep did not reach the routed face's Find box, a `role="search"` form named "Find anything", so a page with two embeds on that face carried two search landmarks of one name (axe's `landmark-unique`). It is now "<embed> · Find anything". A unit test puts the seat away and opens it with the keyboard elsewhere and checks the keyboard stays there, and another mounts two embeds on the routed face and holds their search landmarks to two names under axe. `pnpm verify site` holds again on the rebuilt `docs/site/chapters.js`.
  
  Compatibility: a search landmark inside an embed is named after the embed, as every other landmark inside it already was. Ops, stored formats, the document format, wire messages, check codes and tool schemas are unchanged.
- 1df248f: A brand's mark is read as the browser reads it, and what the review after 0.1.15 found in the brand, the bar and the overview is fixed. An inline SVG logo is put in the page through the HTML parser, and the rules that judged it searched the string for what is forbidden, so the parser could be talked past them: a handler after a slash (`<animate/onbegin=…>`), an unquoted `javascript:` link, markup after `</svg>` (`<img/src/onerror=…>`, `<base>`, `<meta http-equiv=refresh>`), an animation that sets a link, a style written in CSS escapes or character references (`u\72l(`, `@\69mport`), a namespaced `<x:script>`. Each was taken by `graview check` and drawn on every face. `svgProblem` now reads the SVG element by element as the HTML and the XML parser will, and keeps only what a picture is made of: the drawing elements (no `a`, `style`, `script`, `foreignObject`, animation or `feImage`), no prefixed element and nothing but text inside `title` and `desc`, every attribute quoted and apart, no handler, a link only to `#id` within it (or a `data:` PNG, JPEG, GIF, WebP or AVIF on an `<image>`), every `url(` a fragment of it and no escape, at-rule or image function in a value, no CDATA, no entity and nothing after the root. A path that climbs (`.` or `..`) is refused, and `markHref` hands a face no address of a scheme other than `http`, `https` or a `data:` image. The guest host makes no `blob:` of an inline SVG that could act, and fetches no path that climbs or is percent-encoded to, so a view is never handed the bytes of another page of the host. A face named in a document is left out of the style sheet when it could end its rule, even where the page compiled without the checker. Reading the mark costs about 4 kB minified wherever a mark is drawn or handed to a view: Graview Cloud's hosted page carries 579,107 bytes up front compiling (565.5 KB, its budget now 567 KB, which leaves the shell its ~25 KB under 595 with 3 to spare) and 534,306 handed a compiled app (521.8 KB of 523); the pages face alone measures 505,406 / 173,425 bytes (minified / gzipped), the embed without the studio 693,248 / 179,214, and the guest host before a worker is drawn 16,358 / 7,540, each budget raised just above. A test in `@graview/core` holds twenty-three payloads refused and a picture's own parts kept, and one in `@graview/primitives` draws none of the bypasses. The review also found: an embed narrower than `pagesBelow` under `routing: "address"` opened on "No picture is called that." (the routed face now takes `/places/overview` as the home, unless a declared place holds that address); the scene's Find in the bar took ⌘K from the host page's own editor and `/` from anywhere (it answers ⌘K only from within its embed or from nothing, `/` only from within, and never a key the host already answered); the stop "On the overview ↗" named held the scene for the rest of the visit, so `setStop` was ignored after it (it is let go when the reader leaves the scene or the host sets a stop); Escape putting the phone's Find away left the keyboard on the page's body (it goes back to the magnifier); the place you are on could hide inside "More" on a row too narrow for one tab, and a web font arriving late did not re-measure the row; the shade a `theme-contrast-below-aa` finding offered was judged on a gradient's first stop only and could fail on the others; `pages-overview-taken`'s fix told a declaration to rename the overview, which keeps its address; an accent refused because the warning color shares its hue was said as failing to read in the dark scheme, and a dark-scheme refusal asked a document for a dark accent it cannot give; `set-brand {}` was taken with nothing said, the same logo or name again was said as a change, an alt text alone was said as "The logo changes.", and words with quotes or a closing period were quoted as `"Say "hi""` and `"…booked.".`.
  
  Compatibility: `svgProblem` and so `brand-mark` refuse inline SVGs they took before: an `<a>`, a `<style>`, an animation, `feImage`, a prefixed element, an unquoted attribute, an element inside `title` or `desc`, CDATA, a named entity in an attribute other than XML's five, and a mark path with a `.` or `..` segment; a mark that only drew shapes, gradients, filters, text and its own `#` links is taken as before. Graview Cloud's `add_image` should hold an image to the same reading. `markHref` returns undefined for a scheme other than `http`, `https` and a `data:` image. `editDocument` takes an optional third argument, `{ fonts }`, as `compileDocument` does; `set-brand` refuses an edit that names no key, or an empty `typography`, `shape` or `accents`; the sentences said for an unchanged name, description or logo, and for an alt text alone, are new words, and a quoted name or line that ends a sentence carries its own stop. `passingShade` clears every stop of a gradient. `accentProblem`'s `pair.on` is a hex color and its `ratio` the accent's on the dark panel where the dark scheme refused it. `pages-overview-taken`'s fix is new words. Ops, stored formats, the document format, wire messages, check codes and tool names and schemas are unchanged.
- 46c6734: Named edits for the app's name, its description and every key of its brand (FR-125). From Graview Cloud: a chat renamed an app with a raw JSON Patch on `/name` it had to discover, and nothing said whether either face drew the document's description. `set-brand` takes every brand key — `logo`, `favicon`, `typography`, `shape`, `accents`, `scheme` beside `accent`, `name`, `currency` and `locale` — and `null` clears one (a part of `typography`, `shape` or `accents` too); `set-name { name }` and `set-description { description }` are edits of their own. Each says what it did and `diffDocuments` says it in words: "The app is now called "…", where it was "…".", "The line under the app's name reads "…".", "The logo changes.", "Headings are now set in system-serif.", "Corners are now 6px.", "The app opens dark when the reader has not chosen." A mark or a face the checker would refuse is refused at the edit, by its path. The description is said on both faces: as the app name's hover on the one app bar (FR-131), and as the line on the routed face's home, wrapping, never cut. `describePlace("home")` says the app as the home draws it (`masthead`, a `DescribedMasthead`): the name, the line under it, and the logo by its alt text (the app's name when none is given) and how it is drawn.
  
  Compatibility: `EDIT_OPS` gains `set-name` and `set-description`. `DocumentDiff`'s sentence for a renamed app and for a changed description is new words; a program matching "The app is renamed from" or "The app's description change" no longer finds them. `PlaceDescription` gains optional `masthead`, and the home's `text` gains a "Masthead:" line after its first. `set-brand { name: null }` now clears the wordmark's name, and a brand left holding only a name is kept (it is drawn). `capabilities().shipped` gains FR-125.
- 0f1a4d2: Notices float, and never move the page (FR-133). With an app open in place on a desk, the way back ("Take back “Mark done: Could Val lead…”") was a sticky box at the top of the face's flow: under the embed's strip it opened a band of its own, pushed the heading and every row down, and cut its sentence off with an ellipsis. It is drawn as a notice now, in the top layer on the ladder's toast rung and in no row of the page, its sentence wrapping over lines (four before anything is cut, and whole in its name and title), said politely as it comes. The host's toasts (`notify()`) and the way back stand at the foot of the picture they are about — its middle on a phone, above the safe area, and its left on a desk — and clear of what stands there: above a short control at that foot (the pages' Ask, the scene's zoom, the way back itself, so several notices stack without overlapping) and beside a tall one (the seat docked at the left). A banner lies over the picture directly under the bar, at its middle. In WebKit a stack of notices stood as tall as the screen (its popover's `fit-content` height on a grid), covering the page; it is as tall as what it says now. `placeAtTheFoot` and `placeAtTheTop` place them, and a control a notice should stand clear of says so with `data-graview-foot`. `pnpm verify quiet` makes a change, then says a toast with an Undo and a banner, on the vendor template's Pages and Graview faces at 390×844 and 1280×800, in Chromium, WebKit and Firefox and both schemes: no layout shift is reported in Chromium and the bar, the first heading and the first list item keep their boxes in every engine; each notice is in the viewport where it was asked to stand, over no other notice and nothing at the foot, with no text leaf cut, said politely, and its act a button Tab reaches without the notice having taken the focus.
  
  Compatibility: markup and position changes a host may style against. `[data-testid="face-undo-dock"]` is a `popover="manual"` element fixed over the face, carrying `data-graview-foot`, instead of a sticky box in the face's flow, and its button is a floating panel with a corner rather than a capsule; its polite status line is now a sibling before it. `[data-testid="notices-toasts"]` stands at the foot's left on a picture 640 px wide or more (it stood at the middle at every size) and no longer carries `translate: -50% 0`; both stacks are placed by `left`, `top` or `bottom` and a `max-width` written inline. The pages' Ask and the scene's zoom carry `data-graview-foot`. `capabilities().shipped` gains FR-133. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- ae891b0: One app bar on every face, and the scene is a place beside the others (FR-131, FR-132). Nick, on a real app in Graview Cloud: the title and the Scene/Pages toggle were ugly, bloated and broken under a notification — two stacked bars said the app's name, the way into the scene and the state of the rules twice each, and "Scene", "Pages", "Pictures" and "Map" were four words for overlapping ideas. One bar now stands over every face (`AppBar`, from `@graview/primitives`): the app — its mark (the brand's logo when the document has one) and its name, said once as the page's heading, the way home — then the app's places as plain tabs, the one you are on marked with `aria-current`, what the row cannot hold under "More"; then three tools of one size, each named: Find (inline; ⌘K or Ctrl+K on a desk; a magnifier that opens the box over the bar's first row on a phone), the standing (a dot in the tone of the rules, a number only when one is broken, opening what is broken; "Everything is in order" its name and its hover otherwise) and the person (an avatar whose menu holds who is signed in, the seats, the host's own actions such as "Report this app" and, for whoever keeps the app, the installation and the studio). One row on a desk; on a phone the places take a second. The routed face's own header — the title, the Find box, the Problems tab, "Open the scene" — is gone: under the embed's bar the derived shell draws none of it and its Find goes in the bar; on a face that owns its page the shell is the same bar. The scene is the overview, a tab beside the others — "Overview" unless the declaration calls it something else (`pages: { overview: "The farm" }`, and `arrange-pages` takes `overview`) — at `/places/overview` whatever it is called, its stop riding on it; the lens gallery is the home the app's name goes to and the relation map is "Connections". The scene's own Find now stands in the bar on the embed too. What is behind the person and the problems' rows are fetched when first reached for, and the blocks a view is drawn with come with the face that draws one (`viewsCss`): the hosted page carries 561.1 KB compiling (from 566.3) and 517.4 KB handed a compiled app (from 522.6), and its budgets come down to 562 KB and 518 KB. `pnpm verify quiet` holds, on both faces at 390×844 and 1280×800: one bar row on a desk and two on a phone (the second the places), one heading naming the app, nothing the bar says said again above the fold, one Find box, the tools one size and named, no control that says "Scene" or "Pages", and the overview and a list one press on a tab apart by pointer and by keyboard; `pnpm verify address` holds the overview's address, a link to a stop at the bare address still opening the scene, and a host that mounts on the Graview landing on the overview. `capabilities().shipped` gains FR-131 and FR-132.
  
  Compatibility: markup, options and addresses a host holds. The embed's `toggle` option is `bar`. Gone: the strip (`[data-testid="embed-faces"]`, `[data-embed-strip]`), the face switch (`embed-face-scene`, `embed-face-pages`), the strip's seats (`embed-seats`, `embed-seat-<id>`: the seats are in the person's menu, `[data-testid="seats"]`, taken through the provider's `onSeat`, which the embed forwards), the scene's place pills on the embed (`[data-testid="places"]`, `place-<as>`: the whole-page Shell keeps them), the routed face's `masthead`, `shell-nav`, `problems-count` and its `face-find-bar` under a bar, the profile's `profile-gear` and the name beside its mark, the Shell's Scene/Pages switch (`[data-testid="faces"]`; `pages-link` is a "Lists" link), and the embed's visually hidden workbench heading. New: `[data-graview-app-bar]` (`app-bar`), `app-home`, `app-name`, `app-places` (`nav`, "The app's places"), `app-place-<key>` with `data-place-path` (keys `overview`, `place:<kind>:<as>`, `kind:<kind>`, `connections`), `app-places-more`, `app-places-more-list`, `app-find`, `app-find-open`, `standing-link` on a routed face that owns its page, `[data-graview-page-title]`, and classes `.graview-bar`, `.graview-bar-tab`, `.graview-bar-tools`. `heading` now sets the level of the bar's name, which is `brand.name ?? app.name` (the `label` stays the region's name); each page's title is said a level under it (`PageContext.titleLevel`; `h2` where it was `h1`), and a view's headlines under that (`HeadingsUnder`). `PageContext.standingAbove` is `barAbove`; `PageContext.overview` and `PagesApp`'s `steering` are new. `Standing` and `Profile` lose `compact`; Standing is a dot and a count with its words in `aria-label` and `title`, `aria-disabled` rather than `disabled` when all is well. Under address routing the scene's address is `<base>/places/overview#<stop>`: `faceAtAddress` reads it as the scene (`#overview=1` as the Graview), `<base>#<stop>` still opens the scene and is replaced on arrival by the overview's address, and a bare `<base>` a host mounts on the scene or the Graview is replaced the same way. `where().path` is `/places/overview` on the scene; `setPath("/places/overview")` draws the scene and any other `setPath` draws the routed face at that page; under memory routing `onNavigate` is told `/places/overview` (push) when the reader goes to the overview, and the page's path when they leave it; Below `pagesBelow` the overview's tab draws the scene when the reader asks. `placesOf(app)` lists the overview second, after the home. `themeBaseCss` no longer carries the view-spec blocks: `viewsCss({ scope })` does, drawn by each face that draws a view (`themeCss` still has all of it). The boxed studio is drawn into the embed's own element. The derived routed face's tab for the relation map says "Connections" (its page and the home's link likewise), it has no Pictures or Problems tab (the app's name goes home, the standing opens the problems, `/problems` stays), its home no longer repeats the app's name as an eyebrow and says the brand's line under it instead, and "See it in the scene ↗" says "On the overview ↗" and is not drawn on an embedded face with no scene. The document's `pages` gains `overview`, `arrange-pages` takes it, `graview check` adds `pages-overview-taken` (a place whose address is the overview's), and the wire's `capabilities().shipped` gains FR-131 and FR-132. Ops, stored formats and tool names are unchanged.
- a6d0700: The document holds the whole brand the TypeScript `Brand` already has (FR-124). From Graview Cloud: a chat could restructure an app's blocks but not change how it looks, because a document's `brand` was an accent, a name, a currency and a locale. It now also takes `logo` (inline SVG, or a path on the app's own host such as `/graview/assets/<sha256>.svg`; a string, or `{ "src", "alt" }`), `favicon` (the same forms), `typography` (`display`, `body`, `mono`: `system-serif`, `system-sans`, `system-mono`, a face every system has, or a web font on `DOCUMENT_FONTS`), `shape` (`radius`, `density`), `accents` (a hue per kind) and `scheme` (`light`, `dark` or `auto`), each mapped onto the `Brand` the theme machinery draws from. `graview check` refuses a mark that could act or load (`brand-mark`: an inline SVG is read element by element, as the browser will read it, and only what a picture is made of is kept — no script, event handler, `foreignObject`, `<a>`, `<style>`, animation, embedded page, link or load outside itself, CDATA, entity, or anything after the root; and any other origin, a path off `/graview/assets/`, or a path that climbs with `.` or `..`) and a face named by its address or off the list (`brand-font`); a host that serves other web fonts names them to `compileDocument(…, { fonts })`. Every document now compiles to a brand, so its app is called what its document calls it on both faces. The faces draw the app's mark with one component, `AppMark`, in the one app bar (FR-131), and the whole-page Shell's wordmark with `AppTitle`: an inline SVG logo is put in the page byte for byte, with `currentColor` taking the accent, and an SVG that could act is not drawn even where a page compiled without the checker. The whole-page Shell and the routed face on its own wear the brand's icon (`useFavicon`, `faviconHref`); an embed changes its host's icon only when the host passes `favicon: true`. The scheme an app prefers is drawn when the host's page stamps none. The embed no longer asks Google Fonts for a face the reader's system has. A new harness, `verify-brand`, holds it in three engines. The bundle budgets rise with measured numbers: the pages face alone to 492,500 / 167,500 bytes, the embed without the studio to 691,500 / 177,500, every face to 1,518,500 / 455,750, the embed with the studio handed in to 1,489,500 / 443,000; the hosted page's budgets for this release are in the one app bar's entry.
  
  Compatibility: additive to `graview-document@1` and to `graview-compiled@1` — every key is optional and a document without them means what it meant, except that a document with no brand is now called by its `name` where it was called Graview. A build that predates them refuses the keys by path. `Brand` gains optional `logoAlt`, `favicon`, `subtitle` and `scheme`; `hostScheme` takes an optional preference; `FrameOptions` gains `favicon`. `capabilities().shipped` gains FR-124.
- 9eaa3c9: The framework spells in American English. The code, the sentences it says to a person and to a model, the comments, the docs, the skills and the test names had drifted into British spelling in some four hundred files, so one thing had two names, and an export spelled one way was an import a stranger got wrong the other way. Every one is now American: color, center, behavior, judgment, labeled, canceled, catalog, gray, normalize, and the rest of their kind. What the platform and third parties own keeps their spelling: `aria-labelledby`, the status Google Calendar gives a deleted event and MCP's `notifications/cancelled`. Published changelogs and Graview Cloud's documents among the test fixtures are kept as written. A test at the root, `tests/the-repo-spells-in-american-english.test.ts`, reads every tracked source, doc, skill and changeset for the British forms and names the file and line of any it finds, so the drift does not come back.
  
  Compatibility: renamed outright, with no aliases. `@graview/core` exports `normalize` (was `normalise`), `summarize` (was `summarise`), `humanizeField` (was `humaniseField`), `colorsIn` (was `coloursIn`) and `connectorHueColor` (was `connectorHueColour`). `@graview/primitives` exports `humanize` (was `humanise`). `@graview/react` and `@graview/react/provider` export `honorSetting` (was `honourSetting`). In the declaration, a setting says `honored` (was `honoured`), a brand's connector kit says `color` (was `colour`, in `brand.kit.connectors.all` and `byEdge`), as does a `checkKitContrast` finding, and an invariant written in the rule language carries `judgment` (was `judgement`). Two check finding codes are renamed: `kit-color-unreadable` (was `kit-colour-unreadable`) and `setting-not-honorable` (was `setting-not-honourable`). The scene's CSS custom property `--graview-center-y` was `--graview-centre-y`. Sentences said to a person or a model that used a British form now use the American one. Ops, stored formats, the document format, wire messages and tool names and schemas are unchanged.
- Updated dependencies [340ab1e]
- Updated dependencies [1df248f]
- Updated dependencies [eefa440]
- Updated dependencies [03ad97c]
- Updated dependencies [a1da756]
- Updated dependencies [4ad451c]
- Updated dependencies [46c6734]
- Updated dependencies [0f1a4d2]
- Updated dependencies [ae891b0]
- Updated dependencies [a6d0700]
- Updated dependencies [9eaa3c9]
  - @graview/core@0.1.16
  - @graview/react@0.1.16
  - @graview/layout@0.1.16
  - @graview/tools@0.1.16
  - @graview/render@0.1.16

## 0.1.15

### Patch Changes

- Updated dependencies [817082f]
- Updated dependencies [d4fb72e]
- Updated dependencies [6a5fb11]
- Updated dependencies [a8b8153]
- Updated dependencies [fffebfd]
- Updated dependencies [efab5b2]
- Updated dependencies [9fc2bd8]
  - @graview/core@0.1.15
  - @graview/tools@0.1.15
  - @graview/layout@0.1.15
  - @graview/react@0.1.15
  - @graview/render@0.1.15

## 0.1.14

### Patch Changes

- fc42f1e: A coverage cell over a path selects what it joins (FR-111). A filled cell wore only its column's id, so on a Strengths lens that crosses people with skills through a `strength` record, choosing Ryan × SEO selected SEO, and its line ran to the collapsed strengths' district — a stand-in for records the picture does not draw. A filled cell now says what it joins (`data-graview-joins`: its row, its column and the records on the path, `["p-ryan","sk-seo","st-ryan-seo"]`), and choosing it selects exactly those: on the Graview face the scene's selection is the three (`onPick` carries the joins; shift or ⌘ adds them), and on the routed face's `/places/<as>` the picture stays where it is, lit with its row and its column, instead of going to the column's page — the row's and the column's names still go to their pages. The lens draws the crossing's own lines, from the cell to the row's name and to the column's head, ending on each, inside the picture so they scroll with it; a stacked grid on a phone names the column inside the cell, so there the line is the row's. A record on the path gets a line only where it is drawn as itself, and nothing is drawn to a district: the scene's selection lines give way to a chosen crossing, and draw from the cell only to a joined record that has a card of its own on the stage. `verify-declared` chooses Ryan × SEO on both faces at 1440×900 and 390×844 and asks that each line ends on what it names and that no line goes to a district.
  
  Compatibility: unchanged for stored data, ops, tool schemas and the wire. A filled coverage cell keeps `data-graview-pick` (the column's id) and gains `data-graview-joins`; a host or test that read the scene's selection after a cell press reads the row, the column and the joining records where it read the column. The routed face's place page no longer navigates on a cell press. `capabilities().shipped` gains `FR-111`.
- 3f02759: The room under a district's signpost is sized from its place names as the brand's face draws them (FR-118). The marquee's height was estimated from the letter count at an average letter's width, so a brand whose body is a wide display face wrapped names onto lines the city had not made room for, and the column ran past its district into the one below. The scene now measures each name with `measureText` in the face it reads off its own element (an embed scopes its brand to itself), at the marquee's size and its heavier weight, again once the brand's fonts have loaded, and wraps it word by word as the browser does; the layout sizes the band from that and hands the district the same room, and never under the estimate. Where nothing can measure — Node, jsdom — the estimate is the answer, as before.
  
  Compatibility: unchanged for stored data, ops, tool schemas and the wire. `LayoutOptions` takes an optional `nameWidth`, `marqueeHeightFor` an optional third argument (a `NameWidth`, exported from `@graview/layout` and `@graview/layout/view`), and `@graview/react` (and `@graview/react/drawing`) exports `useMarqueeRoom`, the room the scene reserved for a marquee of given names. A marquee in a wide face may come out taller than it did.
- 5a236ea: A name is never cut off where it is the thing to read (FR-118). Each drive-in in the scene drew its showings as thumbnails. Each was its lens at a seventeenth of its size, 54 pixels wide, with its name cut under it: "Who o…", "Strengt…", "Handof…". It was a picture nobody could read, over a name nobody could finish. A drive-in's marquee now says its showings by name, the way a marquee does. The names stand in a column hanging off the district's signpost, each one whole, wrapped onto a second line rather than cut. The showing on the billboard is marked by the column's rule in the accent. The picture is the billboard's, drawn at its own size once a showing is pressed. The layout reserves the room the names take (`marqueeHeightFor`). Pressing a name does what pressing a thumbnail did. With the thumbnails gone, the city at altitude draws no lens until one is chosen, and the one-a-frame mounting that kept them affordable is gone too. What is still cut on purpose keeps its whole name in reach. That is a chip in a cell narrower than its name, or a coverage row's name at the matrix's edge. Each carries its whole name as its title and accessible name, and pressing it selects the record, whose whole name the inspector says. The places on the bar are whole names that scroll (FR-117). A row's badge and progress label are never cut (FR-113). The new `pnpm verify quiet` measures cut-off text two ways. The first is Cloud's: a visible text leaf whose `scrollWidth` exceeds its `clientWidth` under an ellipsis, `overflow: hidden` or a line clamp. The second is geometric: a text's own box against every box above it that clips, an axis that scrolls excepted, and an SVG text against its drawing. That catches what the CSS count misses, like the scene's place tiles. On Cloud's four screens, in three engines and both schemes, nothing is cut, where 7, 3, 0 and 3 texts were before. Every place tile in the org app's scene says its whole name, at a desk and at a phone, where four of eight were cut.
  
  Compatibility: a drive-in's `.graview-drive-in-thumb` holds `.graview-drive-in-thumb-title` and the `.graview-drive-in-thumb-press` button. `.graview-drive-in-thumb-picture` and `[data-graview-thumbnail]` are no longer drawn. `@graview/primitives` no longer exports `THUMBNAIL_BUDGET`. `@graview/layout/view` no longer exports `THUMB_ONE`, `THUMB_TWO` or `THUMB_TITLE`, and exports `MARQUEE_WIDTH` (156) instead; its `MARQUEE_GAP` is 2 where it was 4. `marqueeHeightFor`, from `@graview/layout` and `@graview/layout/view`, returns the height of a column of names. A lens may still be handed `budget` and `total`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- 1712959: A number edited where it is shown is asked for in its range (FR-114). The routed face's form, the workbench's answer box and the studio's agent panel put a field's `min`, `max` and `step` on their number inputs, but `EditableValue`'s did not, so its spinner stepped to 6 on a field that takes 1 to 5 and apply refused what the control had offered. It now carries them too.
  
  Compatibility: unchanged for stored data, ops, the wire, the declaration and derived tool schemas; the in-place number input gains `min`, `max` and `step` attributes.
- 45842b7: A number field may say its range (FR-114). In a document, a `number` or `integer` field — and an act's declared argument — takes `min`, `max` and `step` (`"level": { "type": "integer", "min": 1, "max": 5 }`); `step` is what its values are whole multiples of, JSON Schema's `multipleOf`. The range is the field's schema, so everything that reads the schema honours it: a value outside it is refused at apply as `invalid`, whichever act brought it (a `set-level` given 9, a `note-strength` that makes a strength at 9, a derived `edit-<kind>`); an agent's tool says `minimum`, `maximum` and `multipleOf`; and `describeArg` and `formField` carry `min`, `max` and now `step` (1 for a whole number), which the routed face's form, the workbench's answer box and the studio's agent panel put on their number inputs, so a form will not take 9. A declared argument that fills a ranged field and says no range of its own is asked for within the field's. `graview check` refuses `default-range` when a default is outside its field's range or off its step, and `field-range` for a range on a field that is not a number, a `max` below its `min`, or a `step` that is not above zero, by path — asked with the checker (`compileDocument`), not by a page compiling a document its host has judged, so the hosted page does not carry them. `editDocument` gains `set-range` (`{ kind, field, min?, max?, step? }`, `null` clears one), refused on a field that is not a number or one whose default it would leave outside; `set-default` is refused outside the range, and `retype-field` to anything that is not a number lets the range go. `diffDocuments` says a changed range ("strength's level now takes 1 to 3, where it took 1 to 5; values outside it are cleared"), and a narrowed one is breaking and listed in `narrowedRanges`; `planMigration` clears the values a narrowed range no longer takes. `toDocument` writes a TypeScript field's inclusive bounds (`.min(0).max(1)`, `.multipleOf(0.5)`) as its document field's range. The studio keeps a document's range through a change it makes, says it up front (`studio-keeps-range`, "taken from 1 to 5"), and refuses to retype such a field rather than let the range go unsaid.
  
  Compatibility: unchanged for stored data, ops and the wire. Additive within `graview-document@1` (docs/stability.md): a field without a range means what it meant. `ArgShape`'s number and `ScalarField` gain an optional `step`, and an integer argument now describes itself with `step: 1`. `DocumentDiff` gains `narrowedRanges`, and the edit vocabulary gains `set-range`. `graview check` gains two error codes, `default-range` and `field-range`, which judge only keys a declaration could not hold before. `capabilities().shipped` gains `FR-114`.
- 8c43964: A pill means "press this to choose", or a state (FR-117). Building En Dash Org on Graview Cloud ended in one verdict: "too many pills, and too much cut-off text, on every face". When everything is a capsule, nothing reads as the thing to press, and a state badge, the one pill that earns its place, no longer stood out. Now one rule holds on every face. A capsule is a choice the reader can make, or a record's state badge, and nothing else is one. In a set of choices (the face switch, a calendar's range, the "Answers come from" setting, the embed's seats), the one chosen wears the capsule and the others are words to press. The places are text tabs that scroll, with the current one underlined, on a desk and on a phone alike. They are tabs rather than a menu because the places are the app's own navigation, read at a glance: a menu hides every name behind a press, and tabs keep every name whole and on screen. The tabs scroll sideways, a mouse wheel included, and the edge with more beyond it fades. The place you are on is scrolled into view, and each tab is a button the keyboard reaches. The "+N more" select and the phone's single select are gone. A district's name in the scene is text on its plot, haloed in the ground's colour, and its trouble bar is the name's baseline. The open control beside it is a quiet chevron. The scene's "Up" / "Down to …", the zoom control, the seat's suggestions and a calendar's previous, today and next are quiet buttons or links. A record is a card. A chip, a coverage cell's label, a relation's sign on a line and a kind's link on the routed home have a card's corners. A place page's other pictures are links. A kind's mark is its plot in miniature, a small iso tile in the kind's hue, rather than a round dot. A badge is not drawn where its context already says it. No card on a status board wears its own column's status, and a row under a grouped list's heading does not repeat that heading's value. The same goes for a field block of the board's own field. Other badges and blocks are drawn as before. A new harness, `pnpm verify quiet`, mounts the embed over the org app and Cloud's vendor template, as Cloud mounts it. It counts pills by Cloud's own definition: a visible element under 34 px tall, with a corner radius of at least half its height and a fill or a border. It runs in Chromium, WebKit and Firefox at 390×844 and 1280×800, in both schemes. The org app's desk Graview face goes from 39 pills to 4, and the vendor template's phone Pages home from 34 to 7. On the vendor template's desk Graview face it is 20 to 4, and on the org app's phone "Skills and levels" 12 to 7. No board card wears its own column's status, where four did. Cloud's hosted page loads 580 402 bytes up front (567 KB), where it loaded 580 510, so the design pass is 108 bytes smaller up front. The embed without the studio is 696 582 / 178 525 bytes first, where it was 696 428 / 178 422, and its gzipped budget is now 178 600.
  
  Compatibility: `Places` renders `nav[data-testid="places"]` holding `button.graview-place-tab[data-testid="place-<as>"]` (with `aria-pressed`) at every width. The `places-more` select and the compact `select[data-testid="places"]` are gone, and `compact` now puts the tabs on a row of their own. At altitude, `.graview-kind-face` has no capsule: no background, border or radius, and `[data-graview-tally]` is drawn at its foot. `.graview-kind-open`, `.graview-zoom`, `.graview-zoom-button`, `.graview-altitude-control` and `.graview-kind-tag` are no longer capsules. `Chip` has a 6 px radius. A kind's mark with no figure (`[data-graview-figure-kind="dot"]`) is a clipped iso tile, no longer a circle. The columns lens and a grouped list tell the cards they draw which value their heading already says; there is nothing new to import. `capabilities().shipped` gains `FR-113`, `FR-117` and `FR-118`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- f16cfbc: A district's quiet "open" control is a fingertip wide as well as tall (FR-117). Taking the capsule off it narrowed its sides from 9px to 6px, and at rest it is the chevron alone: `audit-ui` measured "open ▾" at 21×24 on every district of every app, three pixels under the 24px floor its own stylesheet names. It now declares `min-width: max(1.5rem, 24px)` beside its height floor, and the sheet's own test holds it there; `audit --quick` goes from 30 of 38 screens clean to 37.
  
  Compatibility: unchanged for stored data, ops, tool schemas and the wire.
- 05b0a95: A hosted page has room again: Cloud's hosted page loads 555.0 KB up front, where this round's features had brought it to 570.0 KB, and its budget comes down from 572 KB to 563 KB. Graview Cloud holds its shell to 595 KB with about 25 KB of its own, so the framework's page has to stay near 565 KB for Cloud to have any room; Cloud's shell built from these sources measures 554 KB, where it measured 569. Nothing a reader sees changed. A bundler gives a whole file to a page's first chunk when the first chunk can reach it and any chunk uses it, and the frame of every face reached, through the entries it imports up front, files that only a drawn view uses. Those now have entries of their own, fetched with the face that draws them. `@graview/react/drawing` holds the measured text, the kit's connector, the boundary a view draws inside, the sets a view lights and dims by, the fields edited in place, the others placed on a picture and the attention a seat pipes in (React 6.1 KB smaller up front, and `@graview/render` no longer up front at all). `@graview/tools/edit` holds the fields a record lets a reader change, and the reader's pins left `@graview/tools/frame` (tools 1.7 KB). A label's fit left `@graview/layout/view`, which keeps only the estimate of a line's width (layout 1.6 KB). The arranging of a list is `@graview/core/arrange`'s (core 4.0 KB). And the assistant fetches the describer when a place is first asked about, not with its seat, so the pages face alone loads 475.8 KB first, where it loaded 488.7. The bundle budgets come down where they shrank: the pages face alone to 488 000 / 166 000 bytes, the embed without the studio to 682 500 / 173 500, and the embed with the studio handed in to 1 472 000 / 436 500.
  
  Compatibility: the arrangement's functions moved from `@graview/core` to `@graview/core/arrange`: `arrange`, `arrangeable`, `arrangeAllows`, `admitArrangement`, `asksForThePast`, `bucketStart`, `conditionHolds`, `edgesOf`, `formatArrangement`, `matches`, `NO_ARRANGEMENT` and `parseArrangement`. Their types stay on `@graview/core`. `useActivity`, `useAttention`, `useDrawnSize`, `useTextMeasure`, `useEditableFields`, `useFlagged`, `useImplicated`, `useReached`, `NOTHING_FOUND`, `useKit`, `kitConnector`, `ViewBoundary`, `anchorOf`, `placeOthers` and `AUDIENCE_ROW` moved from `@graview/react/provider` to `@graview/react/drawing`, and all of them are still on `@graview/react`. `editableFields`, `loadPins`, `savePins`, `togglePin` and `NO_PINS` are no longer on `@graview/tools/frame`: `editableFields` is on `@graview/tools/edit`, and all of them are still on `@graview/tools`. `fitLabel`, `areaOf`, `boxOf`, `centroidOf`, `overlaps` and `spanAt` are no longer on `@graview/layout/view` and are still on `@graview/layout`. `@graview/core/arrange`, `@graview/react/drawing` and `@graview/tools/edit` are new entries, and a linked project's vite config aliases each of them. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- 196033b: A row in a nested list keeps its small blocks whole (FR-113). A row was a capsule holding a title, a badge and a progress block on one line, and every one of them was cut with an ellipsis. In En Dash Org's "Skills and levels", at a phone's width, the level badge drew as "L…" and the progress label as "3 of". Now a row is a line of its list. Its badge and progress keep their own width. The title takes what is left and wraps. A row too narrow for all of it wraps onto a second line before anything is cut. In a row, the progress block is its label, its bar and its value on one line. A badge is as wide as its words, and only words longer than the whole line wrap. A row standing on its own is a card with the panel's corners. Inside a list of rows it is a line with a hairline under it. Measured on the org app at 390×844, in Chromium, WebKit and Firefox and in both schemes, "Lv 3" and "3 of 5" are whole on both faces, where they were cut on both before.
  
  Compatibility: `.graview-spec-row` is no longer a capsule: no `border-radius: 999px`, no `white-space: nowrap`, no `overflow: hidden`, and its children no longer carry `text-overflow: ellipsis`. `.graview-spec-badge` no longer clips with an ellipsis. A host stylesheet that relied on a row staying one line must allow it to wrap. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- 6ac06de: The READMEs say what this release adds, where a stranger looks first. `@graview/core`'s says a derived `edit-<kind>` takes only the fields it offers and refuses with an `ActRefusal`, a document's number ranges and its acts' `replaces` and `setsOther`, and the address helpers `addressOf`, `pathWithin` and `basePathOf`. `@graview/pages`'s says how a host that keeps its own history drives the routed face (`basename`, `onNavigate`, `path`). `@graview/primitives`'s says a coverage cell selects what it joins, and the one rule for what looks pressable: a capsule is a choice or a state badge, the places are tabs, and a name is never cut where it is the thing to read.
  
  Compatibility: unchanged; only the READMEs changed.
- Updated dependencies [f842422]
- Updated dependencies [fc42f1e]
- Updated dependencies [860223c]
- Updated dependencies [1e7eba5]
- Updated dependencies [0cee289]
- Updated dependencies [3f02759]
- Updated dependencies [5a236ea]
- Updated dependencies [cc50785]
- Updated dependencies [45842b7]
- Updated dependencies [8c43964]
- Updated dependencies [63dfe90]
- Updated dependencies [b8c4527]
- Updated dependencies [ab91f13]
- Updated dependencies [b9435aa]
- Updated dependencies [05b0a95]
- Updated dependencies [6ac06de]
- Updated dependencies [bd69456]
  - @graview/core@0.1.14
  - @graview/react@0.1.14
  - @graview/layout@0.1.14
  - @graview/tools@0.1.14
  - @graview/render@0.1.14

## 0.1.13

### Patch Changes

- 2b05a64: A status board's column says the lens it is in (FR-109). Each column is a region, and its accessible name now starts with the lens's title: a column of "Vendors by status" is announced "Vendors by status · Researching, 0" where it was "Researching, 0", so a screen reader on a phone, which reads a region by its name alone, says which board a column belongs to. An embed names every landmark inside it after itself ("Views wedding · …"); a column marked `data-graview-named-by-lens` already says which picture it is in, and the embed leaves its name as it is, so the column is not "Views wedding · Researching, 0". The title is the declared lens's `title` on both faces, and "Board" for a columns lens registered without one. `verify-declared` asks each column by its role on both faces, at a desk and a phone, in both schemes.
  
  Compatibility: unchanged for stored data, ops, tool schemas and the wire. A test or a host that found a column region by its old name ("Todo, 2") finds it by the new one ("The board · Todo, 2"); `data-graview-column` is unchanged. Every other landmark in an embed is still named after the embed. `capabilities().shipped` gains `FR-109`.
- 8bc3c59: A named step is a move on a status board (FR-108). An act that sets the board's field to a value of its own — `book` setting `status` to `"booked"`, `mark-fixed` setting it to `"fixed"` and stamping `fixedOn: $today` — is now offered as the move to that value's column, called with the record alone, and run as declared, so everything it also records is recorded and one undo takes it all back. It is offered only where the seat may run it (`store.permits`) and where it would run for that card: the call is compiled against the graph without being applied, so its `allowedWhen` is judged by the rule language under its budget, and a refusal is no move. A step that needs more than the record (a reason, a date, another record) is not offered. Where a named step reaches a column, only named steps do: the step wins over a free `set-<field>` act told the value, and where the step's condition does not hold for a card the free act does not stand in for it, so a drag never skips a guard. A free act still reaches the columns no step does. In Cloud's vendor shortlist without `set-status`, a researching vendor offers Contacted (by `mark-contacted`), Booked (by `book`) and Declined (by `decline`), and a declined one offers only Contacted (by `reopen`); in the bug bash, a move to Fixed stamps `fixedOn`. A mutation carries the constants it sets on its subject as `sets` (`{ status: "fixed" }`), worked out from a document act's `sets` and declared by a TypeScript one as it declares `writes`. `columnReach` (from `@graview/core/describe`) says which acts reach which column for any seat, and `columnSteps` lists a field's named steps. `graview describe` says it column by column ("moves a vendor to Contacted by "Mark as contacted" or "Reopen", to Booked by "Book" and to Declined by "Decline" … Nothing moves a vendor to Researching from the board."), `describePlace` says the moves one seat's board offers ("Moves: to Contacted by "Mark as contacted"; …", or "Moves: none for this seat."), and `graview check` notes `lens-column-unreached` at the binding when some of a board's columns are reached by no act. The `graview-lens` skill says so.
  
  Compatibility: unchanged for stored data, ops and the wire. A board offers more moves where a declaration has named steps: an act that sets the column field to a constant, which FR-97 never offered, now moves a card, and a free `set-<field>` act no longer reaches a column a named step reaches. `MutationDefinitionSpec` gains an optional `sets`; a declaration without it reads as before. `columnActs` still lists the free acts. `@graview/core/describe` gains `columnReach` and `columnSteps`, and `graview check` gains the note `lens-column-unreached`. `capabilities().shipped` gains `FR-108`.
- Updated dependencies [2b05a64]
- Updated dependencies [8bc3c59]
- Updated dependencies [4d3c1f9]
- Updated dependencies [ed5444b]
  - @graview/core@0.1.13
  - @graview/react@0.1.13
  - @graview/layout@0.1.13
  - @graview/render@0.1.13
  - @graview/tools@0.1.13

## 0.1.12

### Patch Changes

- 4801c44: What only a fetched face, an agent's seat or the checker uses has left `@graview/core`'s main entry and `@graview/core/document` for subpaths named for what they hold, and the hosted page has room again. A hosted page imports both barrels up front. esbuild gives a whole file to every chunk that can reach it, so a name a barrel re-exported rode in the page's first chunk as soon as any lazily loaded face used it, though the page never called it before a reader acted. Measured from esbuild's metafile, three moves were each worth more than 2 KB. The first is `@graview/core/blocks`: a view's blocks resolved against a record, and the computed values they read. It took 8.3 KB off. The second is `@graview/core/check` with `@graview/core/scene`. The checker was reachable from both barrels: `checkApp` from the main entry, and `compileDocument` beside the compiler a page uses. Through it the page reached the city, which only the scene draws. The checked compile and template instantiation are now modules of their own, so the compiler a page uses no longer imports the checker. This took 2.6 KB off. The third is `@graview/core/figures`, the shipped drawings, which took 2.8 KB off. The page now loads 575 357 bytes up front (562 KB), where it loaded 589 079 (575 KB). Cloud's own shell, built from these sources, is 560.3 KB, where it was 573.7. The budget claim is now 572 KB: the new figure with 10 KB of headroom. The embed without the studio now loads 692 174 bytes first, where it loaded 787 572. The studio, fetched only when it is drawn, asked for `checkApp` through `@graview/core`, so the checker and the document compiler it reaches rode in the frame's first chunk. Its budget comes down to 693 500. A test names every moved export and holds it off both barrels, and the hosted page's test holds the modules themselves out of what it loads first. Some levers were measured and left alone because each was under 2 KB: `formFields` and the rest of the act form (1.8 KB), `beginning` (1.7 KB), the JSON Schema helpers (1.3 KB) and `walkKinds` (0.3 KB). zod's JSON Schema writer (20 KB) stays up front. `zod/mini`, which the page needs, re-exports `toJSONSchema`, so no subpath of ours can put it out of the page's reach while the companion's act tools use it.
  
  Compatibility: these exports moved, with no alias left behind. From `@graview/core` to `@graview/core/check`: `checkApp`, `formatFindings`, `describeApp`, `generateAgentsMd`, `generateLlmsTxt`, and the types `CheckResult`, `Finding` (the checker's), `Severity` and `DescribeOptions`. From `@graview/core/document` to `@graview/core/check`: `compileDocument` and `instantiateTemplate`. `compileDocumentWithoutCheck` stays in `@graview/core/document`. From `@graview/core/document` to `@graview/core/blocks`: `compileBlocks`, `fieldSpecsOf`, `isTallBlock`, `resolveBlocks`, `safeHref`, `sayNumber`, `computedNames`, `computedValues`, `withComputed`, and the types `BlockContext`, `ResolvedBlock`, `ResolvedList`, `SpecBlock`, `ComputedRecord`, `ComputedValues` and `PlainComputed`. From `@graview/core` to `@graview/core/scene`: `BLOCK`, `cityExtent`, `cityMap`, `heightOf`, `MAX_SIDE`, `plotsOverlap`, `roadsOf`, `sharedEdges`, `sideFor`, `toIso`, `villageCap`, `villageOf`, `sceneDistricts`, and the types `Building`, `CityHints`, `CityMap`, `Plot`, `Road`, `SceneDistrict` and `SceneDistrictOptions`. From `@graview/core/document` to `@graview/core/scene`: `sceneThumbnail`, and the types `SceneThumbnailOptions` and `ThumbnailSource`. From `@graview/core` to `@graview/core/figures`: `FIGURES`, `FIGURE_NAMES`, `figureBrief`, `figureFaults`, `figureSvg`, and the type `Figure`. `@graview/primitives` still re-exports `compileBlocks`, `safeHref`, `sayNumber` and `SpecBlock`. A project made by `graview create` imports `checkApp` and `compileDocument` from `@graview/core/check`, and a linked one aliases the four new subpaths. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [4801c44]
  - @graview/core@0.1.12
  - @graview/layout@0.1.12
  - @graview/react@0.1.12
  - @graview/tools@0.1.12
  - @graview/render@0.1.12

## 0.1.11

### Patch Changes

- e6594bb: A status board: a shipped `columns` lens (FR-97). `{ "name": "columns", "title": "The board", "bindings": { "task": { "column": "status" } } }` draws a kind's records in columns by one choice field, in the order the field declares its choices, each record by its own card (the kind's card spec, or the default card) and each a link to its record. When the field may be left empty, a last column holds the records with no value ("No status"), shown only while something is in it. A card moves to another column only by an act the declaration already has: one that writes the field (`writes`, read as the checker reads it, so the kind's derived edit counts when nothing else writes it), stands on the record's kind and can be told the value under the field's own name, and that the store says this seat may run (`store.permits`). "Finish", which sets the status and takes no value, moves nothing. The move runs that act as the seat, through the store, so it is in the log under the seat's name and one undo takes it back; the board says what it did and offers its own Undo. It moves by the keyboard (each card's Move button opens the columns it may go to, arrows between them, Enter to move, and the keyboard stays with the card) and by a drag onto a column. A seat with no such act is offered no Move button and no drag. The seat's sight applies to the cards and to every column's count. The factory is fetched with the other lenses when a lens is first drawn; a hosted page carries 343 B more up front, the lens table's new entry and the reason a board on a field that is not a choice does not draw. `statusColumns`, `columnOf`, `columnMoves` and `columnActs` are exported from `@graview/core/describe`, beside `describePlace`, so the picture, the describer and `graview describe` read one answer. `graview check`, `graview describe` and `placesOf` know the lens by name; `describe` says which acts move a card, or that none does. `describePlace` says a board as its columns in order, each a heading with its count and its records by their cards, for the seat it is asked for. `add-lens` holds a board's bindings (a kind, and a field of it that is a choice) and refuses others at the binding's path; a rename of the kind or the field follows into the bindings, removing the kind removes the board, and removing the column field is refused, naming the lens. The `graview-lens` skill shows the declaration. `verify-declared` draws a board on both faces at 1440×900 and 390×844 in both schemes, moves a card by the keyboard and undoes it, drags one, and finds a viewer without the act offered no move and only their own tasks counted.
  
  Compatibility: unchanged for stored data and the wire. The declaration gains a lens name, `columns`; a document that did not use it compiles and checks as before, and a titled lens named `columns` that once drew nothing (`lens-not-shipped`) now draws, or says `lens-cannot-draw` at its binding when its column is not a choice. `add-lens` refuses a board whose bindings cannot draw. `capabilities().shipped` gains `FR-97`. Ops and tool schemas are unchanged.
- e567a7b: Currency on any money (FR-100). A field shown as money takes a `currency`, as a figure already did, and the app's own currency applies wherever a block names none: a figure or a field shown as money, and a template's `{x | money}` (in a card, a kind's `label` and `describe`, a rule's sentence and an act's refusal). Its one home is the brand: `brand.currency` and `brand.locale` in a document, where a `brand` may now carry them without an `accent`, and `Brand.currency` and `Brand.locale` in a declaration. Money is written by `Intl.NumberFormat` in the brand's locale ("en-US" when it names none): LifeLogics declares `"brand": { "currency": "USD" }` once, and its package card's field and its row's figure both say "$21,000"; with `"currency": "EUR", "locale": "de-DE"` they say "21.000 €". The faces hand `resolveBlocks` the brand they are dressed in, and `describePlace` the app's, so what is drawn and what is described agree. `set-brand` sets the colours and the money apart (`currency` and `locale`, `null` to clear) and says each, `diffDocuments` says "Money is said in EUR, written for de-DE." apart from "The app's colours change.", a rename keeps a block's currency, and `toDocument` carries a declaration's currency and locale across. `graview check` refuses a currency that is not a three-letter code (`brand-currency`) and a locale it cannot write for (`brand-locale`). `formatMoney` is exported from `@graview/core/document`. The braces warning of FR-99 is asked with the checker (`compileDocument`, `checkApp`) and not by a page that compiles without it, so a hosted page does not carry it. The `graview-brand` skill says how to declare the app's money. `capabilities().shipped` names FR-100.
  
  Compatibility: additive within `graview-document@1` and to the check finding codes. `brand.currency` and `brand.locale` are new optional keys, `brand.accent` becomes optional (a brand of money alone keeps Graview's colours), and a field block's `currency` is new; a document without them says every sum as it did, except that a document whose brand names a currency now says `{x | money}` and a figure or field shown as money with its symbol. `Brand` gains optional `currency` and `locale`, `BlockContext` and `RenderContext` gain an optional `money`, `sayNumber` an optional fifth argument, and `MutationDefinitionSpec` is unchanged here. The `set-brand` edit's `accent` becomes optional beside `currency` and `locale`, and it now says a sentence for the wordmark it sets. `brand-currency` and `brand-locale` are new error codes that judge only the new keys. The wire: `capabilities().shipped` gains `FR-100`. Ops, stored formats and tool schemas are unchanged.
- a190947: The hosted page has room again, and says what it weighs (FR-104). Graview Cloud's shell is `openRemote` plus the embed over a compiled document. With the columns lens, template labels, currency, walks from a set and the hidden-kind check landed (FR-97 to FR-101, FR-105), it loaded 611 900 bytes (598 KB) of framework before the app drew, against the 600 KB Cloud's brief set. Every new face feature pushed Cloud's budget test over. Measured from esbuild's metafile, 73 KB of what the page loaded up front was code that only a lazily loaded face uses. esbuild gives a whole file to every chunk that can reach it, and the page reaches files through an index. Two levers cut it to 589 079 bytes (575 KB). The first is the theme sheet. It was one stylesheet that the frame of every face drew, and a third of it named only what the scene draws: the districts from altitude, the plots, the village, the roads, the billboards and the bands. Those 87 rules are now `sceneCss` in `@graview/primitives` (and `@graview/primitives/scene`). The scene face draws them after the frame's `themeBaseCss`, inside the embed's box, so a page on the pages face carries none of them. `themeCss` is still the whole sheet: the base, then the scene's rules. That moves the scene's rules after the others, and a test holds that no rule was lost or doubled and that each one names something only the scene draws. This took 15.5 KB off the page and 17.5 KB off the pages face before it draws, and left the scene face unchanged. The embed's own bundle budgets come down with it: the pages face alone is now 495 604 bytes, where it was 511 391, and the embed without the studio is 787 572, where it was 810 223. The second is the frame's `useWidth`, `VISUALLY_HIDDEN` and `descentTarget`, which now come from files of their own. The frame no longer reaches the primitives' index or the scene's way back, which is 6.8 KB more. Cloud's own shell, built from these sources, is 596.0 KB on main and 573.7 KB with this change. The budget claim is now 585 KB: the new figure with 10 KB of headroom, 25 KB under Cloud's 600. `pnpm hosted` also writes docs/hosted-page.md, the weight by package as a table with the headroom and each face's figure before it draws. It also says what the first chunk needs for itself: 509 KB, measured with every door shut. The release step measures the page again and puts the same table under the `graview` and `@graview/embed` GitHub releases. What remains up front that only a door uses is mostly zod's JSON Schema writer (20 KB). It is reached through zod's own index and used by the companion's act tools. The rest is parts of `@graview/core` files reached through its index.
  
  Compatibility: `@graview/primitives/frame` exports `themeBaseCss` in place of `themeCss`. `@graview/primitives` exports `themeCss` as before, and adds `themeBaseCss` and `sceneCss`. Within `themeCss` the scene's rules come after the rest. Each rule weighs what it did, and a harness found no change. `capabilities().shipped` gains `FR-104`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [e6f90e0]
- Updated dependencies [e6594bb]
- Updated dependencies [fc50abf]
- Updated dependencies [31a6383]
- Updated dependencies [617b432]
- Updated dependencies [a738797]
- Updated dependencies [e567a7b]
- Updated dependencies [a190947]
  - @graview/core@0.1.11
  - @graview/layout@0.1.11
  - @graview/react@0.1.11
  - @graview/render@0.1.11
  - @graview/tools@0.1.11

## 0.1.10

### Patch Changes

- 39a3983: The activity tells a call's chips apart by the argument, not by what it says: a piece of kit whose id and type were both `trailer` was two children with one key, and React warned "Encountered two children with the same key" in every product that seeded one. A read that came to the same record by two edges shows it once.
- 7d77ff7: A call read through a `Door` keeps its own `as`: when the gate dropped an earlier call the app does not know, the names were read back from the answer by position, so a later call took the dropped call's name and the call after it took that one's, and a `{ $plan }` reference pointed at the wrong node.
- 6b7edf9: A declared lens draws (FR-79). A document's `lenses` were accepted and drew nothing, and so were a TypeScript app's: a lens drew only because the app's own UI called `createTimelineLens(…)` and registered the result with a title, so a chat that wrote a lens into a document made something nobody would ever see. A `lenses` entry now takes a `title`, an `on` (the kind it stands on, when its bindings do not say) and data-only `options`, and a shipped lens with a title is a place: a pill on the bar, a drive-in from altitude and a page at `/places/<as>`, registered over each kind it stands on at many × full and many × summary. `declaredLenses(app)` in `@graview/core` decides which lenses draw, with which factory options resolved from the bindings, and why the rest do not; `SHIPPED_LENSES` names the six it maps — `timeline`, `calendar`, `coverage`, `board`, `plan`, `reach` — with their roles and the options each takes. `registerDeclaredLenses(registry, app)` in `@graview/primitives` (and `@graview/primitives/frame`) registers each as a door to the shipped factory, fetched when a lens is first drawn (`fetchDeclaredLenses`), and `declaredViews(app)` is the defaults, the view specs and the declared lenses in one registry. The embed calls it for every app it mounts, so a document's lenses draw with no views at all. What a factory needs that cannot be data is derived: a timeline's columns from the values its `column` field takes (or `options.columns`), its axis words from its extent, a calendar's `today` from the reader's own clock unless `options.today` names one. `graview check` says why a titled lens cannot draw, at its path — `lens-cannot-draw`, `lens-option-unknown`, `lens-title-taken`, `lens-not-shipped`, every one a warning — and a shipped lens needs no `requiredRoles` or `binds` of its own (`requiredRolesOf`, `bindsOf`). `plan` joins the shipped names in the checker and in `graview describe`, which now says which declared lenses draw, over what, at which address, and why a titled one does not. `placesOf(app)` lists every place an app has — the home, each lens, each kind — as `{ slug, title, kind, cardinality, address, stop, lens?, hidden?, first? }`, for a host to list. Apps/todo, apps/rota, apps/gauntlet and apps/discography declare their shipped lenses with titles and register none of them by hand. The studio keeps two lenses of one name apart by their titles. `@graview/primitives/scene` is a new subpath (the companion, the inspector, the places bar), which the embed's scene face and the pages' assistant import so that a face which draws no lens does not carry the six factories; `@graview/primitives/pages` also exports `registerDefaultViews` and `registerViewSpecs`. The bundle budgets for every face and for the studio handed in rise to 1_400_000 / 412_000, and what a page without the studio loads first to 203_000 gzipped, said in `scripts/lib/bundle-budget.mjs`, which now measures from the page's own entry rather than the first chunk esbuild lists. A hosted page carries 563 KB up front. Unit tests compile a document declaring one lens of each shipped type and find each drawn by its title on the embed's bar and at its page, `check` and `describe` agreeing with the one list; `verify-declared` does it in a browser. The `graview-lens` skill says to declare a shipped lens rather than register it. `capabilities().shipped` names FR-79.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `title`, `on` and `options` are new optional fields of a `lenses` entry, and `requiredRoles` is optional on `LensDeclaration`. The new codes are warnings, never errors, and a declaration that checked clean before still does; a check's `where` names a titled lens by its title. The wire — `capabilities().shipped` gains `FR-79`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `arrange` and `arrangement`, so a hand-built registry needs neither.
- cbe1cc6: A `Door` reads a node named by its label as that node, as the seat does: a pasted or locally asked answer naming "Back Lawn" where an act wants a zone is handed on with the zone's id, where exactly one zone carries that label. A label two nodes share, and a `{ $plan }` reference, are left as they came.
- 77a9fdc: A home view from the closed block set (FR-81). The home was always derived, and a document that wrote `views.home` was refused. A declaration's `home` — a document's `views.home`, a list of blocks — is now the home's body on both faces: on the routed face it replaces the derived home under the shell, its first headline the page's `h1`; on the Graview face it stands as a landing over the picture whenever the scene is at home (nothing focused, nothing chosen), at ground level and from altitude, on the side the companion leaves free, put away by going anywhere or by its own button (`HomeLanding` in `@graview/primitives` and `@graview/primitives/scene`, drawn by `Shell` and the embed's scene face). An empty graph still opens on the way in: the home view yields to the beginning until there is a record to show. Three blocks join the set, and work in a card, a row and a page as well as the home: `headline` (a template), `figure` with an expression (`{ figure: "sum(all('package'), net)", as: "number" | "money" | "percent", currency: "USD", label }`; `{ figure: true }` is still the kind's picture), and `list` (`{ list: expr, sort: key | { by, direction: "asc" | "desc" | "choices" }, limit, group: field | { by, headings }, empty, as: "card" | "row" }`), which draws each record with its own card or row spec and makes it a link — a record's address on the routed face (`SpecLinks`), a pick on the scene. Blocks about no one record may not name a bare field and reach records with `all('kind')`; a list's sort key and group are held to the kinds its source reaches. A lens named `blocks` with a title, an `on` and `options.blocks` is a place drawn from the same blocks, so a chat can write a picture with no code (`SHIPPED_LENSES.blocks`). The registry carries the home view beside the places (`registry.home(view)`, `registry.homeView()`), set by `registerDeclaredLenses` and fetched when first drawn (`fetchHomeView`); `graview describe` says the home is drawn from blocks, and the document diff says when the home's look changes. FR-83's gap closes: a kind's `glance` may name a computed field (the card and the list line work it out over the seat's graph), and a `label` or `describe` may name one worked out from the record alone — one that reads beyond the record is refused, since a label is said with no graph in hand. `packages/core/tests/document/fixtures/lifelogics.gdd.json` rebuilds LifeLogics' front page and its four lenses as data; unit tests draw it, and `verify-declared` draws it on both faces at 1440×900 and 390×844 in both schemes. The `graview-pages`, `graview-node-kind` and `graview-lens` skills say how. The bundle budgets rise with measured numbers in `scripts/lib/bundle-budget.mjs`: an embed without the studio to 815_000 / 215_000 (measured 802_562 / 209_988), every face and the studio handed in to 1_430_000 / 424_000 (measured 1_420_964 / 418_572 and 1_414_220 / 413_619); a hosted page carries 584 KB up front, and a face before it draws at most 840 KB (the scene measured 836_810, from 817_424). `capabilities().shipped` names FR-81.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `views.home` as a list of blocks, the `headline`, `list` and expression `figure` blocks, and the `blocks` lens are new; `views.<kind>` as an object of slots reads as before, so a kind called `home` keeps its views. A titled lens named `blocks` was a warning before and draws now; what its blocks cannot say is a warning at its path, never an error. A `label`, `describe` or `glance` naming a computed field was an error and is now accepted where it can be said. New codes (`list-sort`, `list-group`, `list-limit`, `list-as`, `list-empty`, `view-currency`) are errors only on blocks that could not compile before. The wire — `capabilities().shipped` gains `FR-81`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `home` and `homeView`; `RenderContext` an optional `budget`.
- 6809372: A place is described without a browser (FR-89). `describePlace(store, principal, place, { app, width })`, from the new entry `@graview/core/describe`, says what one place shows one seat. The place is `"home"`, a `placesOf` slug, or a record's id. The description gives its headings, its figures as drawn ("$21,000"), its lists with each record's title and what that record's card or row says, the headings a list is grouped under, what an empty list says, and every block that could not be worked out, at its path (`views.home.3`, `lenses.1.options.blocks.0`). It comes back as structured data and as plain text. It reads the seat's own graph (`store.seenBy`), so a partner is told of exactly the offers the partner's face lists. It has an entry of its own because a page imports `@graview/core/document` up front and a bundler places a module by what can reach it; only an agent's seat reaches `@graview/core/describe`, so a hosted page carries 593 KB up front (606,889 B, under its 600 KB budget). It is not a second renderer. What a block says is now worked out once, in core, by `resolveBlocks`, and `@graview/primitives`' `SpecBlocks`, `SpecPlace` and the list, card and row specs only draw what it resolved. `compileBlocks`, `safeHref` and `sayNumber` move to `@graview/core/document`, and primitives re-exports them. A unit test draws the LifeLogics front page and its four lenses at 390 for an owner and for the delivery partner, and holds the drawn words, the listed records and their order equal to the description's. A kind without a card spec is said as the default card (title and glance), and one without a row spec by its title. A shipped picture lens is said as what it is over and the records it draws. Width changes layout, not content, today, and the description says which: `variant` is `"phone"` under 640 and a card list's `columns` is one at 390. The agent surface gains `describe_place`, read-only and seat-scoped, served by `graview mcp`. It counts the records it names as reads. Hand the runtime the app (`createToolRuntime(store, { app })`, `createMcpHttpHandler({ app })`); without one it still says a kind's list, a record and the derived home. `graview describe <entry> --place <slug|id> [--seed <snapshot.json>] [--width <px>] [--as <role>] [--id <who>]` prints the same text. A rename now leaves a field's own `label` as written ("List price, per unit" had become "Price price, per unit"). A LifeLogics test renames `offer` to `item` and `list` to `price`, and every place, for both seats, then says exactly what it said before. A linked project made by `graview create` aliases the new entry. The `graview-agent-seat` skill says when to ask. `capabilities().shipped` names FR-89.
  
  Compatibility: derived tool names and input schemas gain one read tool, `describe_place`, for every seat. A host that compares `surfaceHash` sees the surface move once. No act's tool changes. The declaration and check finding codes are unchanged: `resolveBlocks` is a new export of `@graview/core/document`, `@graview/core/describe` is a new entry in core's `exports`, and a field's `label` is no longer rewritten by `rename-field`. The wire: `capabilities().shipped` gains `FR-89`. Ops and stored formats are unchanged. `ToolRuntimeOptions` and `McpHttpOptions` gain an optional `app`, and primitives' `SpecContext` now extends core's `BlockContext`, which adds an optional `schema`.
- fff6319: A `PlanReview` names its parts: each row is `data-graview-part="plan-row"`, and the presses are `plan-decline`, `plan-apply` and `plan-discard` inside `plan-actions`. The struck-through row and the presses' size moved from style attributes to rules an app's own selector outranks, so a product dresses its review without `!important`, and with no sheet of its own the review looks as it did.
- 77a9fdc: A view can list related records (FR-82). A to-many walk in a block flattened to "A, B and C" or a count, and nothing could draw each related record or link it. The `list` block now takes a walk from the record as its source in a card, a row or a page — `{ list: "out('includes')", as: "row" }` on a package's page lists its offers, each drawn with the offer's own row and each a link; `{ list: "in('answers')" }` on a note's row lists the offers that answer it. A row that lists records or says a figure is drawn as a block rather than a one-line pill. The list reads the graph the view is handed, which for a seat is what that seat may see (FR-55): a related record it may not see is not listed, not counted in "and N more", and opens no group heading of its own, and a list left with nothing says its `empty` words. Lists nest at most three deep (`MAX_LIST_DEPTH`); past that a list says its records' names, each a link, so a card that lists records whose cards list records — round a loop or down a long chain — always ends, and every expression keeps its own step budget. `graview check` holds a walked list's sort key and group to the kind the relation reaches, and refuses a walk along a relation no kind declares. Unit tests draw the LifeLogics document for an owner and for a partner who sees only the offers their firm delivers, and find the partner's package page, note rows, home counts and group headings saying nothing of the rest; `verify-declared` follows a listed record on both faces. `capabilities().shipped` names FR-82.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: a walk is a new source for the new `list` block, and nothing that compiled before reads differently. The wire — `capabilities().shipped` gains `FR-82`. Ops, stored formats and tool schemas are unchanged.
- 6852b7d: `pages` is a real arrangement (FR-80). A document's `pages` was accepted and never compiled, and an app had no way to say what its home shows first or where it opens. `pages: { order?, hide?, first? }` (`PagesArrangement`) is now typed, compiled onto the app, given back by `toDocument`, and honoured on both faces. `order` names kinds in the order the routed face's gallery and nav and the city at altitude take them (`orderKinds`); kinds it leaves out follow as declared. `hide` takes kinds off the home only — their cards and counts — and a hidden kind keeps its list, its records, its place in the nav and its search results. `first` names where the app opens: a place by its title or address word, a kind by its name or plural, or `"home"` (`openingOf`). The routed face opens there once, replacing the arrival so Back leaves the app, and the masthead still goes home; the scene opens on it when nothing else was asked (`openingView` in `@graview/react`, which the provider and the embed use). The arrangement travels on the view registry beside the places (`registry.arrange(pages)`, `registry.arrangement()`), set by `registerDeclaredLenses` and carried by `layerViews`, so every face that reads the places reads where they go. `graview check` names a kind in `order` or `hide` that is not there and a `first` that is no place, kind or home — `pages-kind-unknown`, `pages-first-unknown`, warnings at their paths — and `graview describe` says where the app opens, the order and what the home leaves off. Removing a kind in the document editor takes it out of `order` and `hide`, and renaming one renames it there. Unit tests compile a document that orders three kinds, hides one and names a lens first, and find it opening on that lens on both faces with the home in that order and the hidden kind reached by link and by search; `verify-declared` holds the same in a browser. The `graview-pages` skill says how. `capabilities().shipped` names FR-80.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `pages` was any object and is now one whose `order`, `hide` and `first` are typed; other keys are still accepted, so a document that compiled before still does. The new codes are warnings. The wire — `capabilities().shipped` gains `FR-80`. Ops, stored formats and tool schemas are unchanged.
- 7307a0c: The rule language computes what pages need, still total and budgeted (FR-83). LifeLogics draws its proposal in code: a package's price is the sum of list × units over its offers less the client's discount, the package it leads with is the recommended one else the top by standing and then price, and an offer's card says "Answers three of the things we heard". A chat could say none of it as data: `sum(S, field)` took a field's name and not an expression, nothing picked one record or put a set in order, a value that depended on another record could not be named once, and a template had no number words and no way to join a list.
  
  `sum`, `min` and `max` now take an expression per member, read with the member as its subject: `sum(out('includes'), list * units)`; a bare or quoted field name still names a field. `sort(S, key, 'asc' | 'desc')` puts a set in order (`'asc'` when unsaid) by a key each member gives. A list key sorts by its first value and then its next, nothing sorts last whichever way, and keys that cannot be compared are a sentence. `first(S)` is a set's first record, or nothing, so `first(sort(…))` picks one. `either(a, b, …)` is the first that is something, which is how an expression says "else". A sort pays for its keys and its comparisons from the budget before it makes them.
  
  A kind declares values it works out rather than stores: `computed: { net: "<expr>" }` on a document's kind (or `{ expr, label?, description? }`), and `defineNode({ computed })` in TypeScript (`ComputedField`). Every expression reads one like a stored field, so templates, view specs (a `field` block shows one, under its label), rules, sums and sorts do too. A computed field may read another. Each is worked out once per evaluation, from that evaluation's budget, so one read inside a template spends the template's 500 steps. Its own expression sees the record's fields and never an act's arguments. A cycle the check cannot see, across kinds through a relation, stops as a sentence ("depends on itself") when it is read. A computed field is never stored, never in the op log and never writable. No derived edit or act tool takes one, and an act that sets one is refused as `computed-written`. `computedValues(schema, graph, node)` in `@graview/core/document` says a record's computed values as plain data, a record named by one as `{ id, kind, label }`, and the ones it could not work out with why. `withComputed` lays them beside the stored fields for a surface that shows facts. A record's page lists them among its facts (`recordFacts`). `get_node` returns them as `computed`, marked as their authors' words, and its description says they are read-only. `graview describe` lists them under "Worked out" with their expressions. `toDocument` writes a declared kind's computed fields back as data.
  
  What a seat is served is worked out from what it may see (FR-55). A computed value is evaluated on demand over the graph the reader holds, and every seat reads through `store.seenBy(principal)`: the provider, the pages, `get_node`. So a hidden record adds nothing to a sum, wins no sort and is never the record a value names. A partner who may not see the client is served a package's price before the client's discount and learns nothing of the discount from it.
  
  `graview check` judges computed fields in a document and a declaration alike. It reports a name that is already a field or relation (`computed-clash`), one that is not a name (`computed-name`), an expression that does not parse or names nothing the kind has (`expression`, `computed-name`, `computed-edge`, `computed-kind`, `unknown-function`), and a cycle among a kind's computed fields, named in order (`computed-cycle`). It also says how a read's work grows with the graph, as a power of its size: a sweep read once for each member of a sweep is a warning, and work that grows with the cube is refused (`computed-cost`).
  
  Templates gain three formatters: `words` spells a whole number to ninety-nine ("three", "forty-five"); `and` joins a set or a list ("Workshop, Build and Advice"); and `plural: 'offer'` is the noun for a count, with the plural given where English does not make it (`plural: 'person', 'people'`). A formatter is read after the last bar outside quotes, so `{'a|b'}` and `{x || y}` are expressions again. A record in a sentence is called by its name, title or label, before its id.
  
  A test builds a document shaped like LifeLogics' (`packages/core/tests/document/fixtures/proposal.gdd.json`): parties, notes, offers with list and units answering notes, packages including offers, recommended and standing. A package's `net` is one declared expression, the package the client is led with is one declared expression, and the offer card's "Answers three of the five things we heard" is one template. They are judged by a rule, sorted on, summed across a relation and drawn on a card. The partner's card, record page and `get_node` are each worked out without the client's discount and without the client. A cost greater than the cube is refused at check time, and at run time a computed field over 3,000 offers stops within its budget, as a sentence. The `graview-invariant`, `graview-node-kind` and `graview-pages` skills say how. The embed's budgets rise by about 13 kB minified and 5 kB gzipped for it. `capabilities().shipped` names FR-83.
  
  Compatibility: the declaration — additive within `graview-document@1`: `kinds.<kind>.computed` and `defineNode({ computed })` are optional, and no document or declaration that compiled stops compiling or changes meaning; the new check codes (`computed-*`) appear only on a declaration that declares computed fields. The rule language gains `first`, `sort` and `either`, and `sum`/`min`/`max` accept an expression where a field name was required; every expression that parsed before means what it meant. Tool schemas — `get_node`'s description changes for every declaration (it says computed values are read-only) and its answer gains `computed` and `uncomputed` when a kind declares them; no input schema moves. The wire — additive: `capabilities().shipped` gains `FR-83`. Ops and stored formats are unchanged.
- Updated dependencies [6b7edf9]
- Updated dependencies [4ae597b]
- Updated dependencies [f9d5951]
- Updated dependencies [c3e2c1d]
- Updated dependencies [77a9fdc]
- Updated dependencies [6809372]
- Updated dependencies [03733a0]
- Updated dependencies [77a9fdc]
- Updated dependencies [3047796]
- Updated dependencies [d4cab17]
- Updated dependencies [58f71f9]
- Updated dependencies [2e46ab9]
- Updated dependencies [4c8a2d1]
- Updated dependencies [5703a27]
- Updated dependencies [fc6ddca]
- Updated dependencies [17b908c]
- Updated dependencies [6e3b089]
- Updated dependencies [6852b7d]
- Updated dependencies [7307a0c]
  - @graview/core@0.1.10
  - @graview/react@0.1.10
  - @graview/tools@0.1.10
  - @graview/layout@0.1.10
  - @graview/render@0.1.10

## 0.1.9

### Patch Changes

- b5a4bfc: A host speaks in the app's own notices (FR-75). Graview Cloud said "a newer version is available", "offline — changes will be sent when you reconnect", "held while a repair is checked", a conflict with two choices and a refusal's sentence as elements of its own fixed over the app at `z-index: 1000`, in a copy of the framework's floating panel kept in step by hand. The embed's handle now has `notify({ kind: "toast" | "banner", sentence, tone?, action?, actions?, id?, timeout? })`, and so does `@graview/embed/pages`'s. It returns `{ id, dismiss(), update(change) }`. A toast goes by itself after `TOAST_MS` (six seconds; `timeout` says otherwise and `false` keeps it), unless it carries an action, when it waits for one; a banner stays until it is dismissed. A notice said under an `id` already showing takes its place. `tone` is `info` (the default), `good`, `warn` or `bad`, drawn as the notice's edge and dot in the theme's own colours. An action is a press (`onSelect`) or a link (`href`, `target`), the first drawn as the one the notice asks for, and either closes the notice; every notice has a dismiss control. Banners stand at the top of the picture and toasts at its foot, in the floating panel's look and the embed's scheme. Both are in the browser's top layer on the ladder's toast rung (FR-76), and are shown again over any popover of the family that opens after them (`raiseOverPopovers` in `@graview/react`). Each is said aloud as it arrives through a polite live region, and one whose tone is bad through an alert. `createNoticeBoard` and `Notices` in `@graview/primitives` are the board and its drawing: a React host drawing `<Embed>` passes `notices`, and the whole-page `Shell` takes a board as `notices` and draws it over its scene. This is the framework's reading of a request that arrived cut off at "the embed handle exposes `notify({ kind: "toast" | "banner"`": the sentence, the tone, the action, the id and the handle with `dismiss` and `update` are what the rest of that request most plausibly said, and `warn`, `actions` and `timeout` are added for Cloud's offline banner, conflict card and newer-build notice. A unit test says a toast, sees it said aloud and gone, keeps a banner past a minute and changes it in place, says a bad one as an alert, replaces one by id, presses an action and follows a link, and does it on the pages alone. `verify-chrome` says a banner and a toast through the handle on the embed's Graview face at 1440×900 and 390×844, in light and in dark: both are in the top layer, inside the viewport and on top at their middle, in the floating panel at better than 4.5:1, and said aloud. The toast stands over the profile opened after it, goes by itself while the banner stays and changes in place, a bad one is said as an alert, and a dismissed banner is gone. The `graview-embed` skill says to use it. `capabilities().shipped` names FR-75.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-75`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged. `EmbedHandle` and `PagesEmbedHandle` gain `notify`, so a host's own stand-in for either needs one.
- e811d26: A host's own actions are drawn in the profile menu (FR-72). Graview Cloud had nowhere in the embed for "Change the app", "Your apps" and "Report this app", so it kept them in a `<details>` menu of its own fixed over the corner of the scene. `mount(root, { hostActions: [{ label, href }] })` now draws them in the strip's profile menu, under who is signed in, in the order given: each a link (with `target` where it opens elsewhere) or, with `onSelect` and no `href`, a press; a press of either closes the menu. They are stops for the keyboard like everything else in the menu, which takes the keyboard when it opens (FR-77), and they are drawn in the embed's own scheme. `@graview/embed/pages` takes the same option, and so does the whole-page `Shell`; `HostAction` is exported from `@graview/embed` and `@graview/primitives`. A unit test finds the links in the menu of the whole embed and of the pages alone, in order and reachable, and a press that closes it; `verify-chrome` mounts the embed on a host's page with Cloud's three actions and reaches each by the keyboard alone from the profile button, on the Graview and pages faces, at 1440×900 and 390×844, in light and in dark, at better than 4.5:1 against the menu, with nothing of the host's fixed over the embed. The `graview-embed` skill says to put a host's furniture inside the embed, never over it. `capabilities().shipped` names FR-72.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-72`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
- 4e1d6e3: Every popover opens over everything, and everything else stands on one ladder (FR-76). On a hosted app the profile menu opened under the seat's rail and could not be read: each surface picked its own `z-index` in one stacking context, the profile and the problems 20, the rail 40, the altitude control 5, the zoom 8, a menu 60, the studio 100. Now the transient surfaces — the profile, the problems, the activity, the Find box's suggestions, the districts a row could not hold, a card's acts at the pointer, `ChatPanel`'s pill and the studio's own seat — are shown with `showPopover()` in the browser's top layer, which Playwright's Chromium, WebKit and Firefox all have: drawn over every rail, the scene and anything on a host's page, whatever `z-index`, `overflow: hidden` or `backdrop-filter` their ancestors carry, and still inside the element they opened in, so an embed's scoped theme reaches them and nothing lands on the host. In the top layer a pane is placed by what opened it (`useTopLayer` and `placePane` in `@graview/react`): under it, or over it where there is more room above, kept to the viewport, and no taller than the room it has, so what it holds scrolls inside it. Where `showPopover` is missing the pane stands on the ladder's popover rung. Everything that stays on screen takes a named rung from one ladder written once in `@graview/core` (`LAYERS`, `layer(name)`): scene, overview, rail, popover, dialog, toast, which `themeCss` writes on its root or an embed's box as `--graview-layer-<rung>`. The scene's ground is a stacking context of its own, so what orders its plots, cards, lines, figures and zoom (`SCENE_LAYERS`) can never climb over a rail. `POPOVERS` in `@graview/react` names every popover in the family with what opens it and its pane. A test reads every source file of every package and finds no `z-index` written as a number outside the ladder; `verify-chrome` opens every popover of the registry on the embed's Graview and pages faces and on the Shell, at 1440×900 and 390×844 with the seat open, and finds the pane in the top layer, inside the viewport, and under the browser's own `elementFromPoint` at its middle and at its last row. `capabilities().shipped` names FR-76.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-76`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
- 7597e22: Every popover behaves as one family (FR-77). Each had its own habits: the profile closed on a press outside it, the districts on a pointer down, the menu at the pointer a frame late and the studio's seat only by its own pill; one gave the keyboard back to its button and the next left it on `<body>`; none moved the keyboard in when it opened; and two could be open at once. `usePopover(name)` in `@graview/react` is the one way, and every popover in `POPOVERS` uses it — the profile, the problems, the activity, the Find box's list, the districts, a card's acts at the pointer, `ChatPanel`'s pill and the studio's seat. Opening one closes any other, page-wide. The keyboard goes to the pane's first control, or to the pane, except under the Find box, whose list is a combobox's and keeps the keyboard in the box. Escape closes it and so does a press anywhere that is not the pane, its trigger or a dialog the pane opened (the studio, from the profile), and the keyboard goes back to the trigger — or, for the menu at the pointer, to the card it was opened on — when it was inside the pane or the press left it on nothing. It hangs from its trigger in the top layer (FR-76), turned over when there is more room above and no taller than the room it has, so no row of it is under the viewport's edge; the profile's settings ran past the bottom of the screen. The hook hands the trigger `aria-expanded` and `aria-controls` and the pane its id, `popover="manual"` and `data-graview-popover`; it takes `open` and `onOpenChange` where somebody else holds the state (the provider's menu, the Find box's own rule for its list), `at` and `returnTo` where there is no trigger, and `popover: false` where the same component is part of something else (`ChatPanel` in the seat's rail). A unit test is generated over the registry: every popover closes another when it opens, takes the keyboard in, closes on Escape and on a press outside and gives the keyboard back, and stays open on a press inside. `verify-chrome` holds every popover each face draws to the same, in the browser, on the embed's faces and the Shell, in Chromium, WebKit and Firefox. `capabilities().shipped` names FR-77.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-77`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
- 1aba73e: A host can read Graview's shape, type and block lighting from `@graview/core`, beside `LIGHT`, `DARK` and `hueFor` (FR-73). The radius, the density, the font stacks and the way a block's three faces are lit lived only as numbers inside `themeCss`. So Graview Cloud, which dresses its signed-in pages as a Graview app and does not depend on the UI package, copied them and linted the copy. They are now plain frozen data in core: `SHAPE` (a radius of 12, a density of 1, and the pixels of padding and gap that density 1 means), `TYPOGRAPHY` (the body and mono stacks) and `isoShade(scheme)`, the roof, the two walls and the plot under them as saturation and lightness with no hue, plus the roof's lit edge. `shapeOf(brand)` and `typographyOf(brand)` resolve a brand against them: a brand's `shape.radius` and `shape.density` win where it declared them, and a display face falls back to the body face. The lighting is not a brand's to set. A brand composes with it through `accents`, because the hue of every face is the kind's, `hueFor(kind, brand.accents)`. `themeCss` now reads all of these instead of its own numbers, so there is one source. Its output is byte-identical to before for the framework's brand, a bare brand, an accent-derived brand and a square, tight brand set in Inter, in both schemes, scoped and not. `GRAVIEW_BRAND.typography` is `TYPOGRAPHY`'s two stacks.
  
  A core test holds the values, holds that they are frozen and survive JSON, and holds how a brand's radius, density and faces resolve. A primitives test holds that `themeCss` emits exactly `shapeOf`, `typographyOf` and `isoShade` for three brands in both schemes. The graview-brand skill says where the defaults live, and that a page dressed to match reads them rather than copying numbers. `capabilities().shipped` names FR-73.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-73`. `themeCss` output is unchanged. Ops, stored formats, the declaration, check codes and tool schemas are unchanged.
- e4f7b67: The seat's rail can be put away (FR-78). It took a column of the picture on every screen whether anybody was talking to it or not, and a hosted app's reader had no way to give the map the room. The companion's header now puts it away to a slim tab at the picture's left edge (`COMPANION_TAB`, 36 pixels), and the tab opens it again, by the pointer or the keyboard, which follows the control from the header to the tab and back; both say `aria-expanded`. Put away, the picture's box gives up only the tab and the provider's new `railLeft` (lent by the companion through `registerRail`) tells the layout the seat takes nothing more, so the city lays out into the room: `railInset(width, left)` takes it. The reader's choice is remembered per app under `graview:companion:<app>` in the host's `memory` or the page's storage, every read and write of it wrapped so a frame that refuses storage still works. Narrower than `COMPANION_OVERLAY_BELOW` (960 pixels) the open rail lies over the picture in the floating panel's look rather than taking a column, with the tab kept at the edge; on a phone it is the sheet along the bottom, as before. `mount(root, { companion: "open" | "collapsed" | "hidden" })` sets where it starts, and the whole-page `Shell` takes the same `companion` prop (remembered under the brand's name): the reader's choice wins over `"open"` and `"collapsed"`, and `"hidden"` draws no rail, no tab and no A-key door. The companion takes `start` and `rememberAs`; `CompanionMode` is exported from `@graview/primitives` and `@graview/embed`, and the provider carries `memory`. A unit test puts it away and opens it again with the keyboard following, finds the picture's box padded by the tab and the layout told, the choice kept and read back over the host's start, `"hidden"` drawing nothing, and storage that throws. `verify-chrome` does it from the keyboard on the embed's Graview face and on the Shell at 1440×900 — the scene's box is the frame's width less the tab, the city's first card moves left into the room, the choice survives a reload both ways — and finds the open rail over the picture at 820 wide with the picture all but the tab, and the host's `"collapsed"` and `"hidden"` starts. The `graview-embed` and `graview-agent-seat` skills say how. `capabilities().shipped` names FR-78.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-78`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged. `GraviewContextValue` gains `railLeft`, `registerRail` and `memory`, so a hand-built context value for a test needs the first two.
- Updated dependencies [0ecda3f]
- Updated dependencies [b5a4bfc]
- Updated dependencies [e811d26]
- Updated dependencies [d953bf9]
- Updated dependencies [4e1d6e3]
- Updated dependencies [7597e22]
- Updated dependencies [1aba73e]
- Updated dependencies [e4f7b67]
  - @graview/react@0.1.9
  - @graview/core@0.1.9
  - @graview/layout@0.1.9
  - @graview/render@0.1.9
  - @graview/tools@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies [afd37a3]
- Updated dependencies [0e6cccd]
- Updated dependencies [eed0b56]
- Updated dependencies [b12f49d]
  - @graview/core@0.1.8
  - @graview/layout@0.1.8
  - @graview/react@0.1.8
  - @graview/render@0.1.8
  - @graview/tools@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7
  - @graview/layout@0.1.7
  - @graview/react@0.1.7
  - @graview/render@0.1.7
  - @graview/tools@0.1.7

## 0.1.6

### Patch Changes

- 94da01b: The embed's stylesheet keeps to its box (FR-64). `themeCss(scheme, brand, { scope })` put the tokens, the ground and the type on the scope, but every other rule was written for a whole page, so the `<style>` an embed renders still said `h1, h2, h3, h4`, `code, kbd, samp`, `button`, `button:hover:not(:disabled)`, `button:focus-visible`, `button:disabled` and `code` bare: on Graview Cloud's builder the host's own buttons below the studio took the framework's ink on a transparent ground and failed contrast in dark (3.41:1). With a scope, the finished sheet is now rewritten so every selector that does not already start at the box is under `:where(<scope>)`, inside @media and @supports too; `:where` weighs nothing, so each rule wins exactly the contests it won on a whole page, and only where it applies changes. The reader's motion answer is still asked of the document element and applied inside the box, and the registered `--graview-altitude` and the keyframes name no element. Without a scope the stylesheet is byte for byte what it was. A test reads every selector of every rule in the scoped sheet, in both schemes and two brands, and fails on any that could match outside the box; `verify-studio` mounts the studio in a host's page with the host's own `<button>`, `<h2>` and `<code>` below it and finds their computed styles the same as on that page with no embed, in dark and in light. The pages' gallery rule and the prose links' rule are keyed on Graview's own class and attribute, and the studio and the Shell bring no stylesheet of their own. `capabilities().shipped` names FR-64.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-64`. `themeCss` without a scope is unchanged; with one, the same rules in the same order, each held inside the scope. Ops, stored formats, check codes and tool schemas are unchanged.
- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/core@0.1.6
  - @graview/layout@0.1.6
  - @graview/react@0.1.6
  - @graview/render@0.1.6
  - @graview/tools@0.1.6

## 0.1.5

### Patch Changes

- 826e19b: A hosted page carries 536 KB up front, not 1,075 KB, and each face of the embed is fetched as it is first drawn (FR-57). Graview Cloud's shell — `openRemote` and the embed over a document compiled in the browser — loaded every face before the app drew: the scene, the companion, the inspector, the routed face and its router, the chat and the agent's tool surface, and every default view. The embed imported every face outright, and a bundler splits a page by which files its first chunk can reach: the frame took its provider from `@graview/react`, its theme from `@graview/primitives`, and the provider took the reader's rung from `@graview/tools`, and each of those reaches the rest of its package. Now the frame — the region, the theme, the strip, the provider — is what a page loads first, and the scene, the pages and the picture are each a chunk fetched as they are drawn, with the framework's own views beside them. The frame reaches only the narrow entries `@graview/react/provider` (the provider, hooks and view registry without the scene), `@graview/primitives/frame` (the theme, the strip's Profile and Standing, and the framework's views behind doors), `@graview/tools/frame` (the reader's rung, pins and editable fields without the agent) and `@graview/layout/view` (the view state without the city); the routed face reaches `@graview/primitives/pages` and fetches the companion when "Ask" is opened, and a district fetches its arrange row when it is opened full. `scripts/verify-hosted-page.mjs` (`pnpm hosted`, first in `pnpm verify`) builds Cloud's page the way Cloud does and holds it to 600 KB up front and 150 KB of zod; it also says what each face fetches as it draws, 770 KB in all before the scene draws and 729 KB before the pages do.
  
  CI's bundle budgets follow: the pages face alone is held to 530 KB (from 950 KB) and the embed without the studio to 780 KB first loaded (from 1.2 MB); every face, loaded whole, is 11 KB smaller minified and 2.5 KB larger gzipped, its chunks each gzipped alone, so its gzipped budget is raised from 373 KB to 380 KB.
  
  Compatibility: the embed — a change of shape. `mount` returns with the frame on the page and the face on its way: its box stands empty (`aria-busy`) until the face's chunk arrives, and `handle.drawn()` resolves once the face asked for is drawn, after `mount` and after `setFace`. `preload(...faces)`, a new export of `@graview/embed`, fetches faces before they are drawn, and an embed mounted once its face is here draws it in the first commit, as before; with no face named, every face. `onReady` is told when the first face is drawn, not at the frame's first commit, and the new `onDrawn` option each time a face is. The framework's own views in an embed's registry are doors that draw them once fetched (`frameworkViewDoors`, `registerFrameworkViews`, `fetchFrameworkViews`, new exports of `@graview/primitives`); a host's `views` function is handed them as before. `@graview/react/provider`, `@graview/primitives/frame`, `@graview/primitives/pages`, `@graview/tools/frame` and `@graview/layout/view` are new subpath exports — each also exported from its package's main entry — and a product that aliases the framework's packages (a linked project's vite config, which `graview create` writes) aliases them ahead of the bare names. `@graview/embed/pages` is unchanged and still draws in the first commit. Ops, stored formats, the wire, check codes and derived tool schemas are unchanged.
- 6ff733b: The stylesheet's notes stay in the source and out of the page. `themeCss` explained its rules in CSS comments inside the template it returns, so every page carried them and every embed parsed them into its `<style>`: 25 KB of the 60 KB the function was. They are now JavaScript comments in an empty interpolation, `${/* … */ ""}`, beside the rules they explain, and a minifier folds them away; the CSS a page receives is the same rules, without the prose.
  
  Compatibility: unchanged. `themeCss` returns the same rules in the same order; only the comments between them are gone from its output.
- Updated dependencies [f989024]
- Updated dependencies [97f2a0a]
- Updated dependencies [1e21d54]
- Updated dependencies [281761b]
- Updated dependencies [a83a311]
- Updated dependencies [f1fcf13]
- Updated dependencies [826e19b]
- Updated dependencies [e22a00d]
- Updated dependencies [5a2086e]
- Updated dependencies [76df9ba]
  - @graview/core@0.1.5
  - @graview/react@0.1.5
  - @graview/tools@0.1.5
  - @graview/layout@0.1.5
  - @graview/render@0.1.5

## 0.1.4

### Patch Changes

- 0183340: A tool's schema does not depend on zod's minor version. An agent tool's input schema is a stability surface, and zod writes its own regex for a string format — `z.email()`, `z.uuid()`, `z.iso.datetime()`, `z.iso.date()` — beside the format's name. That regex differs between zod 4.4.3, which this repository locked, and 4.6.5, which a consumer resolves from the published ranges, so Cloud's tool-schema snapshot saw sixteen "inputSchema changed" entries that were only zod's regex. `toJsonSchema`, and with it `mutationToolSchema`, `nodeJsonSchema`, `schemaJson` and the conformance kit's tools, now says a format string by its JSON-schema `format` alone (`email`, `uri`, `uuid`, `date-time`, `date` …) and drops zod's `pattern`; a pattern the author wrote with `.regex(…)` is kept, beside the format where there is one. Moving the workspace to zod 4.6.5 found a second dependence on zod's internals: zod 4.6 no longer fills a schema's `_zod.bag` as it builds it, so `describeArg` lost a number's bounds and a date's pattern, and a date argument was asked for as free text. It now reads the checks on the definition, which both versions keep. Every package's zod range is now `^4.6.5`, so the tests run on what a consumer gets.
  
  Compatibility: tool input schemas — a format-based string no longer carries zod's regex `pattern`, only its `format` (an `email` property is `{ "type": "string", "format": "email" }`); a `z.url()` property is unchanged, and an author-written pattern is kept. A snapshot of a tool surface taken with either zod version changes once, for those properties only, and then holds across zod minors. The conformance kit's recorded fixtures are unchanged: none declares a format string, and the lock holds. `describeArg` and `argShape` answer as they did on zod 4.4 for every schema, now on 4.6 too. Every package's `zod` dependency moves from `^4.4.3` to `^4.6.5` (products never install zod; `@graview/core` re-exports it). The embed's bundle budgets rise with zod 4.6, which gives every schema type its own JSON-schema processor: the pages face alone from 815,000 / 220,000 to 950,000 / 252,000 bytes and every face from 1,150,000 / 330,000 to 1,290,000 / 362,000 (minified / gzipped), about 130 kB / 30 kB of zod's that a host on zod 4.6 was already paying. The document format, ops, stored formats, the wire and check codes are unchanged.
- cc889f4: A typed app fits wherever an app goes, with no cast. A consumer's TypeScript met four walls that the framework's own code got past with `as never` and `as unknown as GraviewApp<AnySchema>`. `installation.mutations` would not spread into an app's mutations. A typed app was not an app: `GraviewApp<S>` would not widen to `GraviewApp<AnySchema>`, because an act's `apply` and `describe` and a rule's `evaluate` were function-typed properties, checked contravariantly — so the studio's readers (`graphToDeclaration`, `migrationBetween`, `sourceChanges`, `declarationFiles`), `createStoreHandler` and the embed could not be handed one. `schema.definition(kind)` on a schema whose kinds are only `string` was `never`. And an unbound `defineInvariant` handed its rule a `never` subject. Now `apply`, `describe` and `evaluate` are declared as methods, so a typed app and its acts and rules widen; `installation.mutations` spreads into any app's mutations; `definition(kind)` answers the kind's definition, any definition of that kind on `AnySchema` (`DefinitionOfKind`); an unbound rule's subject is a node of its kind (`NodeOfKind` on `AnySchema`), its fields `unknown` until bound; and `reachLens.View` is the generic view it always was, so it registers on any app. The casts are gone from the studio, the store handler, the embed, `@graview/core/testing`, the launcher and the example apps, and type-level tests hold each wall down.
  
  Compatibility: types only, nothing at run time changes. Every type is wider than before except one: `apply`, `describe` and `evaluate` lose `readonly` (a method cannot be marked so), so code that reassigned one is now allowed to, where it was refused. `DefinitionOfKind` is a new exported type. A call such as `syncConflictInvariant()` beside a typed schema may now infer `AnySchema` where it inferred the schema, and wants `syncConflictInvariant<typeof schema>()`. The wire, ops, stored formats and check codes are unchanged.
- Updated dependencies [df9932a]
- Updated dependencies [9de42fe]
- Updated dependencies [a9c0f2d]
- Updated dependencies [75c1a26]
- Updated dependencies [e0f75bb]
- Updated dependencies [833e390]
- Updated dependencies [c5b36f7]
- Updated dependencies [53857e9]
- Updated dependencies [fdf82ed]
- Updated dependencies [f923330]
- Updated dependencies [936814b]
- Updated dependencies [98f0438]
- Updated dependencies [ba312af]
- Updated dependencies [d5a386e]
- Updated dependencies [a57ea5d]
- Updated dependencies [d5af759]
- Updated dependencies [d774558]
- Updated dependencies [0183340]
- Updated dependencies [cc889f4]
- Updated dependencies [5fd6380]
- Updated dependencies [dee1fb2]
- Updated dependencies [67fbb6f]
- Updated dependencies [180452e]
- Updated dependencies [1f260a7]
- Updated dependencies [062fe46]
- Updated dependencies [0497bbf]
  - @graview/core@0.1.4
  - @graview/tools@0.1.4
  - @graview/layout@0.1.4
  - @graview/render@0.1.4
  - @graview/react@0.1.4

## 0.1.3

### Patch Changes

- f4a1f72: The seat is a labelled region, not a landmark inside one. The companion was an `<aside>`, a complementary landmark, drawn inside the Shell's main and inside an embed's own region, and the inspector, the line key and the quick relations were asides inside it, so axe's `landmark-complementary-is-top-level` failed on every hosted app at every size and scheme. The companion is now a `<section>` named "The seat — about …", with its h2 and every test id and `data-graview-*` attribute as before; the inspector, the key and the quick relations are named groups while they sit in the seat, and labelled regions where they stand alone. The profile and the activity panes, which open from the bar or inside an embed, are labelled regions too. A click on any of them still leaves the selection alone, and an embed still names each region inside it after itself (FR-40).
  
  Compatibility: the wire — additive: `capabilities().shipped` gains "FR-40", and nothing else on it moves. Ops, stored formats, the declaration and the tool surface are unchanged.
- Updated dependencies [c3683bb]
- Updated dependencies [1ba2ab7]
- Updated dependencies [5ea9572]
- Updated dependencies [a65423f]
- Updated dependencies [8e76788]
- Updated dependencies [c2ed1f8]
- Updated dependencies [5ea9572]
- Updated dependencies [50beae9]
- Updated dependencies [625ac82]
- Updated dependencies [f4a1f72]
- Updated dependencies [ca3c327]
  - @graview/core@0.1.3
  - @graview/react@0.1.3
  - @graview/layout@0.1.3
  - @graview/render@0.1.3
  - @graview/tools@0.1.3

## 0.1.2

### Patch Changes

- f36ccfc: The seat names a group of several kinds by their plurals. Homeflow's opening view is its blocks and runs together, and the companion's heading read "block+duty", the group's id, where the scene's own label said "Blocks and Runs". It now says what the scene says. And the bar, the companion and the find strip set each border side and each gap on its own, so a page widened past the narrow layout no longer has React warn about a shorthand and its longhands trading places.
  
  Compatibility: unchanged — no stored format, wire, check code, document format or tool name or schema moves; only the seat's heading and inline styles change.
- 346fbe3: The way in and a model's plan leave room for their widest number: an app with thirteen kinds read its way in as "1…9, 0, 1, 2, 3", the first digit of each two-digit number clipped off by the panel.
- 7f354e0: A log a seat may not fully see is redacted, not gapped. `seenBy` used to leave out the ops that touched what a seat may not see, which left holes in the seq that `OperationLog.from` refuses, so a served store had no log it could send. Those ops now stay in place as withheld ops, `withheld: true`. A withheld op keeps its id, seq, batch, time and `undoes`. Its author is `WITHHELD_AUTHOR` ("Someone") and its intent is `WITHHELD_INTENT` ("A change you cannot see"). The mutation, inverse and batch intent are dropped. Its primitives, reads and writes keep only what the seat sees, so the seat's copy of a record it can see still moves. `redact(ops, sees)`, `withhold`, `touchesUnseen`, `touchedBy` and `isWithheld` do the redaction, and `logSeenBy(store, principal)` and `seesId(store, principal)` read it for one seat.
  
  A log with withheld ops loads, folds and undoes around them. `checkUndo` refuses to take back a withheld op and says only that it was "a change you cannot see". When a withheld op stands in the way, it says "a later change you cannot see depends on it", without its sentence, id or what it read, and offers no batches to bring along. `seenBy(...).canUndo` judges over the redacted log, and `Store.undo` judges a seat with sights that way first, so neither a refusal nor a 409 quotes a change the seat may not see. The activity rail shows a fully withheld batch as "A change you cannot see", with no author, nothing it touched and no undo. A record's page leaves withheld ops out of its history (FR-16).
  
  Compatibility: additive for ops: `Operation.withheld` is a new optional field, an op without it reads as before, and no store makes one for itself. Changed for readers of `seenBy(store, principal).log` and `.batches()` under a policy with `sees`: ops a seat may not see now come back withheld in their place rather than being left out. `checkUndo` now takes any `LogReading` (`all`, `undoneIds`, `epochs`), which an `OperationLog` still is. Stored formats are unchanged.
- 33c3cbb: An agent acts for someone, through something, and the log says so. An `Author` carries its own `name` and `onBehalfOf`, the person it acts for. An op carries `via`, what it came through: `web`, `mcp:<client>`, `view:<name>`, `api` or `cli`. The activity rail reads "Claude, for Nick, via Claude", and `nameOfAuthor` says an author's own name before any id.
  
  An agent acting for a person may do what both may: its roles are the intersection of its own and theirs, a `self` grant is about the person, and `actingAs` gives the seat a policy judges. A `system` principal acting for nobody passes the policy and sees every record (`isSystem`), so a host's setup, seed and migrations are not refused by the app's own grants (FR-06, FR-17).
  
  A served store believes a seat header only when told to. `serveStore({ trustSeatHeaders: true })` reads `SEAT_HEADERS`, now with kind, name and delegation, so a remote `graview mcp` is recorded as an agent. Without it and without a `seatOf`, every route but health answers 401. `graview serve` listens on 127.0.0.1 and trusts the headers there, saying so; on any other `--host` it will not start without `--trust-seat-headers`. `openRemote` sends its seat on every request, the first read included, and its calls say `via: "web"`.
  
  Compatibility: breaking for a host that served a store without `seatOf` and relied on the seat headers: it now answers 401 until it passes `trustSeatHeaders: true`. `graview serve` binds 127.0.0.1 by default where it used to bind every interface. Additive elsewhere: `Author.name`, `Author.onBehalfOf`, `Principal.onBehalfOf`, `Operation.via` and `ApplyOptions.via` are optional fields, and ops without them read as before.
- 55f8b27: An embed holds inside a chat's widget. `mount` takes `height: "auto"` and `onIntrinsicHeight`, and tells the host the height it asks for as it changes: the strip and the whole page on the pages face, the strip and the picture's box on the others. It takes `hostContext: { theme }` over the page's own scheme, and `scheme: "auto"` now follows the host page's `data-theme` and the system's preference as they change rather than reading them once. `pagesBelow` gives the scene and the Graview way to the pages face below a width. `remote` takes a store from `openRemote` and its presence. `memory` keeps the reader's settings and the tab's session where the host says, and a frame whose `localStorage` and `sessionStorage` throw still mounts. The routed face no longer asks for a window's height when embedded, which grew a frame sized from its content without end.
  
  Presence speaks one dialect and forgets the gone. `participantKey` and `parseParticipant` name the `kind:id:session` format the op log, the figures and the wire share. What a presence channel reports is dropped once its last word is older than `REMOTE_PRESENCE_TTL_MS`, whether or not the channel says the person left. A people directory (`people` on `mount`, `GraviewProvider` and the pages' context, `Person` in core) names authors in the rail, the pages, the profile and presence without offering anybody a seat, so a hosted reader sees no seat switcher and no "Sit as somebody else"; `nameOfAuthor` reads it after the seats. The handle gains `setPeople`, `setSeats` and `setHostContext` (FR-13).
  
  Compatibility: additive for the wire — `participantKey` writes the key the served store already wrote, and `openRemote` keeps the TTL it had, now named `REMOTE_PRESENCE_TTL_MS`. `EmbedOptions` gains optional `people`, `hostContext`, `remote`, `memory`, `presenceTtlMs`, `onIntrinsicHeight` and `pagesBelow`, and `EmbedHandle` gains `setPeople`, `setSeats` and `setHostContext`, which a host implementing the handle itself must now provide. Changed in meaning: an embed with `scheme: "auto"` follows the host's scheme after mount, and a figure's own name in presence is the one `nameOfAuthor` gives (a seat's label, a directory's name, `Principal.name`) where it was the principal's id. Ops, stored formats, the declaration and derived tools are unchanged.
- 5a6f262: MCP for remote hosts. `createMcpHttpHandler({ store, authenticate, name, version })` serves the agent tools over Streamable HTTP as a fetch handler, `(Request) → Response`, stateless, for 2025-11-25 clients. The host's `authenticate` hook supplies the principal for each request; with no principal, every message is a 401, `initialize` included. The MCP TypeScript SDK's client completes initialize, `tools/list` and `tools/call` against it in the tests. `graview mcp` and the HTTP handler answer the same five methods through one dispatcher.
  
  Every tool says what it does. A `ToolDefinition` has a `title` and `annotations` with all four MCP hints, derived from the declaration:
  - `readOnlyHint` for the reads;
  - `destructiveHint` for an act that removes or severs, so `remove-<kind>` is destructive;
  - `idempotentHint` where an act sets only what it is given (a new `idempotent` on a mutation; derived edits and removes, and document acts that create nothing and compute nothing, have it);
  - `openWorldHint: false` always.
  
  Tool names are MCP-safe, with collisions handled the same way every time, and `act` names the act a tool runs. An act named like a read tool, such as `get_node`, used to be impossible to run, because the read tool answered first. It is now listed as `get_node_2` and runs as the act. `toolDefinitions(app, principal)` gives a seat's surface without a store, with a `hash` that changes when the surface does; `tools/list` carries it as `_meta["dev.graview/surface"]`.
  
  Other people's words come back as data. Reads go through `seenBy`, and prose written by somebody other than the caller, or the person an agent acts for, comes back as `{ untrusted: true, authoredBy, text }` in `get_node`, `get_graph` and `search_graph` (FR-10).
  
  Compatibility: derived tool names: unchanged for every act whose name is already letters, digits, `_` and `-`, at most 64, beginning with a letter or `_` (every act in the conformance fixtures, and every derived `edit-<kind>` and `remove-<kind>` of such a kind). Any other act is listed under a safe name: other characters become `_`, accents fall away, a leading digit or hyphen gets `act_`, and the name is cut at 64. An act named `search_graph`, `get_graph`, `get_node`, `get_violations`, `get_affordances`, `preview_mutation` or `undo_batch`, or one whose safe name another act already took, gets `_2`, `_3`, and so on. A call by the declared act name still reaches the act unless a listed tool has that name. Derived tool input schemas: unchanged, and the conformance fixtures match. Additive: every tool now has a `title` (the read tools: "Find by name", "Read the whole graph", "Read one node", "List the problems", "Ask what can be done", "Try an act without applying it", "Undo a batch") and `annotations`, and `ToolDefinition.title` is now always set. Read results: breaking for a reader that expected a string in a prose field written by somebody else, which is now the untrusted wrapper. Breaking for a seat whose policy declares `sees`: `get_graph`, `get_node`, `get_violations` and `search_graph` now show it only what it may see. `MCP_PROTOCOL_VERSION` is `2025-11-25`; a client that asks for an older revision gets its own back, as before.
- c74b21f: The bar learns that one row no longer holds from an IntersectionObserver on its right-hand group, instead of reading the row's width on every render. A rise to altitude renders the shell several times, and a forced layout in those frames cost the rise frames past 50 ms. The row is tried again when the window widens or the view moves.
  
  Compatibility: unchanged — no export, wire or stored shape changes.
- c5c1c91: The theme has a good tone and a bad tone. `good` and `bad` are tokens in both shipped schemes, written as `--graview-good` and `--graview-bad`, and `TEXT_PAIRS` holds each to 4.5:1 on a panel and on the ground. A badge that says "booked" or "overdue" now wears the theme's own colour and is checked with the rest of the palette. A brand derived from one accent gets both tones from its base (FR-38).
  
  Compatibility: the declaration — breaking for a brand that writes a palette out in full: `ThemeTokens` has two more required tokens, `good` and `bad`. A brand built from `SCHEMES` or `brandFromAccent` has them already. `graview check` measures the four new text pairs, so a palette whose tones cannot be read on its own panel is now an error.
- afcb06d: The workbench can be found by its headings. The seat, the inspector at the pointer, the activity and the places each open with a heading named as their landmark is, so a screen reader moving by headings reaches every region a person goes to.
  
  An embed's workbench says its name in a heading too. axe's `page-has-heading-one` failed on every embedded workbench in both schemes. `mount({ heading })` sets the level: `1` when the host's page is the app, `2` by default inside somebody else's article, and `false` when the host's own heading names it. The pages face has its own h1 and is not given a second (FR-25).
  
  Compatibility: unchanged for ops, formats, the wire and tools. `EmbedOptions.heading` is a new optional field, and an embed with no `heading` now carries an h2, which is not visible on the page.
- 9680187: A kind's card, row and page can be declared as data. `defineApp({ viewSpecs })` takes blocks from a closed set: title, text, badge with a tone, field with `as`, progress, group, `when`, divider and figure. Fields are bound by `{field}` templates, and conditions and tones are written in the rule language. A document's `views` compile to the same thing, and `toDocument` writes them back.
  
  `registerViewSpecs(registry, schema, specs)` in `@graview/primitives` draws them into the view matrix:
  - `card` at one × summary, beside the focus and on the pages face's gallery;
  - `row` at one × glyph;
  - `page` at one × full, above the framework's own view, which `DefaultView` draws.
  
  The scaffold's `views()` registers them, so a new project shows the card it declares with no component code.
  
  The tones are the theme's tokens, `good`, `warn`, `bad`, `neutral` and `accent`, and the blocks are styled by a fixed set of classes. Nothing in a spec runs. It carries no CSS, no markup and no URL, and the only link a view draws is an http(s) `url` field's own value. `graview check` holds every name and tone to the declaration (`view-field`, `view-name`, `view-tone`, `view-kind`, `view-slot`, `view-figure`, `view-block`).
  
  The rule language reads a record's own values only. `constructor` was taken for an operator by the tokenizer, and read through `in` it handed a template the function `Object`. It is now a name like any other, and no field (FR-03).
  
  Compatibility: the declaration — additive: `GraviewApp.viewSpecs` is optional, and its finding codes are new and reported only for a declaration that has view specs. The rule language — a name on `Object.prototype` (`constructor`, `toString`) is no longer read as a field or a binding; no declared field has such a name.
- 570f9e2: A view registered once is drawn on every face, over the defaults rather than instead of them.
  
  - **The embed hands its views to the routed face.** `mount({ views })` used to build the pages face without the registry. A registered view was drawn in the workbench and never on a phone. The pages face now gets the same registry, with the app's settings and presence, so the gallery's card is the registered one × summary. The record page draws the kind's own one × full view under its heading (FR-35).
  - **Registering one view keeps the rest.** `views(schema, registry)` is handed a registry that already holds the framework's own view for every cell and the declaration's view specs. A function that builds a registry of its own is laid over those same defaults (`layerViews`), so one card no longer costs every other view. `<DefaultView {...props} />` draws the framework's own view for a cell inside a view of your own. On the record page, which is the default record, it draws nothing (`DefaultViewElsewhere`). `ViewRegistry.registrations()` lists every registration in the order it was made (FR-36).
  - **A member drawn as a row is a cell a view can claim.** When a kind has a one × glyph view of its own, as a component or a spec's `row`, two places draw it. A focused group draws each member as that line, each a target for its record. The list page draws each record as that line, with the whole line as the link (FR-37).
  
  The framework's own one-cell views are now marked as defaults (`isDefaultView`), the way its group views were, so a surface can tell them from an app's.
  
  Compatibility: the declaration — additive: `ViewRegistry.registrations()` and `ViewRegistration.across` are new, and a registry that implements the interface by hand needs the method. `EmbedOptions.views` is now called with a second argument, the registry to register onto. A function that ignores it still works, and is laid over the defaults instead of replacing them. Ops, formats, the wire and tools are unchanged.
- Updated dependencies [3afdd09]
- Updated dependencies [b910210]
- Updated dependencies [7f354e0]
- Updated dependencies [74c9388]
- Updated dependencies [a7fc818]
- Updated dependencies [6a46f36]
- Updated dependencies [2820fd3]
- Updated dependencies [230d9b4]
- Updated dependencies [a163197]
- Updated dependencies [4a5dadd]
- Updated dependencies [7afb9ae]
- Updated dependencies [9b2c61b]
- Updated dependencies [8990aa9]
- Updated dependencies [539d0eb]
- Updated dependencies [33c3cbb]
- Updated dependencies [95444f1]
- Updated dependencies [55f8b27]
- Updated dependencies [6ea13f7]
- Updated dependencies [a634594]
- Updated dependencies [c6cea46]
- Updated dependencies [3b36d19]
- Updated dependencies [85888f1]
- Updated dependencies [d2683c5]
- Updated dependencies [5a6f262]
- Updated dependencies [c6bd456]
- Updated dependencies [6c54eb1]
- Updated dependencies [67a7d42]
- Updated dependencies [6c62ca6]
- Updated dependencies [5e85a39]
- Updated dependencies [b2f8c22]
- Updated dependencies [984c96f]
- Updated dependencies [b71e7c5]
- Updated dependencies [2493564]
- Updated dependencies [c5c1c91]
- Updated dependencies [346fbe3]
- Updated dependencies [b334c25]
- Updated dependencies [9680187]
- Updated dependencies [570f9e2]
- Updated dependencies [6460336]
  - @graview/core@0.1.2
  - @graview/render@0.1.2
  - @graview/tools@0.1.2
  - @graview/react@0.1.2
  - @graview/layout@0.1.2

## 0.1.1

### Patch Changes

- ed02370: A connection's chip on a record is titled "Go to the test drive", by the kind's noun, not "Go to test-drive".
- e0c8cac: A list's "Only…" filter and the chip it leaves say a value as the record does — "SUV", "Body style: SUV" — through the new `valueWords`, rather than the field's raw "suv". The watch no longer counts a word one kind declares ("Status") as another kind's key.
- e1b9f5c: A form asks in the record's words. An argument that fills a field of the kind its act makes or acts on is labelled as that field ("VIN", "Body style"), its choices are said as the record says them ("SUV", "Plug-in hybrid"), and an argument called `label` is asked for as a "Name" — on the routed face's forms and in the scene's ask alike (`argumentWords`). A refused argument is said field by field in the same words — "Not yet: Email — invalid email address." — rather than as `Invalid arguments for mutation "sign-up" email: …` (`failureWords`, `InvalidArguments`). The watch is told a declaration's choice values, and the key's own words wherever the declaration has others.
- 097d684: A count of one says the kind's noun: "1 car", "1 test drive", where a place card, Find, a district's name, a band of a district and a coverage's gaps said "1 vehicle" and "1 test-drive". One function says it now (`counted`).
- e88f729: A chip's title, an empty record's "Nothing is connected to this …" and the seeding's count of one say the kind's noun, not its id: "Test drive — implicated in a problem", not "test-drive".
- 1df48c8: A list narrows by a number and by a word. The arrangement offers every number field as a filter — `price:at-most:25000`, `mileage:at-least:10000` — and every word field by the values it holds; the arrange bar's Only… lists four round steps through what the list holds ("at most £25,000") and a word field's values by name ("Make: Kia") when there are up to sixty. `roundSteps` is exported.
- ccfe1cd: A lens path that cannot get from its columns to its rows is a binding error, not a picture of nothing covered. `graview check` walks it off the declaration (`lens-binding-path-misses`, saying when it is only named backwards and how to name it), and the coverage throws a `CoverageBindingError` with the same sentence rather than reading every row as uncovered. `walkKinds` is exported.
- d76a957: A policy says who may see what, as well as who may do it. `Policy.sees` keeps a kind to the roles a sight names — with `own`, to the principal's own record and what an edge joins to it — and a kind no sight names stays everybody's. `store.seenBy(principal)` is the store as that principal may see it: its graph, log, history and problems hold only what they may see, and every act still goes to the store itself; with no `sees` it is the store, unchanged. The scene's provider and the routed face hand every surface that view, a kind a seat sees none of and may not begin is kept from it like an administered module, and the way in leaves it out. `graview check` refuses a sight naming an undeclared kind (`sight-unknown-kind`). A watching harness is told what the seat may not see (`tellTheWatchWhatIsUnseen`, `useTheWatchKnowsWhatIsUnseen`).
- c222b58: The scene's ask takes a list of words as one line, split at commas, and nothing typed as an empty list: "Put a car on sale" sent its features as a string and was refused on its last step, every Apply. The ask's field carries its argument's `name`.
- deb98ca: When the scene's ask is refused for an answer, it goes back to that question. Sixteen questions into "Put a car on sale", "Photos — invalid URL" left the ask on its last step, where Apply could only be refused again and the only way to the wrong answer was to start over.
- 3c0d822: The bar wraps wherever one row does not hold, not only below 920 pixels: an app's own `nav`, a long crumb after a drive-in and the places menu can need more, and at 1280 a bid's bar ran the profile — the seat switcher — off the edge with the places a sliver. The row is measured before it is painted and tried again when the window widens or the view moves.
- b9cdc16: The scene's ask hands the keyboard to its next question when the last answer took its control away: a choice pressed before another question of choices ("Fuel", then "Gearbox") left it on `<body>`.
- 0b78acc: The way in says a kind is waiting for what is still missing — "Waiting for Shoppers." — not for everything its act needs, beside four showrooms and 340 cars.
- Updated dependencies [bf36bbe]
- Updated dependencies [e0c8cac]
- Updated dependencies [e1b9f5c]
- Updated dependencies [cbdd94a]
- Updated dependencies [097d684]
- Updated dependencies [a1859c5]
- Updated dependencies [1df48c8]
- Updated dependencies [ccfe1cd]
- Updated dependencies [c307981]
- Updated dependencies [fa8bd61]
- Updated dependencies [32ea5ac]
- Updated dependencies [d76a957]
- Updated dependencies [b535cb2]
- Updated dependencies [6b297f0]
- Updated dependencies [414ddde]
- Updated dependencies [a575ca9]
- Updated dependencies [f1cf758]
- Updated dependencies [6966a4e]
  - @graview/react@0.1.1
  - @graview/core@0.1.1
  - @graview/tools@0.1.1
  - @graview/layout@0.1.1
  - @graview/render@0.1.1

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

- 23d05c6: A calendar draws every kind it is bound to. Registered over one kind and bound to two — a dealership's diary over its test drives, bound to test drives and service appointments — it drew only the group's members and never read the other kind. The other bound kinds now come from the graph, on the same horizon the group keeps (their past only when the stop asks for it), after the group's own arranging.
- fb781c2: A calendar lens: month, week, day and agenda over real dates. `createCalendarLens` binds a kind's own fields to roles — a start date or date-time, an optional end, an all-day flag, a label, a done flag — the way every other starter does, and `graview check` reads the binding like the others'. Multi-day spans are drawn on every day they cover and say which piece they are; a busy month cell says "+N more" and opens that day; all-day entries sort before timed ones; done reads as done. All date arithmetic is on `YYYY-MM-DD` strings in UTC, so an entry does not land on the 13th for half the world, and `addMonths("2026-01-31", 1)` is February.
  
  Two framework capabilities the calendar forced. `ViewState.within` is where a view says where it is INSIDE itself — `in.at=2026-10-01&in.range=month` — carried in the fragment, never read by the framework, and counted as travelling rather than as an adjustment, so Back returns to the month you left. And a kind may now have SEVERAL pictures: `places()` lists every titled group view, each with an `as` slug the stop names (`in.view=the-month`), and `resolve(kind, cell, as)` picks one. Before this, registering a second titled view simply replaced the first and made it unreachable.
  
  Dragging an entry to another day is an act: `actThatMoves` asks the declaration (through the framework's own `fieldWriters`, the function the checker uses) which act writes the bound date, the store judges it, and one undo puts it back — a seat that may not is told so in the policy's own words rather than watching the entry snap back. A date-time keeps its time.
  
  Also: a control inside a view no longer selects the card it is drawn on — pressing the calendar's "next" used to select every task in the district behind it.
  
  Things shows a month over tasks by due date beside the week and the lists, all three now the framework's own named places rather than a switcher of its own. Seedbed gains a season over plantings, which means a planting now records the day it was harvested and is a span rather than a dot.
- dd65d38: A card's acts are one key away. On a phone the seat is a folded sheet, and from the keyboard its toggle was a walk of a dozen Tabs past every other card — making a location in the rota took 22 presses where a pointer took 8. A card with the keyboard on it now answers A the way it answers a right-click: what it draws is chosen, the seat opens on its acts and the keyboard lands on the first; put away from the keyboard, the keyboard goes back to the card. The card names the key (`aria-keyshortcuts`) and the seat's header says it on screen while the keyboard stands on a card. The scene learns the key from the seat (`actsDoor` on the context), so a scene with no seat claims none.
- bff0b71: A change is logged in the record's words, and a seat's roles are said in words. The derived edit's history read "price → 49900" and "condition → \"cpo\"" beside a card saying "Price $49,900" and "Certified pre-owned"; it now uses the declaration's `display.labels` and `display.format`. The profile pane named the seat's roles by their ids ("sales-manager"); it says them as words ("Sales manager").
- 400a6df: A fact on a chip says what it is. `readableFields` gives every field an `alone` reading — a word as itself, a number with its label ("Track 8", "Length 4:27"), a yes/no as "Explicit: yes" — and the default summary card, the pages' gallery and the list lines all use it. A song's card used to read "8 · 4:27 · Yes".
- 5d634ca: Clicking a name in an opened district changes the picture, and a relation drawing seven lines draws them quietly.
  
  **A chosen member is not its whole district.** At altitude a selection is resolved to the card that stands for it — right for asking which CARDS a line touches, wrong for asking which LINE. With the volunteers opened, all seven `covered-by` strands end at the volunteers card, so choosing Ada lit Bo's shifts, and Cass's, and Dev's: the scene said exactly the same thing before and after the click, which is the one thing clicking a name is for. A strand knows the real edges it stands for; when the selection names something those edges mention, that finer answer wins, and when it names none of them — a district chosen as a district — the card rule stands. The rule is `altitudeOpacity`, pulled out of the render so it can be read and tested.
  
  **A relation drawing many lines at once draws each of them quieter.** A bundle is unpicked so each line can start at the thing it is about: the week draws every shift as its own span, and a line leaving the span says *which* shifts are covered, which is worth having. But seven of them arriving at one closed district, each at the weight of a single fact, is a starburst across the whole picture. They now fade with the crowd — never below a third — and choosing one still brings it fully forward.
  
  **A district offers only what it can do.** The layout refuses to open the district of the kind in focus: its members are already the picture above, at size, and drawing the same ten names twice is what the ring exists to avoid. The card offered it anyway — pressing "open" on Shifts while looking at the week wrote `expand=kind:shift` into the stop, the next frame threw it away, the card still read "open ▾", and nothing moved. It says "shown above" now. The same held for the district the layout opens in place, which offered a "close" that could not close.
- 8031925: A press on a coverage grid's column name chooses that column. The name leans up and to the right across the boxes of the columns after it, which were painted over it, so a press on a name chose a neighbour about half the time; the box now lets presses through and the name itself takes them, a little taller than its words.
- eacd252: A coverage cell is lit when the selection reaches both its ends. Lit on either, selecting one song lit the whole column of its theme — every other song about the same thing.
- c7a3519: A create can name its id, and what was made can be unmade. Every act that declares `creates` now takes an optional `id` argument the framework adds beside its own: `compileMutation` lifts it before the declaration's input parses, `freshId` hands it out first, and an id the graph already has is refused by name rather than quietly suffixed — so a seed being synced, or an agent that will refer to the node in its next call, gets exactly the id it asked for or an honest no. The tool schema says so (`mutationToolSchema`), and `takesAnId` says which acts take it.
  
  And every kind gets `remove-<kind>` derived beside `edit-<kind>`: destructive, titled, taking the node and its ties, logged and undoable, permitted through the acts that create the kind or a grant naming it — who may bring a thing into being may take it out, which is narrower than the edit's reading on purpose. An app's own `remove-<kind>` is kept. `derived` on a mutation is now `{ kind, act: "edit" | "remove" }`; `deriveMutations`, `deriveRemoveMutations`, `removeVia` and `derivedVia` join the exports, and the store, the checker, `describe` and `docs` all count the removes with the edits. The refusal for a derived act nothing declared reaches now says "creates or changes" rather than the edit's "writes or creates".
- 2aae30f: A crowded band is laid out by relation. Past what fits as chips, a band row is as tall as a group card's two lines, the gutter between rows holds a caption, and each relation starts its own row unless all of it fits the rest of the current one — so a caption never sits on the cards of the row above, and a group card is never cut to its name. `packRuns` and `bandCaps` (exported) plan the rows in arithmetic, and each relation is drawn within what the rows give it. A band card says its name and which way it opens on one line, and its count and first members on the next, "1 song" rather than "1 songs"; a record standing in a crowded band is drawn as a chip (`compact` on the layout node) rather than a summary cut to a sliver; a chip is never wider than what holds it. A grouping in which one group holds three quarters of the members is not offered. The month cells of a calendar are as tall as what is in them, so a month with three releases no longer spills over the month below, and a coverage matrix draws at most 40 rows by 24 columns.
- 60b3e2b: A chip that is cut carries its whole label as a title, whatever its length. Whether a chip is cut is its container's decision, not its label's: an eighteen-character rotation in a twenty-five-pixel calendar cell at phone width was cut to "Br…" with nothing to say the rest, because only a label past twenty-eight characters used to get a title. The site harness, which treats an ellipsis without a tooltip as a failure, found it the day the chapters bundle was rebuilt.
- 73690fb: A district is a village. From altitude its members stand as small iso buildings on the plot, back to front on the plot's own sub-lattice, each with a height of its own, the square in the middle kept for the nameplate and the kind's landmark; past the plot's cap the rest are a number on the kerb. A flagged member's roof is the warning colour and a selected member's building is lit. The anonymous iso block that stood for every kind without a drawing is retired: the population is the size of the cluster now.
- 862fd42: A district stays a district whatever picture the address names — and the studio stops minting ids in the layout's namespace.
  
  Three things, all found by opening Rota's installation and its studio and looking at what was actually drawn.
  
  **A place is a picture OF a group, not of every group.** The scene handed `in.view=<slug>` to every group it drew, so pressing "Who may do what" and then looking at something else left the slug in the stop, where the PEOPLE district — which is not what you are looking at — drew the policy lens instead of itself: no name, no count, no figure, no way in, just the words "Who may do what · 3 roles" floating where a district used to be. The same thing turned the Shifts card into "The week · 10". The slug now reaches only the group the address focuses, which is what the code's own comment always said it did.
  
  **A lens's glyph is a mark, not a caption.** `ReachView` returned a bare `<span>` at glyph fidelity where every other lens returns a `Chip`.
  
  **`kind:` belongs to the layout.** It is where a district card's id comes from, and the studio minted `kind:rule` for an app's own kind called "rule" — the same string as the RULES district's card. Every app in this repository declares a kind called "rule", so in every one of their studios the edge from a rule to the kind it judges resolved to the district it started from and was drawn as a loop: a dotted circle labelled OVER, saying a rule judges a rule. The studio's kind nodes are `declared:<name>` now, and a test holds the namespace.
  
  Also: the studio's agent can name a new role or kind. "add a new Role for Participant" was not recognised by the graph-native floor — it only matched an act whose title appeared verbatim — so the turn fell through to whatever model was configured, which proposed `add-role` with no label and got a validation refusal. The floor now takes a name from quotes, from "called"/"named"/"for", or from in front of the word itself, asks for one when there is none rather than proposing an act that cannot apply, and says so when the name is already taken.
- 475cc83: The districts at the bottom of the stack are readable: the kinds plane stops paying for depth in legibility.
  
  A district's name reached the screen at ten pixels and its kind at under eight, so the bottom of the picture was a row of grey marks rather than a map of the domain. Three things were stacked on top of each other to get there.
  
  **The plane was drawn at 78% of the room it was given.** The layout allots each district a slot and the renderer drew the card at 0.78 of it — a shrink applied *after* the reader's text size, so it was a shrink no setting could lift. The stylesheet next to it already argued the case: "Depth comes from BLUR AND FALLOFF, not from shrinking. Pushing the scale to 0.6 made the strip illegible — ten cards reading P…, REA…, S…. A map you cannot read is not a map." 0.78 was the same mistake, smaller. The planes keep a shrink — recession is still monotonic, as `frame-plan` requires — but one small enough to read as depth and no longer small enough to cost a word its legibility.
  
  **A district's name was thirteen pixels before any of that**, and its kind ten. A name is read, not glanced at.
  
  **And three more pixel sizes were hiding from the guard.** The test written last commit looked for a number straight after `fontSize:` and walked past `fontSize: nested ? 10.5 : 13` — which is how the district's own name stayed at thirteen pixels while everything around it doubled. It strips quoted values and looks at the whole expression now, and found two more in the reach lens and the panel.
  
  Two knock-ons, each fixed at its cause rather than tuned away. A fan of tucked cards is spaced in layout units and drawn at the plane's scale, so the gap between two tucks is `step − scale` of a card: at 0.86 against 0.78 that was air, and against 0.9 it became six pixels of one card sitting on its neighbour's label. And the fan was allowed the parent's width *plus the gap* — but the gap is not spare room, it is what keeps one district off the next. Both were caught by `audit-ui`, not by eye.
  
  Finally, a panel's heading wraps. Both halves of that row are sized in `rem` now, so a reader on Largest doubles them, and on a phone "The rotation · 2026–2029" reached eight pixels past the screen — caught by the calendar harness's own reader-settings check, which is exactly what it is for.
- 7546a38: An opened district says which of its members is in trouble. The card's count already said "⚠ 1"; opening it to find out which member that was — the whole reason to open it — showed every member as a plain chip. A flagged member now carries the same "⚠" and the same title the glyph view has always given it.
- 09a23a3: From altitude a district stands as the kind's own drawing, not as one more box. The figure was an eighteen-pixel chip on the nameplate while an anonymous isometric block carried the whole landmark — the emphasis exactly backwards, since the box is what every kind looks like and the drawing is the only thing on the screen that says which kind this is. The population still reads, in the drawing's size rather than a box's height. A kind with no figure keeps its block; nothing about a figure is required.
  
  Standing a district on a figure showed what the shipped art actually was at more than twenty pixels. `person` was two crescents — a head drawn as two arcs is a circle only while it is too small to see — and is now a standing figure with a head, a torso, arms and legs. `rule` was a ruler lying on the diagonal and `note` a flat document icon, the two figures in the set drawn square to the page while everything around them stood in the city's own projection; they are now a set square standing on its edge and a leaf of paper standing with its corner turned.
- 7246f46: A field is asked for in words. The actions strip's ask and the editors opened in place named their fields with the declaration's identifiers — `label`, `dependsOn` — while the pages face has always humanised them. Both faces read the same now, from `humaniseField`.
- 92a2f73: What a person reads names a field, a relation and a group in the declaration's words, never by id. `fieldWords(definition, key)` is the one place a field becomes words (its `display.labels`, else the key spoken); an editable value's tooltip no longer says "changes "plannedAt" through a mutation", the inspector no longer says a line's edge is "rides-in", the calendar's refusals and the structure suggestions ("all 3 share the day "mon"", "(assigned to)") read in words, and `bandAggregateWords` names a band's group — the seat had been calling one "album|released-by|in|type=album".
- dfbba3f: A figure is handed to the DOM once, and it fits the card it is drawn on.
  
  React 19 decides whether to re-apply `dangerouslySetInnerHTML` by comparing the prop object to the last one by identity, so the inline `{{ __html: art }}` every call site wrote tore the art out and parsed it again on every render — thirty-four times for a single click on the ground. The wasted parsing was the smaller half: a double-click only pairs if both clicks land on the same node, and the re-render the first click caused had already replaced it, so double-clicking a district on its figure selected the card and went nowhere while double-clicking the same card an inch to the left travelled into it. A new `useMarkup` hook holds the object still, and the brand's logo goes through it too.
  
  The figure also moves from its own row to the name's line. On the ground a district card is a glyph — seventy pixels holding a name, a count, a trouble mark and a control — and a drawing above the name pushed the content past the card's own edge on every card in the strip, clipped rather than visibly broken, which is why only a measurement caught it.
- 509162f: A project `graview create` writes passes its own checks again. Its first kind's `label` is bounded (`z.string().min(1).max(60)`), so `graview check` has nothing to say about a fresh project; its routed home page hands `<Begin>` the store, since the pages face has no provider around it. And on a narrow Graview the companion's sheet makes room in the picture for itself, as the actions strip always did, rather than lying over the district it is about.
- 3f86b09: A glance does not say its heading again, word by word. A card's summary and a list line dropped a value only when it was the whole heading, so a vehicle headed "2027 Subaru Forester Sport" — its label built from its year, make and model — spent two of its three facts on "Year 2027" and "Subaru" and never reached the price. `readableFields(..., { glance: true })` drops a value the heading carries as whole words; a record's full facts keep every field, because that is where each one is changed.
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
- 1ebfd44: A kind has a figure. `defineNode(kind, { figure })` takes inline SVG — one `viewBox`, `currentColor` strokes, no fill — or the name of one from a small shipped set (person, plot, box, task, shift, list, vehicle, rule, note), and a brand may override any kind's. One `<KindFigure>` draws it everywhere a kind is drawn: the kind card at altitude, the district beside its plural, the routed face's rails and record eyebrows. A kind without one is drawn exactly as before; nothing about a figure is required.
  
  `graview check` refuses a figure that cannot be drawn — no `viewBox` (nothing can size it), a literal colour (invisible in one of the two schemes), nothing stroked with `currentColor` (it will not take the kind's ink), or a name nothing ships — and refuses a brand drawing for a kind the app does not declare. `drawFigure` in `@graview/tools` asks a model for one in the house style and judges the answer with the same function, so a drawing that would fail the build never reaches a person as a proposal; a model that throws or draws badly falls back to the nearest shipped figure BY NAME and says so, because guessing that a cleat is a box would be the framework having an opinion about a domain it has never met. `graview figure <entry> --kind <k>` prints the line to paste.
- a23e496: A kind can say what one of it is called. `defineNode("staff", { plural: "Staff", noun: "staff member" })`: a kind whose id is a mass noun — staff, equipment, inventory — had only its id for a singular, so every sentence about one read "Change the staff", "Remove the staff", "a staff called …". `nounOf(definition, kind)` is the declared noun or the id spoken, and the derived edit and remove acts, the strip's "nothing you may do with …", the routed face's pickers and search, the chat's facts and derived questions all read it. The studio carries it through the round trip and writes it back, and graview-node-kind says when to declare it.
- e0d5026: A kit for the picture. Everything the scene draws that is not a view — the lines, their captions, the ground's grid and lattice, the kind tags, how far the unlit recedes, the mark a broken rule leaves — is declared on `brand.kit`, any part of it, the rest as shipped. A connector's route is a named strategy (`curve`, `straight`, `orthogonal`) and its stroke a named pattern; each is one case in one file, so the next is one more case and nothing in the scene moves. Colour and visibility are per edge kind under `connectors.byEdge` or for all under `connectors.all`; a kind kept quiet is not drawn and stays selectable from the inspector. `themeCss` emits the kit as `--graview-kit-*` custom properties that the ground and the tags read. `graview check` holds an explicit line colour to 3:1 against both grounds in both schemes (`kit-contrast-below-aa`, `kit-colour-unreadable`). An embed's handle gains `setBrand`, so a page can re-dress a running Graview.
- 4ab1b6d: A lens arranges before it draws. `useArranging(props, options)` reads the arrangement out of the stop, applies it to the nodes a lens is about to draw, and hands back the row to draw above them; the board, the timeline and the calendar take it. Each says what it has no place for — a board has nowhere to group, a timeline's rows are its columns, a calendar's order is its dates — and an app declines the rest with `arranging: false` (or per part) on the lens options, and says what a picture opens arranged by with `arrangedBy`. The board arranges its occupants and keeps every slot, drawing them within a slot in the order the arrangement put them; the timeline filters and sorts its spans; the calendar filters everywhere and, in the agenda, groups the entries under headings by a far end. Rota's fortnight opens its agenda by where each shift happens. Things' own list page arranges through the same module under the same words, opening its tasks by list, open ones only, by name.
- fc024d0: A lens chooses its shape by the room it has, and a narrow embed keeps its room for the picture.
  
  The coverage matrix's 316px label column put every column past the edge of a phone-width card, behind a sideways scroll nothing announced — names and no cells. The names now take a share of the width, and where the columns still would not fit at a fingertip each the matrix stacks: each row is its name and then its cells as labelled marks that wrap. Seven day columns in a 300px box were 40px cells with three letters in them; below about 44px a column a run of days is drawn as the agenda, and coarser cells wrap into as many columns as the width holds. The calendar's six range chips become one select when the card is narrow.
  
  The scene kept a fifth of a 360px embed clear for rails it does not draw there, and the layout took six gaps more off a focused card: a lens got 145 pixels. Below a phone's width the rails are gone and the focus margin is capped at a tenth of the span. The embed's strip, whose place and seat pills wrapped to five rows, shows the places and the seats as one select each when it is narrow.
  
  And the example's season and rotation calendars, declared on the chapters and never handed to the views, are drawn on the pages that explain them.
- 41abe03: A lens is a drive-in: the picture stands at its kind's plot, and descending is walking up to the screen. From altitude the focused group's named picture no longer floats in the middle bound to no kind — it is a SCREEN standing on that kind's plot, anchored to the plot's far edge and centred on it, sized by the plot's side with a floor for legibility, drawn with the same natural size and shrink as before (the interface scaled, never re-laid-out small), and shrunk only as a last resort until it stands on no other district's nameplate. A picture over two kinds (`ViewMeta.across`, carried on the `Place`) stands on the road between their plots. `LayoutNode.screenOf` names the kind and survives the tween; `LayoutOptions.screens` is the registry's named places by kind. With the screen on its own plot the city no longer slides aside for a picture in the middle.
  
  Every kind with a named place has a drive-in on its district card from altitude: a dark screen and a marquee of real, keyboard-reachable buttons labelled "<plural>: <title>". Pressing a showing focuses the kind with it and descends in one gesture — the lens is already drawn at the plot, so the descent tweens from the screen to plane 0 and reads as walking up to it. On the focused drive-in, pressing another showing switches the picture without descending (`in.view` changes, the stop stays at altitude and round-trips through the address); pressing the showing that is showing walks up to it. "Focus" from altitude descends into the focused drive-in, else the selected kind's, else the first kind that has one. Focusing a drive-in off the edge of a large city re-centres the pan on its plot. `useWhereIs("screen:<kind>")` answers with the audience strip in front of the screen, where figures will stand. The road's hit corridor now keeps off card faces by its own half-width, so a press on a district's corner is the district's. The navigation harness drives all of it, including a mid-tween capture that asserts the lens moved from the plot rather than from the centre.
- e165c5b: A titled group view is a place. `register(kind, cell, view, { title })` names it; `views.places()` lists the names; the shell's bar and the embed strip show them as pills, pressed while you are there, so a lens is somewhere to go by name rather than a picture that vanished when you clicked into a member. And the list page withholds a creating act the seat may not take — struck through, with the policy's own reason — instead of offering a form that refuses on submit.
- b83e46f: The coverage matrix and the board keep the scene's horizon. Both read `store.graph.allNodes()` and ignored the members they were handed, so a coverage of songs by theme drew retired demos as rows and called them "unanswered", and a board seated retired occupants. They now draw the group's own kind as the members the scene handed over and every other kind as what is current (`onTheHorizon`).
- f7c6c19: A lens says all its emphasis or none. The coverage grid wrote `data-graview-emphasis` on its row labels and merely painted it on its column heads and filled cells, so most of what a selection lit in that picture was a colour and nothing else — unreachable by a test, and by anything reading the tree.
- a012583: A selected line is headed by what it means. Its menu and pane were headed by the edge's name, spaced — "Works at", "For vehicle", "Drives" — with the declaration's sentence under it; the heading is now that sentence ("Where they work"), and the line under it says how the relation reads from the other end ("From North lot: who works here"), or nothing where no inverse was declared.
- e119b49: A tie points at where a thing is, not at where it was. The lines from a selection to its relations, and the captions over a raised row, were measured from the DOM during render — the render that draws a frame runs before that frame's DOM exists, so every one was measured against the frame before, and after the last frame of a navigation nothing rendered again: dashes started in the air at the edge of a card that had moved. Both are measured in a layout effect now, after the boxes are where the frame put them and before paint, and the ties measure again whenever a scroll or a resize moves something. Every anchor is cut down to what a person can see of it — a chip scrolled off the end of its roster, a row under a panel's fold, anchors nothing.
  
  And a mark is not the thing. The fundamental mistake under every stray line was treating everything that wears an id as a place the thing is: a coverage cell wears its column's id so a press means the column, but it stands at the crossing of a row and a column — it is the edge — and a selected revenue stream fanned five dashed lines up into the cells of somebody else's ownership matrix. A lens says which of its drawings are marks (`data-graview-mark`), a tie never lands on one, and a thing drawn only as marks falls through to the district that holds it.
- da81e1e: The coverage lens draws a matrix the page can hold. Past 80 rows or 48 columns it keeps the most-tied ones, in their own order, and says how many it left out ("the 80 most connected of 568 artists · 48 of 568 artists across"); what is missing is still counted over all of them. A real discography's "who worked with whom" was 568 artists by 568, a third of a million cells, and the page never came back from drawing them. `capCoverage` is exported beside `buildCoverage`, with `COVERAGE_MAX_ROWS` and `COVERAGE_MAX_COLUMNS`.
- 5b5e5a3: A one-press act must be able to act. The actions strip counted only required arguments as open, so a derived edit whose every field is optional looked like a single press and, pressed with just its subject, refused on the button: "Nothing to change — give at least one of label a value." An action with nothing required left is now rehearsed with what it has, and one that would refuse asks for its optional arguments instead, each of which can be skipped; only what was actually said is applied.
- fb5b3ad: The profile pane stays inside an embed's box. Hung from its button's right edge, it opened off the side of an embed on somebody else's page — off the screen at phone width — and the embed's `overflow: hidden` cut it in half; `keepInside` slides it back and caps it to the room below.
- 923bbfa: A profile on the bar. `<Profile>` is the one place that answers "who am I signed in as" and holds what belongs to the reader rather than to the installation: their own record (where an installation is declared), the seat switcher, the settings, and the scheme. Settings are declared — `app.settings`, drawn by the pane, honoured by the provider, and checked: `graview check` refuses a setting nothing can apply, one with nothing to choose between, one that opens on an answer it does not offer, two that share a name, and a root font size that is not a length. `readerSettings()` is the two every app should offer (text size and motion); `applySettings` carries them at the edge so an app's two faces agree.
  
  Two bugs surfaced underneath. The theme set `font: 0.875rem` on `html, body` — so the ROOT's own size became 0.875 of the browser's, every `rem` in the framework resolved against 14px instead of 16, and the one place a text-size setting can live was already occupied. The body is sized now; the root is left exactly as the reader has it, and "As your browser has it" stamps nothing rather than guessing. And `usePickTargets` stamped `role="button"` on every pick target including landmark elements, which ARIA forbids — three `<header role="button">` on the first screen of the demo, unnoticed because nothing had run axe over the scene. The role is now stamped only where it is legal; a target that cannot take it still gets `tabindex`. Motion is overridable by the reader: the stylesheet's reduced-motion rules are emitted once for the system's preference and once for `data-graview-motion="reduce"`, scoped so an embed honours a host's answer without restyling the host.
- d042ff2: A relation's caption is an h2. The connections panel wrote each group's caption as an `h4` for its size — which its own style sets regardless — and the only heading above it in a scene is the shell's `h1`, so axe reported `heading-order` on every screen with a relation drawn in it and a screen reader's heading list read as though two sections were missing.
- c5e4ac7: A robot you can catch, and a robot worth looking at. A following robot holds still when a hand comes for it, so it can be pressed to let go. The figure is redrawn: a dome head with a visor and eyes, an antenna that lights while it follows, the city's own iso block for a body, an arm that comes up with a pen while it writes. The drive-in from altitude loses its grey stand-in screen; the marquee band is sized from its showings wrapped to the card, and the building under it sizes from the room that is left, so showings no longer stand on a roof.
- 2cc27e9: Another seat's work is named by the seat's name. `nameOfAuthor(author, { graph, schema, seats })` reads the user node, else the seat the principal was offered under, else the id; the activity rail, the profile, and the routed face's history use it, and `PageContext` carries `seats` (the embed hands its own over). An app with seats and no installation read "user-lena" and "U user-june".
- b90b6c7: A seat signs its own work. `AgentSeat` wrote every op with the author id "claude", hardcoded — so two seats on one embed were indistinguishable in the history, and a seat that is a rules mender or a scheduled job wore a vendor's name. `who` is now a required prop, the way the chat seat has always signed "chat".
- a5d4967: A seat that may not sit down says so. An agent seat the policy refuses was disabled and wearing its idle label — "There is something here already" — while the real reason sat in a `title` on the disabled button, out of reach of a keyboard. It is struck through with the reason beside it now, the way the actions strip states a withheld act.
- 97067b6: Two more selects keep their floor in WebKit: the bar's compact Places picker and the calendar's Range picker on a phone. WebKit draws a native select at its own height and ignores `min-height`, so they measured 22 and 21 pixels tall in Safari; the native look is off and a chevron is drawn in the text's colour, as the arrange bar and the places menu already do.
- e809183: An embed's stop may name a place. `#view=the-season` is the link a page can write — `placeHref` spells it — and the scene's URL sync has resolved it to the group the place is a picture of since it existed; the embed read its `stop` through `fromUrl` alone, so a host page saying `data-stop="#view=the-season"` landed at the default view with the place's pill unpressed. The embed resolves it now, on mount and when the stop changes through the handle.
  
  A board in a room with no height of its own is sized by its width. The board lens drove its size from the measured height of the room it stood in, which a scene band and a page region have; in a chapter embed on the docs site the panel sits in a column as tall as its content, so the room measured four pixels, the board came out six by four, and every slot on it was a four-pixel target. Below a height a board could be read at, it takes the room's width and lets its aspect give the height, which is what a board in a document is.
  
  The embed has a fourth face, `picture`: one named lens and nothing else — the place the stop names, drawn at full size over the kind's current members, with no bar, no rail and no standing. A page that is about a lens shows the lens, not an app with the lens somewhere inside it; three of those stacked on the docs site's lenses section were three windows with a calendar somewhere in each. `PlacePicture` in `@graview/pages` is the component behind it, for an app's own page that wants the same.
  
  The calendar's day grid and agenda list are keyboard stops. Given less height than their rows they scroll inside themselves, and a region that scrolls with no focusable element in it is one a keyboard cannot scroll at all; each carries the span's own name.
- 8041853: A decision provider is a third kind of intelligence, and the declaration says so. `intelligence[].kind` accepts `"decision"` beside `"graph"`, `"llm"` and `"external"`: a provider that answers typed questions — a Choice over named options, a truth, a Score over an ordered rubric — with a confidence, and never prose. `providerCan(provider, "prose" | "decide" | "propose")` derives what each kind serves from the kind alone, so a surface asks whether a provider can before offering it.
  
  `graview check` holds a decision provider to what it can decide: an act on its allowlist whose required arguments want text, a date or an unbounded number is one it could never call, and is refused (`intelligence-decision-cannot-call`, naming the act and the argument); a paste or MCP door on one is words out and words back to something with no words (`intelligence-decision-prose-door`). `undecidableArguments(mutation)` is the function behind it, exported for the surfaces that will derive questions. `graview describe` and the generated docs read a decision provider out as what it is, and the `Door` draws none for it — a prompt-out answer-back door is a chat offered to a thing that cannot hold one.
- 83a40ed: A drive-in's thumbnail is a frame holding the lens drawn small and a press laid over it, no longer a button holding the lens: a calendar's own Previous and Next ended up inside the marquee's button, which is invalid HTML however inert the copy was, and React said so on every chapter with a calendar. The places control and its compact menu set their borders and background in longhand, so a change of place no longer overwrites a shorthand with its parts on every render.
- 4c4d52a: A drive-in's thumbnail is a picture of its lens, not the lens. It hands the lens its 12 most relevant members (the flagged, then the most connected) with `budget` and `total` — new on `ViewProps` — and is mounted the first time it is on screen with the scene still, one thumbnail a frame; `useSceneStill` and the scene's motion store say when. A lens with a budget draws no arrangement row, the coverage holds its rows and columns to it, and the board, timeline and calendar say "+N more" in the kind's words (`withMore`, exported). The row's "only…" menu offers at most the 40 most connected far ends — a release's menu listed every song. Over Tech N9ne's catalogue the city at altitude went from 21,335 elements to about 1,200, and rising from 21,495 to 2,493 with every thumbnail drawn. The graview-lens skill says what a lens does with a budget.
- b9b0635: A time of day is asked for. An argument whose pattern is a date with a time in it (`YYYY-MM-DDTHH:MM`, the gauntlet's workshop start and a talk's slot) described itself as a plain date, so every face offered a date picker, the picker gave `2026-09-20`, and the act's own pattern refused it: no workshop could be made and no talk given a slot, on either face, at either width, with either hand. The date shape and its form field now carry `time: true` for such a pattern; the routed form, the scene's ask, the edit in place and the studio's agent panel ask with a date-and-time control, and the conversation and the starter fill one with a time of day.
- 40f39ff: A field's value on a card stays in its cell. An editable value was a button as wide as its words, so a value with nowhere to break — an email address, a VIN, a URL — ran out of the facts column and under the relations beside it. The button is never wider than its cell and, like a read-only value, breaks anywhere.
- 5297528: A withheld act says why. The actions strip named a refused act and put the reason in a `title` on a disabled button, which cannot be focused — so the explanation was out of reach of a keyboard and required hovering a dead control. It is struck through with the sentence beside it now. `Grant.describe`, documented since it was added as the thing shown on a refusal, is finally read: a refusal repeats the policy's own words. And a refusal about a derived edit counts the grants that name it as well as the acts it rides, so a `mutations: "*"` grant no longer produces "no role can".
- ce13ec8: The board lens draws a token when a code is a word, and shelves a zone's slots when the arrangement is categories. A 34-pixel disc holds "GK" and "LB"; it never held "Outbound", which spilled past its ring, or "Prop-fin", which wrapped at the hyphen inside it — and a slot's code is its whole label whenever nothing shorter is bound, so most boards outside a pitch were boards of words in circles. A board whose every code is three characters or fewer still draws discs. Any longer and the whole board draws tokens: a pill sized to its code, cut with an ellipsis past the width of a long word and carried whole in the title, with whoever is in it on the line beneath, INSIDE the mark — so a mark is one box whose size is known, and two names on a shared seat can no longer land on the row below. `occupantLabel: "given"`, which shortened those names to hide the collision, is gone.
  
  `arrange: "shelf"` is for a board whose x and y are categories rather than coordinates — a load map whose rows are "still owns", "shared", "handoff". Each zone becomes a band with its name as a heading row of its own, and its slots flow into rows in the domain's order, sized to what they hold; nothing on a shelf can overlap anything, and a zone's name can no longer be clipped to the middle of the word by a fifteen-pixel rail. The default, `"exact"`, is unchanged for a pitch or a seating plan, and its rail now ends a name that does not fit with an ellipsis and carries it whole in the title.
  
  The `graview-lens` and `graview-new-app` skills and the package READMEs say so: the board's two marks and its two arrangements, and that a new app's pages face wants the scene's `views` to land on its gallery.
  
  A placed mark is as wide as what it holds: an absolutely placed token with no width of its own shrank to the room between its point and the field's edge, so on a phone-width board a token at 82% was 22 pixels wide with its word broken inside it.
- 959955f: An agent in the studio: ask for a declaration change in words, see it checked, keep or discard it.
  
  Both halves of this already existed and nothing joined them. The studio could take a proposal from an agent seat — `propose`, `proposals`, `decline` — and the chat panel could already turn words into proposals over the ordinary runtime. But the studio itself had no agent in it, so the one surface whose subject is the declaration was the one surface you could not talk to: every change by hand, one act at a time, with the whole shape held in your head.
  
  The studio's bar now carries its own Ask. A turn produces PROPOSED studio acts and stops there — nothing is applied by asking. Each proposal is put through the new `Studio.would`, which applies the call to a copy of the store and checks what the declaration would become, so `graview check`'s findings are read before anyone is asked to keep anything; a change that would add an error is struck through with the finding that condemns it and has no Keep button at all. Keeping calls `studio.propose`: an ordinary op in a batch of its own under the agent's name, with an inverse, so the studio's trail says who proposed it and undo takes it back.
  
  Keyless first, like the rest of the ladder. `studioResponder` reads the meta-graph and answers about the declaration itself — what kinds there are, what an act writes, what a rule judges, who may take it, which kinds have no figure — and fills studio acts from a template: "add a due date to tasks" becomes `add-field` with the type the name implies, optional so records that already exist stay valid; "every shift needs a volunteer" becomes a rule over the shift. A model upgrades it through the same one-function `Completion` seam, with the studio's own floor under it, so a fact the declaration holds is never replaced by a fluent guess about the same fact.
  
  This is also where the `drawFigure` gap lands, recorded honestly when figures shipped: the drawing carried the house style and judged its own answer, and was reachable from code and from `graview figure` and from nowhere a person sits. "Draw a figure for volunteer" now reaches it from the studio, and a figure is finally something a declaration can carry through the studio at all — modelled on the kind, read in, written back, and written into the schema file. Before this, opening the studio on a drawn app and applying would have rubbed every drawing out.
  
  `figureFaults` — the checker's own judgement — now closes the drawing vocabulary: a figure is line art made of drawing elements and drawing attributes, and a `<script>`, an `onload` or a remote `href` is a fault with a name rather than something that passes a style check and is inserted as markup. That is what makes a model's drawing safe to show somebody before they keep it.
- 71de067: The arrange bar's selects keep their 32px floor in WebKit. WebKit ignores `min-height` on a native select, so at phone width every sort, group and filter select was 22 pixels tall there; they now drop the native appearance and draw their own chevron.
- b5e43ab: An empty graph is not a misbinding. The coverage grid and the board both threw a binding error whenever the kinds they were bound to held nothing — which is every kind of a blank app, where a lens's title is in the bar from the first paint and pressing it took the scene down. A role naming a kind nobody declared still throws; a declared kind with nothing in it is an empty picture.
- d59b6c8: An opened district lists what it has room for, in names you can read. The layout reserved 96 pixels under an opened district and the view listed sixteen members in 250, two columns of ninety-five pixels, under a header whose name column could shrink to nothing: a dealership's Vehicles, opened at the foot of an eight-district city, read "VEHICL291ES" over sixteen chips of "2026 Ma…" running off the scene. The layout now reserves rows (`rosterRows`, `rosterHeight`, `ROSTER_ROW` exported), tells the view how many the city kept room for (`openedRows`, carried through the tween), and the view lists that many in as many columns as the names can be read in (`rosterOf`), with the rest counted. The header wraps its count under the name.
- 6af312b: An undo that is refused says so. `store.canUndo` answers what the log can answer — whether a later op read what this one wrote — and not what the declaration answers, so taking back a migration that added a required field threw out of the click handler: an unhandled error and a button that appeared to do nothing. The reason is shown on the control, the way the agent seat already shows its refusals.
- 455ef3e: The board lens takes a choice about what a press selects. `pickTarget: "slot"` makes a press on a mark choose the slot itself even when one occupant fills it — a load map is asked about the component, not its sole owner — where the default, `"occupant"`, keeps a sole-filled mark standing for that person.
- 2c25067: Casts the compiler did not need are gone: 163 lines of `as never` and 52 `as unknown as` narrowed to a single cast, each removed only where the whole monorepo still type-checks without it. What is left is where the types genuinely cannot say it.
- b3ed5f6: Confidence is a first-class answer, not a number in a log. `PlannedCall.confidence` (0–1) is how sure the proposer was, carried on the call rather than written into `why`, so the same number travels wherever the call does. A run's every answer reaches a surface with its confidence and full distribution (`Answered`); an answer that came back split — the top two options within `splitWithin` of each other, "turf 0.5, bed 0.45" — or below the `floor` is not applied and not dropped but OFFERED: an `OfferedQuestion` naming the node it is about (id and label), the question in the declaration's words, why it is asked, and each option with its probability and the call it would be. `offerOf(answer)` is the rule. A confident answer is still a plan before it is a change.
  
  Offered questions travel the seat's own reply — `ChatReply.questions` — and `replyFromRun(result)` speaks a whole run that way: what it asked, the confident calls as proposals, the rest as questions, a refusal or a stop said out loud. The chat panel stands each question at its node, "Back Lawn: Which surface?", with the options as presses that land through the same attributed, undoable path a proposal does. `PlanReview` reads a plan whose calls carry a confidence least sure first, with the number beside each row, and still applies it in the plan's own order.
- 73b30dc: A coverage grid's column names stand on their columns. The heads and the cells are the same box now — border and padding inside the width on both — where a border outside the cells and padding outside the row names had them drift ten pixels plus one per column. And a column scrolled under the sticky names takes its name with it: its label no longer hangs over the columns still in view, which made a grid scrolled four columns along read as every label four columns out.
- e9f07b3: The stylesheet no longer carries rules for what nothing draws: the seat's speech bubble and trail (its body left the picture), `.graview-kind-note` and `.graview-visually-hidden`. The occupants' comment says what they are now — the others, not this tab's seat.
- b79ef9a: Escape on a popover gives the keyboard back to the button that opened it. The activity list, the problems list, the chat panel and the profile pane each closed on Escape and left the keyboard on the control inside the pane that had just gone, so the next Tab started from the top of the document — and in WebKit went nowhere. `closeToTrigger` moves the keyboard to the popover's own `aria-expanded` button when it was inside, and leaves it alone when it never was.
- 05aaa72: Escape out of a record lands the keyboard on what still draws it. Backing out of a record at altitude took its card away with the keyboard on it, and the keyboard fell to `<body>`: the next Tab went to the zoom buttons in Chromium and elsewhere in WebKit. `BackOut` now notices when the element the keyboard stood on leaves the picture and puts it on the card that holds the record's chip — its district — or, failing that, on a card in the scene (`landTheKeyboard`, exported).
- 796bf9e: Every picture paints at a real size. A panel's "there is more" fade is painted in the panel's own ground rather than masked: a mask made the scroller an offscreen layer, and one painted before its rows arrived stayed black. A thumbnail waiting to be drawn is as tall as a picture, so one drawn at a twentieth of its size is still seen and drawn, and two pictures' names each keep to their own frame. A kind tucks behind the kind it hangs off only when the row needs the room; with room for every kind, each has a slot of its own. A calendar horizon longer than a decade draws a year to a cell. A card on the relation plane shorter than a summary's 80 pixels draws as a chip rather than a title and a sliver. The coverage matrix is built from an adjacency rather than a scan of every edge per column, a view's group members are looked up once per graph, and a tween's stand-ins once per pair of stops.
- a6f64b0: Every size the framework draws is the reader's to change, and a test says so.
  
  The text-size setting works by one number on the root element, which is why every size here is written in `rem` or `em`. A single `font-size: 10px` opts one control out of it entirely — and four of them had. Set to Largest, every name in the city doubled while the district's own "open" control stayed ten pixels tall, along with the "+N past" tag, the altitude caption and every `<code>` span. The profile's mark was an 18-pixel circle around a letter that had doubled, and the name beside it was clipped to "Nobody in p…" by a 220-pixel cap.
  
  All of it is measured now rather than asserted: a probe loads the app at the browser's own size and at Largest and diffs every box. What came back was fifteen boxes that never moved while the text doubled. The framework's are fixed — four stylesheet rules, the profile's mark and name width, and five sizes in an embed's own chrome — and a new test walks the source of every package a person installs and fails on a font size written in pixels, in either spelling. A list in a commit message is not a guard.
  
  The demos had the same bug in bulk and are converted too: the garden's own product design (28 sizes), the launcher, and Things' views. `apps/promo` keeps its pixels on purpose — a 1920×1080 video composition has no reader and no setting.
  
  A district's drawing now keeps up with its name. The drawing is sized as a fraction of its card, the card is laid out in pixels off the stage, and the nameplate is sized in `rem` — so at Largest a doubled name stood over a drawing that had not moved at all, a postage stamp under a headline. It has a floor in `em` now, capped at the card: a first cut without the cap overflowed and the drawings were sliced off at the bottom edge, a plot reading as a V rather than a bed.
  
  **What still does not scale, named rather than hidden:** the scene's card geometry. `graview-kind-card` is 230×97 at every text size, because the layout sizes cards as fractions of the stage in pixels while their text is in `rem`. Making the city itself grow with the reader means fewer districts fitting on the ring, which is a layout change with its own design decisions — worth doing, not worth pretending is done.
- 894f0f1: The quick-select chips beside a focus can be told apart. Each was its member's name cut at eighteen characters, so a customer's three test drives — each named for the customer and the vehicle — were three chips reading "Wei Haddad in the…" and three buttons with that one name. Where two cut handles would read the same, the words they share are what is cut ("…2017 Jeep Wrangl…"), and every chip's accessible name is its whole name. `handles(labels)` is exported.
- 130e9c6: In a narrow box the picture makes room. The actions strip is a left rail sized for the gutter beside a centred focus — and in a 350-wide embed there is no gutter, so it covered 85% of the card it was about and a click meant for the picture landed on an action. Where the scene's own box cannot hold a rail beside the picture, the pane goes along the bottom and the scene gives up that height while it is open, so nothing is drawn under it.
- 2dd2f0e: Longer horizons on the calendar lens: a quarter, a year, and a span of years the app names.
  
  The calendar topped out at a month, so anything further out than four weeks was off the end of every picture the framework could draw: a planting sown in March and lifted in July, a plot on a rotation, a quarter's coverage, a lease, a review cycle. An app whose subject was years had no lens at all — it had a month grid it could page through twelve times.
  
  The same lens now draws a quarter, a year, and a multi-year horizon **whose span the app names** — three years, five, ten — rather than a "5yr" button the framework guessed at. One binding and no new declaration: a lens declared once draws at every horizon, and `graview check` reads exactly the binding it already read.
  
  The cell coarsens with the horizon — a week per cell at a quarter, a month per cell at a year and beyond — and `spanOf` now answers with CELLS rather than days, because a day cell and a month cell differ in how much ground they cover and in nothing else. An entry spanning cells is drawn across them the way a fortnight is already drawn across days, keeping its name where it begins and again wherever a row does, which is what a wall calendar does. Above a month, listing everything stops being a picture, so each cell carries what fits at full fidelity and the rest as a count with the rules' own flag on it.
  
  Each range is an addressable stop, and `lens.at(range)` registers one as a titled place of its own: `places()` lists it, the URL names which one you are in, pressing a cell opens one level finer, and Back returns to the year you left. Rescheduling is unchanged — the declaration's own act, judged by `store.permits`, refused in the policy's words — with one new honesty: dropping onto a cell coarser than the date the act writes says which day it wrote, rather than rounding silently.
  
  The demos exercise them, which is the only way anyone finds out whether they are any good. Seedbed gains a sixteenth chapter: a `rotation` kind, one act, and four years of two beds turning through four families — the first thing in the garden whose subject is years rather than one season — plus a year over the plantings. Rota gains a quarter over its shifts, which is how a roster is actually planned. `verify-calendar.mjs` drives all of it in a real browser: forty-eight cells over four named years, a rotation drawn across the eight months it runs, drilling into 2028 and coming back, a coarse drop saying what date it wrote, axe clean at 390 and 1280 in both schemes, no spill at 200% text, and the reader's motion setting honoured.
- 171075a: Nothing hangs below a card in the stack. The district card clips (not hides) what rests under its foot, so the invisible iso block waiting to rise no longer makes the stage scroll; from altitude the card opens again. A robot whose foot is on the ground is drawn far enough in for its whole body, name included. The survey counts a cut only when something a reader could see is behind the edge, and names it.
- 4450ee4: Nothing in the rail paints over its neighbour. The conversation sits between the acts above it and the relation key below, and a section that is handed less height than its content will paint the difference straight onto whatever comes next — which is what expanding "What the lines mean" looked like. Three things now make that impossible rather than unlikely: the rail's rows are sized by their content and packed at the top, so a row cannot be compressed below what is in it; the conversation carries a `min-content` floor of its own and one layer fewer between it and the column; and it clips, so the worst an engine that disagrees can produce is a section that scrolls inside a rail that already scrolls. The companion harness opens the key with something in hand and fails if any section overlaps the next or spills its own box.
- 9bad891: Nothing withheld is hidden in the strip. Under a policy the rail struck through the first three acts a seat may not take and dropped the rest without saying so; past three it now offers "Show N more withheld".
- 3e3bfff: One door for what is yours: the scheme, the installation and the studio move behind the profile — and Back knows about both of them.
  
  The bar carried "Show the installation" and "Studio" beside the places, so every reader met two controls only a keeper can use in the same row as the app's own pictures. It also carried a scheme toggle while the profile pane carried a pair of scheme buttons — two controls for one setting. All three live in the profile now, under a heading that hides itself when it holds nothing, and the profile button wears a gear so the settings can be found rather than discovered.
  
  **Both doors are stops.** Showing a module said in its own comment that it was one — "so Back knows the way out" — and it was not: `shown` was missing from the comparison that decides whether a change pushes a history entry, so the address gained `show=installation` and the entry was REPLACED. The arrows stayed grey and one Back from the installation left the app. Opening the studio was component state, so the one door in this interface the back button knew nothing about was the door into the app's own declaration. It is `in.studio=open` now: the browser's arrows and the bar's own carry you in and out, a link can open it, and closing puts you back on the stop you came from. `adjustment` is exported and tested, and `verify-navigation.mjs` drives both doors in a real browser.
  
  Three things had to be true for the move to work. The pane is **mounted whether or not it is open** and hidden instead — a control in it may own something that outlives it, and unmounting the pane on the first press inside the studio took the studio's portal with it. `hidden` alone was not enough, because the pane's own inline `display: grid` beats the browser's `[hidden] { display: none }`, and a closed pane that still swallows presses is worse than one that is merely visible. And a press inside a dialog the pane opened is not a press "away" from it.
  
  Two things the move exposed, both fixed: the seat switcher did not wrap, so in a 280-wide pane the third seat was a name cut in half; and "Your record ↗" was a nineteen-pixel control, which no audit had ever measured because until now no audited screen opened this pane.
- 2b2df36: One matcher finds a thing anywhere in the graph. `search(store, query, { principal, from, subject, places, today, limit })` in `@graview/core` returns ranked hits — a record, a kind, a place, an act or a rule — each with a `why` naming the field that matched and the words around the match. Matching is on folded text (case, accents and punctuation aside), every word the start of a word, never fuzzy; `key:value` tokens are the arrangement's conditions, applied to the kinds that offer them, with `kind:` to narrow and `is:any` to include past records. Records rank by how the words matched (exact name, prefix, whole words, parts, a field), then near the subject, current before past, recently touched, flagged, alphabetical. What a seat may not see is not a hit, and an act is a hit only on a highlighted record. The arrangement's `q` uses the same matcher, so a list's `?q=` and the Find box never disagree. The agent's runtime gains `search_graph`, first among the read tools, with the records it named counted as reads; the MCP instructions say to reach for it before `get_graph`; `graview describe` and `llms.txt` say what each kind is searched by.
- a9381af: One control row arranges every surface. `ArrangeBar` in `@graview/primitives` draws Sort by (with a direction), Group by (with a bucket for a date), the conditions as chips with one grouped select to add another, and the words a person types — all from `arrangeable()`, so it offers only what the kind's declaration offers, in the declaration's words; a surface hands the current arrangement in and takes the next one back, and declines a part with `allow`. `arrangementOf(view)` and `withArrangement(view, next)` carry it in a stop as `in.sort`, `in.filter`, `in.group` and `in.q`. The arrangement grammar gains `q`: words a node's label or any scalar field must contain, the same matcher a search would use (`matches`).
  
  The pages list page arranges through the shared module under the shared keys — `?sort=due:desc`, `?filter=done:false,holds:today`, `?group=due:month`, `?q=tape` — and keeps every link it used to write: `?by=<edge>` groups, `?<edge>=<id>` and `?with=<edge>` narrow, `?past=1` widens the horizon. A stale link that asks for something the kind cannot be arranged by is told so and shown the rest. The kind's default picture in the scene draws the same row at full fidelity and groups its members when asked, with the choice in the fragment so an arranged district is a link and Back restores it.
- d9bfdb8: One seat, one conversation. The app's chat and the studio's declaration seat are the same thread now: `useSeatConversation`, `SeatThread`, `SeatHeader`, `SeatComposer` and `SeatSettings` in `@graview/primitives`, used by both `ChatPanel` and `StudioAgentPanel`. The person in a bubble, the seat in prose with its rung aside set quieter, each proposal settling in place ("✓ …", struck through when discarded, "Refused: …" beside the form it came from), "Apply all" / "Keep all" in order, and the history the model is told includes what was applied. The studio's gear opens the same `LadderSetting` the profile holds; `IntelligenceSettings` is retired. `StudioAgentPanel` takes a `respond` like `ChatPanel` does.
- 8976510: One switch, four rungs — and a rung that says what it cannot do. `IntelligenceConfig.source` is now `"graph" | "local" | "decision" | "remote"`: graph only, onboard AI, Jev, LLM — one setting, live, saved in the person's own browser. The ladder has two axes and `RUNGS` says so: each rung declares the capabilities it serves (`prose`, `decide`, `propose`); a surface asks `rungFor(config, capability)` for a capability and never for a provider; and a capability the chosen rung cannot serve falls down to the graph, which is keyless and always there. `capabilitiesOf(kind)` in `@graview/core` is the same table for declared providers, and `graview describe` reads the ladder out — which rungs the app declares and what each can do, and what the graph answers instead on a rung that cannot.
  
  On the decision rung the chat seat is answered by the graph and SAYS so in the answer itself — "(Jev decides rather than talks — the graph is answering here.)" — as part of `ChatReply.say`, not chrome painted by the panel, so every surface the seat speaks from carries the sentence unchanged. A turn that started on one rung while the person moved to another says which rung answered it rather than finishing silently (`configuredResponder`'s `current` hook, wired in the chat panel and the studio's). `decideFor(config)` is the decision behind a rung for a surface that wants one: the provider exactly on the decision rung (by the person's key, or through the dev server's door), a model behind the full parse-and-refuse layer (`completionDecide`) on a model rung, and nothing on the graph rung — where `graphDecide(store)` answers what the store's own rules already decided and names what it cannot. The picker offers the fourth rung with an optional key; with none, the app's decision door is used.
- d5227b5: `store.permits` answers as `apply` would for a declared agent: what its `may` excludes is refused, in the same words. The chat asked `permits` as the person and was told yes, offered a repair as the starter seat that may only add, and the press was refused; it now asks as the seat that applies, and such a proposal is withheld with the reason beside it.
- 3815bcf: Relationships are structure on the routed face. `kindMap(store)` derives every declared relation between the kinds with its own words and its live count, and the face draws it as "How it fits together" on the home page and at `/map`, each line with the same mark the scene's key draws (`RelationMark`, now exported from primitives and usable without a scene), each count opening the far kind's list narrowed to the ones that have the relation. A kind's page says what it relates to, groups by a relation from the address (`?by=<edge>`) and narrows by one (`?<edge>=<id>`, `?with=<edge>`), so a list you arranged is a link you can send. A record links the other way round — the far kind's list narrowed to itself — and says which pictures it is seen in, each a page and a stop in the scene.
- 73690fb: Roads run on the ground. From altitude every pair of districts joined by a declared edge has one road on the ground layer, along the gutters between blocks — out of its plot, along the street, in at the other kerb — so no road crosses a third village and the city reads as villages on a street grid. Lines in the air are drawn up there only when they say something a road cannot: the relation the legend is asking about, the chosen edge, a member of the selection, a change that just happened. A focused screen's every member wired across the city is gone.
- fb6eb5d: The article agrees with the kind. A scaffolded project whose first kind began with a vowel opened on "Add a item …", and said it again on the card, the list page, the form and the act's own description; the checker and the actions strip wrote the same sentence themselves. `article` and `withArticle` derive it from the word instead — including the two families domain vocabulary is full of, "a user" and "an hour" — and the scaffolder, `graview check` and the strip all read from that one place.
- 216ba97: The assistant is on every page, and it is the same one. A routed face that grew a chat box of its own would be two assistants with two habits over one graph, so the pages face opens the scene's companion: one control in the corner, a drawer beside the reading column, the same subject header, acts, relations and conversation. The route is what "this" means — a record page is about that record, a kind's page about that kind, a picture about the kind it is a picture of — set as the provider's selection, so a question means the same thing on both faces. Grounded questions are offered before anybody types (`offer` on `ChatPanel`, also in the scene's rail), answered by the graph's own responder with no model at all. A proposal applies through the same runtime, attributed to chat and undoable, and one the policy withholds is struck through with its own sentence. The seat's open questions are listed on the problems page, which is the face's inbox, and the intelligence rung is chosen from the footer. The control is mounted by the router rather than the default shell, so an app that replaced every surface with a design of its own still has the assistant.
- 5343a1d: The relation band draws what a person can read. Its budget is the cards a row holds at a readable width times the rows it holds at a chip's height; below it nothing changes. Above it each relation (a run of one edge kind in one direction) stands whole if it is small, groups by what its members' own declaration offers — another edge's far end, a choice, a date by decade, year or month, never the relation's own edge, about five groups where it can — or keeps its most relevant members (the selection, the search's hits, the flagged, the recently written, the most connected) in its own order beside one "+N more" door. Groups are aggregates named in the graph's words with true counts, drawn as a band card with their first names, heard as "Single, 80 albums", and opened in place by the `expanded` stop; the door opens the kind's picture filtered by the relation. `bandOf`, `chooseGrouping`, `shares` and `isBandAggregate` are exported from `@graview/layout`, `LayoutOptions.relevance` carries what stands, and the arrangement's dates group by `year` and `decade` too. Focusing an artist with 1,100 songs draws 36 hosts and 50 line strands instead of 1,259 and 2,214.
- 45c7a2c: The bar is one row, and the companion is a rail. The bar had become a run of equal pills — the brand, the way back, the crumbs of where you are, every place, "Pages", the standing, the activity, the profile — that wrapped into two rows at a laptop's width. It is one row now, in three regions: who this is and the way back on the left, with the two faces as one switch; the app's own places in the middle as one segmented control that hands what it cannot hold to a menu rather than wrapping; and what is true and who you are on the right, which give up their words before the bar gives up anything else. The crumbs are quiet, because the picture already shows where you are.
  
  The companion stood over the corner of the picture as a floating card whose header said "starter · listening" and whose tallest section explained what to type. It is a docked rail now — the scene's height, a rule down its edge, the width the layout already keeps clear — titled with what it is about and why (selected, under the pointer, in view), with the actions and relations in a column and the conversation pinned at the foot: the offers, the field, and one line saying what answers. The seat's state shows only while it is doing something.
- 6dd2cfd: The bar and the plates say less. The altitude control reads "Up" on the ground and "Down to <place>" from altitude, where the place is the one you land in; the open chevron on a district's plate appears when reached for — hover, keyboard focus, or while open — and stays a real button in between; "moved" appears on the bar only after a hand panned or dragged in this tab, not for a pan a link carried; hovering a relation in the key lights its roads.
  
  Also: Escape clears the selection again. The profile pane is kept in the tree while shut, and the shell's Escape rule took any overlay in the tree as one open over the scene, so a press with the strip open did nothing; a hidden pane no longer counts.
- 45c7a2c: The billboard is the point of flying closer. Chosen from altitude, a lens was drawn at half the span and under half the height — a window into the picture rather than the picture — and the caps were the window's, so zooming grew the city under the board and never the board. It may take most of the span now, and its caps grow with the zoom, so zooming in enlarges it the way it enlarges everything else. Its grey grip strip with a "⤢ Full screen" pill floating over it is a title bar now: the picture's name on the left, one "Open ↗" on the right, and the whole bar the handle that moves the board.
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
- 5572c41: The chat keeps the keyboard after a proposal is applied: the pressed button becomes a line saying it was done, and the keyboard used to go with it to `<body>`. It now lands on the next proposal still to press, else on the message field.
- 3e719c8: A kind is a neighbourhood: the city is a map drawn from the declaration, and everything in it has an address. `cityMap(schema, hints)` in `@graview/core` is pure and deterministic: it walks the kinds in the order a blank installation fills them (`beginning(app).order`, or sorted ids), puts the first at the origin and each next kind on the free block beside the placed kind it shares the most declared edges with, spiralling outward — in LATTICE CELLS, never pixels. Same declaration, same map; adding a kind leaves every existing plot where it was; population changes a plot's `side` and never its corner. A kind may declare `plot: { col, row }` and is put exactly there; `graview check` reports two on one block as `plot-overlap`. `roadsOf` names the roads between placed kinds, and `graview describe` reads the city out — each kind's plot and its roads — the first thing outside a browser that can say what is drawn.
  
  At altitude `layout()` places the districts by the map on the 2:1 lattice under ONE uniform scale and translate (`placeCity`), so the city has the same shape at 1280 and at 390 wide; nearer rows are drawn nearer with the depth number every plane style already reads; the collision shrink stays as a safety net, the opened listing gives up its room before the city grows, and the city slides aside for the live view standing in the middle rather than laying a district under it. `LayoutNode.plot` carries the address and survives `interpolate.mix` mid-tween; `Layout.city` says which lattice the picture is on, and the ground draws its diamonds at that cell, anchored where cell (0,0) meets the canvas and panning with it. Roads: a connector between two districts runs along the lattice's diagonals (`latticePoints`). Buildings: an opened district lays its members out as a `side`-wide grid inside its plot, each still a pick target, capped at `side × side` with "+n". The camera is bounded by the map's extent (`cameraLimit`) rather than a canvas fraction, so a city wider than a phone is reached by panning and nothing is dropped off the edge.
  
  `useWhereIs()` answers where a node, a kind card, a group or a Place slug is drawn from the CURRENT frame — riding the tween and the pan, measured from the DOM when there is one — with a member not drawn itself answering as its nearest drawn container, the connectors' own rule. `useScenePointer()` is the pointer over the scene in scene coordinates, and a quiet scene runs no listener: the store counts its subscribers and the scene attaches on the first, detaches on the last.
- f80138a: The city zooms and pans by hand. From altitude the pinch and ctrl+wheel used to step the altitude once, with a cooldown — a zoom that stuck — and the drag clamped the person's own pan while the camera's flight to a village sat on top of it, so the far side of a flown-closer city could not be reached. There is a scene zoom now, changed continuously by pinch and ctrl+wheel about the pointer and by zoom controls in the ground's corner, with the fly-closer step multiplied in; the plain wheel over the ground pans; the drag clamps the whole offset, pan plus camera, to the camera limit, so every district is reachable; direct manipulation is not tweened; the zoom resets on the way down. And a tween restarted mid-flight keeps its clock and its easing velocity, so a storm of restarts — two hosts reporting, a pointer's worth of wheel events — no longer crawls a pixel a frame.
- ada0f00: The coverage matrix says what is missing in the kinds' own words — "3 songs with no theme", "2 themes on no song" — instead of "3 unanswered · 2 unasked", a tender's vocabulary shown in every domain.
- 71fd426: The card that stands for the districts the row could not hold is one control, and the districts are one press away. It listed every name inside its own box — a district card's height, which holds a count and nothing else — so "+6" over one clipped word read as a broken placeholder, dashed and faded, and nobody could see what else there was. The card is a button now that says how many more; pressing it opens a panel above the row, portalled onto the scene's ground so no plane paints over it, naming every district with what it holds, each a press to that district. The district you are already in, which lands here when the row has room for nothing else, is marked as here rather than offered as somewhere to go. `@graview/react` takes `react-dom` as a peer for the portal.
- 4472467: Three things about the elevated view. A hand-placed district drew its dashed pin mark around a card with nothing in it — up here a district is a village on a plot, so the only visible part was an empty rounded rectangle sitting on the ground; the plot's own kerb already goes dashed, which says the same fact where the district actually is. An opened district laid its members out `side` to a row so the chips echoed the buildings on the lattice, which at a district's own width meant sixty pixels a chip and "Enough bodies for the drill" arriving as "Eno…"; the columns are set by what a name needs now, because opening a district is the gesture that asks which one. And a view is redrawn only when what it draws changes: a host re-renders on every frame of a flight, a pan and a zoom, and it was dragging every lens with it — the three live pictures on a board and the billboard itself, sixty times a second, for pictures that had not changed at all.
- 7783759: The Find box keeps room to type in. At a desk the bar gives it a floor of 6rem, and the trail's crumb for the focused record is capped and truncates, whole in its title. With a talk of a hundred characters focused, the crumb had taken the bar and left the box 23px wide, and Chromium commits text that arrives without a key — an input method, dictation, an on-screen keyboard — into a field that narrow with the caret left at the start: "Плинов" was written "вонилП" and found nothing. The Shell's bar wraps into its two rows below 920 pixels rather than 720, so the profile — the seat switcher — is never pushed off the screen between a tablet and a small laptop.
- 89f4855: The ground is the city's own grid, and a billboard sinks into its village. The lattice was four repeating gradients phased from the middle of the box and seamed at its edge, so its lines never sat where the city's cells were; it is drawn as tiles now, one cell by half a cell with both diagonals, pinned where cell (0,0) meets the canvas, so every plot corner is a lattice vertex at every zoom. The tween carries the city with it: between two cities the cell and origin lerp, so plots, roads and lattice grow and slide with the cards on them; rising, the lattice arrives with the destination; descending, the ground stays while it fades. And switching lenses across kinds no longer leaves the old picture standing at full size under the new one for the length of the tween — a leaving billboard had no stand-in, since a village's members are ground, not nodes — it shrinks into its kind's signpost and board, and the next rises out of its own.
- f240a12: The ground under a district. From altitude every plot is drawn as the iso tile it is — four lattice corners in the kind's hue, a kerb, a cast shadow — so a district stands on land rather than floating on a hatch; the fields between darken toward the near edge and the lattice carries twice the weight; a hand-placed district's kerb is dashed; the robot's pad is a cell of the ground in the ground's own ink; clicking a tile focuses its district.
- e0d5026: The installation is in the graph. `declareInstallation({ roles, admin })` gives an app a user kind and an invitation kind, the acts on them — invite, welcome, revoke the invitation, remove, grant, revoke — as ordinary mutations the policy judges, a module drawn only for those who administer it, and a `self: true` grant so a person's derived edit is theirs on their own record and nobody else's. A module may declare `visibility: "admin"`; the store answers `mayAdminister` and `kindsKeptFrom` from the policy; the provider keeps such kinds out of the picture for a seat that may not see them and until the stop says `show=<module>`; the bar and the embed strip offer "Show the installation" to the seat that may; the pages list an administered module's kinds only for that seat. `reachLens` draws what each role reaches from the same `permits` the store refuses with. The checker counts derived acts and self grants when it asks whether a role may do anything.
- 494c1a1: What the lines mean says what the lines mean. The relation key listed each relation by its edge's name — `for-vehicle`, `takes-in`, `offered-by` — which is the source's word for it; each row now reads the declaration's description ("The vehicle it is for") over the two kinds it runs between in their plurals ("Deals → Vehicles"). `relationWords(schema, edgeKind)` is exported for any other surface that names a relation.
- b7d3209: The keyboard always lands somewhere. When an act removes, disables or hides the control the keyboard was on — Escape closing a menu, a chip's × dropping the selection, Back taking the page away, "Send" while the answer comes — it lands on the nearest thing that still stands where it was, or on the same control when a re-render drew it again (`useTheKeyboardLandsSomewhere`, installed by `Shell` and `<Embed>`). The studio hands the keyboard back to whatever opened it when it closes, and a routed page that replaces another lands it on the new page's heading. Eight walk findings were this one rule broken on eight surfaces; the browser harnesses' watch found it on about forty more.
- 6dd2cfd: The ladder is a setting. Which rung answers the chat — this graph, a model on this device, Jev which decides, or a model with your own key — is one row in the profile pane beside text size and scheme, with a key field only when the rung needs one and one sentence on screen; the provider owns the choice (`intelligence`, `chooseIntelligence`) so the profile sets it and the chat reads it. The chat's gear and its pane of prose over the map are gone.
- aeb1693: The calendar and plan lenses are files by what they do. The calendar: its options, its date arithmetic, placing an entry and moving one, the view, the spans a range is drawn in, and the drawing. The plan: its state, its drawing and the lens that binds them. `calendar.tsx` and `plan.tsx` say what the parts are and re-export them; a comment that had drifted from the viewBox scale went back to it. Nothing exported changed.
- 6a043bf: The lenses are pictures, and choosing one flies closer. From altitude a district's board shows each of its lenses as a small live version of the lens under its name, not a label. Pressing one stays aloft: the kind is focused with that showing, the billboard on its plot shows it, the city's cell grows by half so the camera is brought in toward that village, and the camera centres on the drive-in with the picture's top kept inside. The billboard carries the one way down, a full-screen control that leaves the graview with that picture. The billboard's foot stays on the kerb wherever that is; the camera brings it in rather than the layout sliding it down over its own village. The billboard is cut to its picture: a lens lays itself out in a box as tall as the window, and the billboard used to show the whole box, its picture floating a village's height above the kerb — the scene now measures how much the lens actually drew (what is in flow, plus what its scroll regions need beyond what they have) and the layout sizes the billboard to that, floored so a title alone is not a picture. The small lenses on the board are inert: nothing drawn inside one takes focus or a press. The billboard's frame, posts and ground sit on the picture's box, so an empty lens is a header over an empty screen rather than a strip floating over the village.
- b7fa5e3: The menu leads with the thing you clicked. `deriveAffordances` takes a `focus` — the node the gesture landed on — and ranks by it: that node's own repairs first, in the order the rule listed them, then its own acts (settled before asking), then everything the rest of the selection offers. Until now a rule that implicated five late tasks in ONE violation offered its ten repairs in whatever order it walked its subjects, so right-clicking the fourth task met the first task's repair at the top and the obvious press fixed somebody else's problem. Which node an act is FOR is read off the mutation's own `nodeRef` arguments rather than the violation's cast list, so "a new date for Book the hall" is Book the hall's repair wherever it came from. Every surface reads one rank, now stamped on each affordance as `rank`: the pointer menu (which names what it was opened on), the actions strip (whose focus is the last thing selected), and the routed record, where a rule's repairs are ordered by `rankedRepairs` instead of as declared. The destructive tail is unmoved, and a derivation with no focus ranks exactly as it did before there was one.
- 9ff994c: The places row keeps room for what its "more" menu may say. Standing on a place the row could not hold, the menu shows that place's name rather than "+2 more" — and the row had kept 92 pixels for it, so on Seedbed's rotation "The rotation" ran the row seven pixels past its own edge in both schemes. The row now keeps room for the widest name the menu could show.
- 4c66166: The places row keeps room in its "more" menu for the name of the place you are on only when the menu holds it; otherwise for "+N more". Keeping room for the widest name the menu could ever show emptied the row of a bar at 1280 into "+3 more".
- 61d76a0: The garden grows to twelve chapters, and two of the new ones answer what a
  product needs most: the other face, customised, and a second lens.
  
  `@graview/pages` exports `pageStyles`, the face's own type and spacing, so a
  record page an app writes itself is still the same face rather than a copy
  that drifts. The garden registers the plot's page in its own words over the
  derived defaults, and `graview create` writes the same customised page for a
  new product's first kind — the routed face is derived, and any page of it is
  yours to replace.
  
  The board lens takes `fillFrom: "occupant"`, so a domain whose edge runs from
  the occupant to the slot — a planting grows-in a plot — binds it without
  redrawing its edges to suit a seating plan. The garden draws its plots where
  they lie and the empty bed is the picture.
  
  Layout reserves the rails in every mode now, left and right: the quick
  relations and the inspector sat on a full-width lens's title in focus, and
  the altitude control sat on a card's corner. Every card keeps to the span
  between them, and a test holds it.
- 9767a5e: The scene has a Find box, and the picture is the result list. `q` is a view state field beside the focus and `within`, carried as `#q=`; typing replaces the address rather than pushing one entry per letter (so does a row's own `in.q`), and it outlives a change of focus. The provider searches once per change and `useImplicated` lights the hits in every picture through the emphasis views already read — words that find nothing dim it all (`NOTHING_FOUND`); `useReached` keeps what the selection alone reaches, and `useFound` gives the result. At altitude a district with hits is lit and says "3 match", the rest recede, and pressing the count or the district descends with `in.q` set, so the district opens narrowed and Back returns to the lit city; Escape clears the words before anything else. The `FindBox` sits in the Shell's bar, reached by `/` or ⌘K: a combobox over a listbox grouped by kind with each hit's why, a place as "Go to …", the acts on a highlighted record under it, a live count, and on a phone a full-width sheet under a box on its own row. `search()` takes `kinds` to look only where the scene draws.
- 7840cd5: The places row fits what it actually draws. Its pills' widths were taken once as they mounted, and the room kept for the "more" menu was a pill's width plus fourteen pixels — while the menu, showing the place you stand on, draws "The rotation" in 144 pixels against its pill's 106 — so seedbed's places ran seven pixels past their edge. The pills are measured on every fit and watched, and what the menu adds to the place it shows is measured.
- 0a6a3fe: The rail is a column of sections, and one of them was a fixed box. The conversation asked for a middle row that filled whatever it was given and a floor under the whole panel, which made it shorter than the log, the grounded chips and the field together — so expanding "What the lines mean" underneath it had the chips and the input painted straight over the relations. It is sized by what is in it now: the log keeps its own floor and ceiling and scrolls, everything else is as tall as it needs to be, and the rail's own column does the scrolling. The log's floor in the rail is smaller too, because a hundred and twenty pixels of blank under one sentence reads as something failing to load.
- a0ffc2f: The rail is still while the picture moves. Its subject is what the pointer settled on, and it read the pointer the ordinary way — a store subscription React re-renders on — so the acts, the relations, the conversation and the key were all redrawn on every pointer move, sixty times a second, for a subject that only changes when you stop. The moves are watched now without a render, and only what the pointer settled on is state. Dragging was worse than moving: the city slides one district after another past a pointer that never moved, and the subject chased every one of them, so the rail flickered through the whole map on the way. While a hand is down, and while the scene is still travelling, the question is not asked at all. Measured on Squad: sixty pointer moves and a thirty-step drag now redraw the rail zero times, and the companion harness fails if either starts redrawing it again.
- 7be1ad2: The last sentences that named one of a kind by its id read its noun: the strip's reason for an act ("this is a staff member"), what a beginning is waiting for, the ask's picker label, and the reach lens's hover.
- 60e4bf5: In the stack the docked robot stands at the far end of the shelf's first district rather than across its nameplate; the two sharing settings carry four distinct labels; a places pill and a drive-in marquee button clear a fingertip after the depth scale.
- 6dd2cfd: The screen stands on its plot and the signs stand on the land. From altitude a focused place's picture is a billboard at the back kerb of its plot, framed, on two posts, with no clearance needed above its card; the nameplate is a signpost planted at the plot's front corner on a short post; the drive-in's board of showings hangs under the signpost in the ground the layout reserved for it; the kind's landmark stands in the village square among the buildings. The "shown above" note on a focused plate is gone: the screen says where the members are.
- 43cf40d: The seat is a companion attached to the viewframe, not a figure walking the ground. Four panels used to say the current subject in four corners — the inspector's strip and its pointer menu, the quick relations, the relation key, and a chat panel behind a pill on the bar, anchored to a robot that stood on a pad, walked to what it wrote and followed the pointer when pressed. One construct now: `Companion`, on the left where the scene already reserves a rail, fixed to the frame so it is the same at altitude, on the ground, flying closer and inside a full-screen lens, where the figure had no place at all. It names its subject in its header — the selection, else the pick the pointer has settled on, else where you are — and "this" in a message means that. Under it: the acts for the subject from the same derivation the pointer menu reads, the relations, the conversation, and the key at the foot. Right-click still opens the acts at the pointer, so the context menu and the assistant are one thing; Escape closes that popover and never changes the subject. Collapsed it is a narrow dock; on a phone it is a sheet. `RobotMode` loses `following`, the robot's pad leaves the city map, and other people's agents keep their figures — a body in the picture is how you see somebody else at work. `useSubject` is exported for a surface that needs the same answer, and `useAffordances` takes `about` for acts on something nobody clicked.
- 315ce3b: The seat is a robot in the city: it stands where it reads and writes, comes to your cursor when asked, and says its refusals at the gate. One figure per agent participant (`kind:id:session`, the op log's own key), drawn by an `Occupants` overlay over the stage on both renderer paths and positioned from the live frame through `whereIs`, so it rides the tween and the pan and never enters `layout()`. Where it stands is a pure fold (`foldRobots`, tested like `markActivity`): a read puts it at what it read, a write at what it wrote, more than four targets at the neighbourhood, a refusal at the gate with the policy's words as its say, a question on the node's doorstep, rest after the hold at its dock — the seated person's own building when the installation is shown, else a pad at the city's origin cell. Movement is one CSS transition on transform; a quiet city runs no loop and no pointer listener, and reduced motion makes moves instant.
  
  The tab's one-press seat and its chat are ONE robot: the seat registers its name and the chat writes as it (and is seated even while the Activity rail is shut, so the body is docked from the first frame). Applying a plan walks it to each target before the op lands (`applyPlan`'s `before`); undoing an agent's turn walks it home; a run's stop sentence, announced through `onCall`, is said from its bubble. Click the figure, or Tab to it and press Space, and it follows the pointer, offset so it never sits under the cursor; while following, "this" in the chat is the pick under the pointer and the chat panel is anchored as its bubble; Escape releases from anywhere. Off the visible ground an edge indicator points at it with its status line. The bubble is a polite live region carrying whatever the seat says on its rung, and the figure is a named button. `scripts/verify-robot.mjs` drives all of it on the todo app; the seat harness still shows identical diffs.
  
  Also: the graph responder now fills a choice argument from the option's own word in the sentence ("give a role keeper to Sam"), and only when exactly one option is named.
- d9bfdb8: The seat's reply is read by the model it was meant for. A sentence that names a thing inside a change ("Erin tends that plot") is no longer answered as a grounded fact about the thing, so a model on the ladder reads it; the model is shown each act's argument signature, the graph's connections and today's date; `describeProposal` words a proposal in the act's own `describe`; `stillNeeded` counts a name nothing answers to yet as still owed.
- f8f0e29: An agent seat a policy refuses says so in the store's words. The line under a struck-through seat read "The store refuses add-vehicle, and the actions strip refuses it too" — the act by its identifier; it now says the store's own sentence, the act by its title and who may take it.
- daccd55: The studio is a place on the bar. `<StudioPlace app={...} />` opens the running app's own declaration — kinds, fields, edges, acts, rules, roles and grants as districts, "What the checker says" as a place, the ordinary acts to change them, the studio's own history and undo, and an agent seat that proposes a repair for a rule that names none. Applying runs `graview check`, refuses on errors naming them, and otherwise offers the files `graview create` writes as downloads. Offered to the seat that administers where an app declares something administered, and to whoever is here where it does not — so a scaffolded project has it on day one. `Shell` takes it as a slot (the studio already depends on the shell's primitives); the embed strip takes it boxed, so a studio cannot escape onto somebody else's page.
  
  `ArgShape` gains `{ type: "boolean" }`. Without it "Add a field", whose `required` is a plain boolean, was derived NOWHERE — the studio's central act, in the studio, unreachable because nothing could ask one question. The strip asks it as two buttons rather than a text field somebody has to know to type "true" into.
  
  And what the studio does not model, it no longer destroys: a kind's `display.labels`, `display.hide`, `fixed` and `fieldRoles` are carried from the checkout through both the declaration and the written schema, narrowed to the fields that still exist. A `display.format` is a function and cannot be written; the file says so where it finds one, and `WrittenFile.kept` names it, instead of losing it silently.
- e7151d4: The type scale goes up a step. The framework's own text ran from 9px to 12.5px at a 16px root — a scale built around a 12.5px body, which a person reading a product for an hour called small, and which was small. Body text is 14px now, small text 13, marks and captions 12, the smallest label 11, and headings a notch up with them. The cards the layout sizes in the reader's own unit follow: a district's floor is 148px rather than 132 so "COMPONENTS" in 14px capitals holds one line, the districts' row is a little taller, and a focused card may take 1200px of a wide screen rather than 1040. The companion and the quick relations keep to the rail's share of a narrow scene rather than standing over the picture at 1000px.
- ce13ec8: `Begin` takes a `frame` around its own door and nothing else. The scaffolded Home wrapped `Begin` in a `PageMain` with the derived home as its `whenFull`, so once the graph had something in it the derived home — a whole page, with its own landmark — rendered inside a second `main`, and its gallery inside a 760-pixel reading column, one card wide at a desk. The frame is applied to the door alone; what comes when the graph is full is returned exactly as it was given. `graview create` writes the Home that way now.
- e7735c1: The way in is a page with a heading, and keeps the keyboard. `Panel` takes `heading` (1–4) to make its title a real heading rather than a `<strong>` styled as one, and a framed `<Begin>` — the routed face's first screen on an empty graph — is its page's `h1`, which axe had flagged as `page-has-heading-one`. Answering the door from the keyboard no longer ends on `<body>` when the row that asked goes away: the keyboard lands on the next way in, or on the heading of the home the door stood down for.
- ccaa5f4: Search reaches the pages face and the conversation. `/search?q=` lists what the words find grouped by kind, each hit with its why and each kind's heading a link to its list with the words carried; words that find nothing say what was searched ("current ones; add is:any for past ones") and offer the beginnings the seat may run, "A task called “zzz”", with the words already in the name (`beginningsFor`, `SearchToCreate`, and `DerivedForm`'s new `initial` — starting values that stay editable). The derived shell's nav carries the box, `PageFind`: on a kind's list it narrows that list, elsewhere it goes to `/search`, typing replaces rather than pushes; an app's own shell can use it, with `narrowsLists: false` when its lists have a box of their own. The list page reads its words with the shared matcher — `key:value` tokens and `is:any` included — shows why a row is there when it was not the name, and under the derived shell drops the row's second box. `/search` is a derived route an app's own `route()` is warned off. A message the conversation reads as no act and no fact, whose words find records, is answered with them as `picks`, each a press in the chat that goes there. The activity rail shows the records a read looked at, so an agent's `search_graph` says what it found.
- 49d4458: The workbench is eight files, cut where its own section banners already cut it — the ask for an act's arguments, the inspector, following, the standing, activity, the agent seat, backing out, the trail — with `workbench/index.tsx` saying what the parts are for and re-exporting them. Nothing it exports changed.
- bd1f27b: Two changes to an arrangement before the page draws again are both kept. The arrange bar merged each change onto the arrangement it was drawn with, so a grouping chosen and a word typed in quick succession sent the word on top of the old grouping — on a slow phone, the link a person would send lost what they had grouped by. The bar merges onto what it last sent, shows that while what comes back is its own echo, and remembers it per bar so a redraw in between does not forget it.
- 95196d7: Two records of one name are told apart wherever a person picks one. `tellApart(nodes, definitionOf)` gives each namesake the first fact that differs — "Blue Hour · single", "Blue Hour · album" — and the pages form's pickers, the strip's ask, the Find strip, the search page (through a node hit's new `apart`) and an arrangement's group headings all say it. A single and its album were two identical rows.
- 55c4151: The compiler says when code is unused (`noUnusedLocals`, `noUnusedParameters`), and what it found is gone. `Occupants` draws the others and nothing else: its props are `width` and `whereIs`, the walking seat's pad, reach and pointer plumbing removed. `SceneProps`, `ResolvedViewProps` and `DoorProps` lose a type parameter nothing read, and `placeOthers` a `height` it never used. One `violationKey`, exported from `@graview/core` (no longer from `@graview/react`); one zod `unwrap` in core; the structure and invariant providers name a node the way its kind does, through core's `labelOf`, rather than by its `label` field alone.
- 6e8a02c: What the page taught the framework, folded back in. A board slot holds several occupants, each name its own target, and the bench lists only what is in no slot. The coverage lens reads its rows and columns from the graph, as the board already did, so no app wraps it to hand over the other kind. A titled registration names the picture. `focus=agg:plot` is a stop's short form for `aggregate:plot`. An embed infers its face from its stop and its scheme from the host page, and `mountWhenNear` mounts many embeds as a reader comes near them. The scaffold's views file says how a lens becomes a place.
- 3cb6d60: What a review of the villages found. Pressing a plot's tile focuses the district's aggregate rather than the card's own id, and not on the click a pan produces on its way up; going back up before the descent's glide has landed no longer wipes the altitude camera; a host that answers the chat itself (`respond`) hides the ladder in the profile; the signpost rule applies only to cards on a plot, so a nested card's plate stays where it was; the screen's collision guard protects the plate where it stands now (below the card), not where it used to; road and village geometry is computed once per city and translated per frame.
- 5b401bb: What the review of search found. A boolean field is a state, asked for as a condition (`done:false`), not a word: it read as "No", so "n" found every open task in the Find box, a list's `?q=` and the chat — `searchableFields`, `describe` and `llms.txt` no longer list booleans. The picture lights every match from the result's new `matched` list rather than the strip's capped hits. A list's `q` made only of tokens nothing offers (a pasted `https://…`) finds nothing, as the Find box does, and a lone `is:flagged`, `is:clear` or `is:past` narrows in both. `actsOn(store, id, words)` lists a record's acts without a search of the graph; `search()` takes `touched`, and the scene works out what is flagged and touched once per graph change, not per keystroke; a list parses its words once rather than once per row. A lit district's count, Enter on a kind hit and a double-click are one transition — `withJackIn(…, { carry })` — which comes down to the ground, close and narrowed. The row's words (`in.q`) no longer follow you to the next focus, and `withoutSearch` clears the search with the words it carried. A pick in the pages face's Ask drawer goes to the record's page (`onPick` on `ChatPanel` and `Companion`), and the list page reuses the affordances it already has for search-to-create.
- cf193fc: What you can press is what you can see. A view host is the box the layout gave it, and a view that sizes to its content fills only part of that; the invisible remainder was still a hit target, so a record read from altitude and pinned beside a district covered the district's open button with nothing and the button stopped answering. On the DOM path the host and the scaled natural box are now out of hit-testing and only the drawn content is in. The navigation harness hit-tests it.
- 228039c: Where the seat worked is marked on the thing. The robot walked to what it wrote and stood there; the walk went with the figure and the attribution did not. `useSeatWork()` reads the op log — the ops an agent authored, what they wrote, and what an undo took back — and `SeatMarks` draws the seat's glyph on each of those things for a hold: on a card, on a building in a village, on a chip inside somebody's own lens, measured from the picture as drawn, so it is right on both render paths and inside a full-screen lens. The companion lists what the seat did in its own words, each with a "show me" that takes the camera there: from altitude the district the thing lives in, on the ground the thing itself. A question the seat asked stands at the node it is about and says itself, waiting rather than fading, and is listed in the companion with the same way back. Undo takes the marks with it.
- 968e1d1: The installation, in the app people open first. Things declares `declareInstallation({ roles: ["keeper", "member"], admin: "keeper" })` with a policy, two seeded people and a pending invitation, so the platform story is demonstrated where a reader will look for it rather than only in a seedbed chapter. `GraviewProvider` takes `seats` and `onSeat` and holds who is at the keyboard, and the bar draws the new `<Seats>` primitive for them — sitting down re-derives every surface from one principal: the acts offered and the ones withheld with the policy's own sentence, which kinds are drawn at all, whether "Show the installation" is there, what the routed face lists, and the agent's tools. `Places` no longer draws a pill over a kind the seat cannot see, which was a door to a district that was not there.
  
  `ArgShape` gains `{ type: "several", of }` for an argument that takes a list. Without it `z.array(z.enum([...]))` described itself as `unknown`, so "Invite somebody as coordinator and gardener" was unaskable and therefore derived NOWHERE — in every installation the framework ships. An array of something undescribable stays undescribable, so an unaskable act does not start looking askable. The strip's ask answers such an argument by toggling choices and settling separately; the routed face's list control already handled it.
- 59cef8c: Who is where. Other people stand on your map at the plot their stop focuses, in the audience row of the showing they are watching, with their robots beside them captioned as theirs and the thing they point at outlined in their hue — placed by each viewer's own `whereIs` from a presence payload that is never a pixel and never enters the op log. `PresenceChannel` has two implementations in ship: a BroadcastChannel between tabs of one origin, beside the browser adapter, and two routes on the served store folded into the poll the remote store already makes. A per-tab session fills `Author.session` on a tab's ops and its presence key alike. Clicking a figure follows that person until you move yourself or press Escape; sharing is a reader setting in the profile pane; an embed broadcasts nothing unless handed a channel. `openRemote` now carries `applyAll` and `undo` to the wire.
- Updated dependencies [fb781c2]
- Updated dependencies [e8d10b1]
- Updated dependencies [dfba092]
- Updated dependencies [dd65d38]
- Updated dependencies [390028c]
- Updated dependencies [bff0b71]
- Updated dependencies [400a6df]
- Updated dependencies [f4dbcc8]
- Updated dependencies [5d634ca]
- Updated dependencies [c7a3519]
- Updated dependencies [2aae30f]
- Updated dependencies [73690fb]
- Updated dependencies [862fd42]
- Updated dependencies [475cc83]
- Updated dependencies [f11e51b]
- Updated dependencies [09a23a3]
- Updated dependencies [78e568e]
- Updated dependencies [92a2f73]
- Updated dependencies [509162f]
- Updated dependencies [8c14e4c]
- Updated dependencies [3f86b09]
- Updated dependencies [9f6593b]
- Updated dependencies [188bc6e]
- Updated dependencies [1ebfd44]
- Updated dependencies [a23e496]
- Updated dependencies [e0d5026]
- Updated dependencies [fc024d0]
- Updated dependencies [41abe03]
- Updated dependencies [e165c5b]
- Updated dependencies [6a043bf]
- Updated dependencies [406b774]
- Updated dependencies [e119b49]
- Updated dependencies [45c4b9c]
- Updated dependencies [14e22ab]
- Updated dependencies [4aa0f93]
- Updated dependencies [b7f83cc]
- Updated dependencies [1373dfb]
- Updated dependencies [5b5e5a3]
- Updated dependencies [aa90b02]
- Updated dependencies [923bbfa]
- Updated dependencies [e695209]
- Updated dependencies [ccc912a]
- Updated dependencies [7c0e701]
- Updated dependencies [73e3b86]
- Updated dependencies [190c4a8]
- Updated dependencies [e59fa1f]
- Updated dependencies [69aed60]
- Updated dependencies [f801b4d]
- Updated dependencies [8e872b5]
- Updated dependencies [708871a]
- Updated dependencies [c5e4ac7]
- Updated dependencies [42c2c96]
- Updated dependencies [9a3fe4b]
- Updated dependencies [2cc27e9]
- Updated dependencies [b90b6c7]
- Updated dependencies [8041853]
- Updated dependencies [4c4d52a]
- Updated dependencies [b9b0635]
- Updated dependencies [60efe3b]
- Updated dependencies [5e6d4e7]
- Updated dependencies [03b9c5a]
- Updated dependencies [5297528]
- Updated dependencies [ff7de41]
- Updated dependencies [959955f]
- Updated dependencies [22e0668]
- Updated dependencies [9b3a623]
- Updated dependencies [5a00a1f]
- Updated dependencies [d59b6c8]
- Updated dependencies [887d768]
- Updated dependencies [de75e21]
- Updated dependencies [2c25067]
- Updated dependencies [b3ed5f6]
- Updated dependencies [d36e6fa]
- Updated dependencies [7244498]
- Updated dependencies [b1fbc32]
- Updated dependencies [796bf9e]
- Updated dependencies [d907771]
- Updated dependencies [0bb6827]
- Updated dependencies [b5e95a1]
- Updated dependencies [3f5d3ba]
- Updated dependencies [1e773a5]
- Updated dependencies [7a61e87]
- Updated dependencies [1794980]
- Updated dependencies [171075a]
- Updated dependencies [3e3bfff]
- Updated dependencies [a5d842b]
- Updated dependencies [2b2df36]
- Updated dependencies [a9381af]
- Updated dependencies [8976510]
- Updated dependencies [d5227b5]
- Updated dependencies [0c320d9]
- Updated dependencies [0c0fa22]
- Updated dependencies [c8e9387]
- Updated dependencies [8a2fdf2]
- Updated dependencies [73690fb]
- Updated dependencies [fb6eb5d]
- Updated dependencies [5343a1d]
- Updated dependencies [6dd2cfd]
- Updated dependencies [45c7a2c]
- Updated dependencies [ddf1ea9]
- Updated dependencies [6e0fbb7]
- Updated dependencies [b846b32]
- Updated dependencies [d3e1201]
- Updated dependencies [3376126]
- Updated dependencies [7188978]
- Updated dependencies [e3a7de6]
- Updated dependencies [3af8da7]
- Updated dependencies [5aa8776]
- Updated dependencies [76e50a5]
- Updated dependencies [481340c]
- Updated dependencies [3e719c8]
- Updated dependencies [206670e]
- Updated dependencies [f80138a]
- Updated dependencies [59c1fdb]
- Updated dependencies [71fd426]
- Updated dependencies [2c20c53]
- Updated dependencies [4472467]
- Updated dependencies [8d43e33]
- Updated dependencies [89f4855]
- Updated dependencies [f240a12]
- Updated dependencies [859c128]
- Updated dependencies [53ad439]
- Updated dependencies [e0d5026]
- Updated dependencies [0ea3f62]
- Updated dependencies [b7d3209]
- Updated dependencies [bd1f27b]
- Updated dependencies [90a3344]
- Updated dependencies [6dd2cfd]
- Updated dependencies [6a043bf]
- Updated dependencies [0a3504a]
- Updated dependencies [b7fa5e3]
- Updated dependencies [1d121a7]
- Updated dependencies [61d76a0]
- Updated dependencies [8894627]
- Updated dependencies [fc7103b]
- Updated dependencies [9767a5e]
- Updated dependencies [8dbae9a]
- Updated dependencies [e9e495f]
- Updated dependencies [636a00d]
- Updated dependencies [7be1ad2]
- Updated dependencies [0d1fd39]
- Updated dependencies [60e4bf5]
- Updated dependencies [098c784]
- Updated dependencies [ae188cc]
- Updated dependencies [851feb6]
- Updated dependencies [6dd2cfd]
- Updated dependencies [43cf40d]
- Updated dependencies [315ce3b]
- Updated dependencies [d9bfdb8]
- Updated dependencies [3506c69]
- Updated dependencies [daccd55]
- Updated dependencies [be9fb19]
- Updated dependencies [e7151d4]
- Updated dependencies [ce13ec8]
- Updated dependencies [ccaa5f4]
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
  - @graview/core@0.1.0
  - @graview/layout@0.1.0
  - @graview/react@0.1.0
  - @graview/tools@0.1.0
  - @graview/render@0.1.0

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
- 587764e: The actions strip's section headings are real list items again: they
  carried `role="presentation"`, which strips the list-item role and makes
  the list invalid to assistive technology — the todo example's new
  accessibility run caught it on a selected node with a broken rule.
- 37bb6af: The constellation says what it means: relations drawn at full strength from
  above the stack (where the lines are the content rather than an aside),
  receding when a kind is selected so its own relations stand out, and a derived
  `RelationKey` naming each edge kind with the exact stroke the scene draws.
- e38fe86: The generic full page is a document rather than a card stranded on a viewport:
  a real header, a centred column, a heading that is the whole thing rather than
  a truncated copy of the body, field names in words, and no value repeated
  because the heading already said it. The name is now the rename control.
- 964d140: The DOM path is a citizen of every browser. The board no longer trusts
  `height: 100%` to transfer through `aspect-ratio` — Firefox and WebKit
  treated it as indefinite inside the panel's flex chain and collapsed the
  pitch to its border pixels, taking every slot's hit target with it; the
  width now comes from the same ResizeObserver measurement that decides when
  the board turns. The local-AI rung fails fast and says why when a browser
  has no WebGPU, and the chat header carries that reason instead of a shrug.
  The graview-new-app skill states the supported-browsers floor.
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
- 95cceb3: The menu scales. Past the fold a filter-as-you-type field appears in the
  inspector — it narrows the same derived list by label and why, Enter runs a
  sole survivor, Escape clears. `defineMutation` accepts `pinned: true` (the
  app naming its own act), a person can pin any offered action from the menu
  itself (kept per browser beside the intelligence config, outranking the
  app's), and a deterministic recency/frequency boost read off the op log
  ranks what a workspace actually uses ahead of what it never touches —
  decaying so the menu tracks the season. The bands stay inviolate: repairs
  first, destructive last; pins and usage only ever shuffle inside them.
- 094f3cc: `readableFields` is the one answer to "which of a node's fields does a person
  see, and how does each one read" — the record on a page and the summary on a
  card had answered it separately and diverged. And each lens's `View` is a real
  component rather than a method calling hooks behind a lint disable.
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
- ba85148: A kind card earns its space: a tally of one mark per member, lit where
  something is wrong, which answers "how much of this is in trouble" — the
  question a count never could. A kind with nothing in it says "none yet" rather
  than showing a zero and a void.
- 0f9b0fd: Pins override in both directions, and the stars say whose they are. A
  person can now UNPIN an act the app's declaration pinned — the same star
  gesture demotes it for that browser and restores it — where before the
  star on a declared pin was a control that visibly did nothing. The
  person's pin draws in the accent, the app's in quiet body ink. And when
  the searcher is down to a sole survivor, the row says ↵ — the promise
  Enter makes, shown exactly when it holds.
- 4bd846b: The horizon, modules, selection-as-a-stop, the traditional face (@graview/pages), the intelligence seam, and the ship subpackage (persistence wiring, op-log-native migrations, export bundles, health).
- cfdad5a: The sample apps remember. `@graview/ship` gains a browser adapter — the
  same snapshot, log and version the file adapter writes, in `localStorage`,
  slotted into `openStore` unchanged with migrations included — behind a
  `@graview/ship/browser` entry that carries no `node:fs`. `openStore` now
  reopens a store WITH its persisted history (a `Store` accepts a snapshot
  and the log that led to it), applies the declaration's own policy, mints
  ids that cannot collide across sessions, and takes `fresh` to return to
  the seed. The conventions a page reads — `?fresh=1`, a driven browser
  starting fresh unless `?remember=1` — ship as `browserStartsFresh`,
  `forgetFreshParam` and `freshHref`. Primitives gain `StartFresh` and the
  activity popover says "Remembered in this browser" with the way back; the
  pages face takes `remembers` and says the same in its footer.
- 4a5d8b0: The altitude control is the toggle it always was, and now presents as one:
  "Graview" from the ground (the place it takes you), "Focus" from altitude
  (the way back down), with aria-pressed and the accessible name agreeing
  with the word. Its mark morphs inline between the two — three kinds on
  their ring gathering into one node in one ring — riding its own copy of
  the registered altitude property on the scene's own 640ms curve, so the
  control and the picture change together; where an engine cannot register
  the property, both cut, verified rather than assumed.
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
- 595107c: The seat never says "Done" over a change the store refused. The chat's
  apply read only thrown errors, but the tool runtime RESOLVES refusals —
  so a policy denial posted "Done — … Undo works." while the graph stayed
  untouched. The result flag is read now and a refusal lands as "Refused:
  …" in the thread. The activity rail also stops dressing every agent as
  "claude": a turn is attributed to its author's own id — the chat seat as
  "chat", a sync as its system name — and only a human is "you".
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
- Updated dependencies [7cebca3]
- Updated dependencies [76792f1]
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
  - @graview/react@0.0.1
  - @graview/render@0.0.1
