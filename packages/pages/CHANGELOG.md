# @graview/pages

## 0.1.18

### Patch Changes

- 44d109d: A part of the page that fails to load tries again, and never breaks the page (FR-139). Graview Cloud's realtime harness takes a person's browser offline for a moment, and where the person's menu had not fetched its part yet, the page fetched that chunk while offline. The import failed, and Chromium and Firefox keep a failed module for the page's life: an `import()` of the same URL fails again at once, without a request. From then on the menu opened with only "Keeping this app", without the seat, the host's actions or "Report this app", each open threw "Failed to fetch dynamically imported module" inside the embed, and only a reload brought it back; about half of Cloud's runs on 0.1.17 failed on it. Every part a page fetches as it is first drawn now goes through one loader, `retryingImport` (`@graview/core/retry`, a page's entry only: workerd, where a host runs core, tools and ship, refuses a script with an `import()` of a computed URL in it, reached or not, so nothing a server imports reaches it), which asks again after a failure: where the failure names the URL it could not fetch (Chromium and Firefox do), it imports that URL with `?retry=<n>`, another URL and so another fetch, whose own imports resolve to the chunks the page already holds; where it names none (WebKit, which asks again on its own), it calls the bundler's import again. React parts are drawn with `lazyModule` (`@graview/react`): until a part arrives, its place says so in one line — "The rest of your menu will load when you're back online." or "… didn't load." — with a real "Try again" button, its words a polite status, and nothing is thrown. It is asked for again when the browser says it is back online, when the part is drawn again, when somebody reaches for what holds it, and when "Try again" is pressed, which asks for every part that failed; when it arrives with the keyboard on the button, the keyboard goes to the part's first control. That covers the person's menu (its top says so once, the rest waits quietly), the problems' rows (a list item in the list), the row that arranges a list, the framework's views, the declared lenses and the home view, the embed's faces (`preload` resolves either way now), the scene's keeping controls and the studio in the menu, the assistant on the pages, the rules for settling a handed-back place (asked again online or every ten seconds), and the guest host's drawing, press reader and worker (a worker view's host asks again when the browser is back online; a view whose drawing did not arrive stops with the plain face, "start"). What a server may also run — the compiler `appFromOrCompile` fetches, the agent seat's describer and the view runtime `viewScript` reads — keeps a literal `import()` and forgets a failure, so the next call asks again, without a URL of its own. The person's menu is fetched when the page is idle and online (`requestIdleCallback`, or 2.5 seconds after it draws where there is none), so it is rarely needed offline. What cannot be mended: a chunk that arrived while one of its own imports did not; the failed import is kept under its own URL, which no query on the importer changes, and only a reload gets past it. `pnpm verify offline` mounts the embed as a host does, in Chromium, WebKit and Firefox, takes the browser offline the moment the app has drawn with the menu's chunk refused from the start, and holds that the menu says so in one line with no page error, that the next open back online is the whole menu — the same controls as a page never offline, "Report this app" among them — without a reload, and that "Try again" from the keyboard keeps the keyboard while it cannot arrive and puts it on the menu's first control when it does; on main the menu's open threw in every engine. The hosted page carries 575.8 KB compiling (572.7 with the bar that fits its box alone) and 532.1 KB handed a compiled app (528.9); its budgets rise by that to 576 KB and 532.25 KB, which leaves Cloud's shell 19 KB under its 595. `capabilities().shipped` gains FR-139.
  
  Compatibility: markup and behavior a host holds, a new entry `@graview/core/retry`, and new exports in `@graview/react`. New: `@graview/core/retry` and its `retryingImport`, for a page only (the main entry, tools and ship's runtime carry no computed `import()`, which workerd refuses); `lazyModule`, `retryLazyParts`, `LazyModule` and `LazyPartOptions` (`@graview/react` and `/provider`); the line `[data-testid="lazy-part-missing"]` and its button `lazy-part-retry`, drawn in a part's place while it has not arrived. A part that did not arrive draws that line where it threw into the embed's boundary (the "@graview/embed threw while rendering" report); `preload` resolves when a face did not arrive, where it rejected. `fetchFrameworkViews`, `fetchDeclaredLenses` and `fetchHomeView` ask again on the next call after a failure, where they kept the failure. `viewScript` moved within `@graview/guest` to a file of its own, exported where it was. What Graview Cloud changes: nothing is required; its realtime harness should stop failing on the menu. A harness that takes the browser offline may wait for `lazy-part-missing` in the menu while offline, and for the menu's host actions on the next open once back online. Ops, stored formats, the compiled-app format, wire messages, check finding codes and tool names and input schemas are unchanged.
- 2fba4ab: A selected record is drawn once; a relation is said in the declaration's words; and a district's box holds its name (FR-141, FR-142, FR-143). Nick, on 0.1.17 in Graview Cloud's "Farm Bureau POM Workshop": "the main bug i'm talking about is how it's rendered twice". Selected Down in its district, a workshop part was drawn twice, overlapping, and its topics a third time. The cause: a kind's declared `page` (one × full) was drawn as its blocks bare above the framework's record, the two in one column that the scene centered on a box sized for the record alone. The page's blocks spilled out of the top of the box, under the app bar where nothing scrolls to them; the record's frame spilled out of the bottom, over the cards it is tied to; and the record said the page's goal and its four topics again, as fields and as chips under "Covers". The second "COVERS" with nothing under it was the caption of the topics' own cards, showing through. Declared views win where they exist, and a page heads its record, so the page is now drawn inside the record's one frame as its head. The page's title is the frame's title (still the rename control where it is the name), the page's blocks come first, and the record adds only what the page did not say: the fields it left out, each editable where an act writes it, and the ties it did not list. Under a declared page there is no kind-description subtitle, and no "Nothing is connected" when every tie was listed. A kind with only a `card` is drawn in focus by the framework's record alone, as before. Whatever draws the record in focus (the framework's record, a page at its head, a component, a worker view) is held to the box the layout gave it. It is no taller than the box, and when it is taller it scrolls inside from its top, so it never stands under the bar or over its neighbors. On the pages face a page still heads the framework's record page, which now leaves out the facts and the related records the page already says, and the page's title where it is the record's name. `whatBlocksSay` (`@graview/core/blocks`) reads what resolved blocks say: the fields their words read, the records their lists list, and their opening title. `Connections` takes `hide`, the records a view already lists; a heading left with nothing under it is not drawn. The seat's panel said `Holds 4 of 4 "partOf" — most of them`; it now says "Covers: all 4 topics", the relation read from the end the record stands on (its `inverse`) and the count said plainly, "5 of the 6 topics" when it is most. `edgeWords` (`@graview/core`) says a relation from either end, its `description` or its `inverse`, else its key spoken ("part of", never `partOf`). The relation key's words, the band's captions, the connections' headings, a loop's label from altitude and the chat's answers about a record read through it, where they printed a camelCase key as written. A district's name keeps one line. Where it is wider than its box it is drawn smaller, down to eleven pixels, and past that it is cut and said whole on hover, so "WORKSHOP PARTS" no longer wraps out of the top of its box; and a district every member of which the selection reaches says "4 tied" (or "2 of 4 tied") where it said "4 4 tied", the count twice. And the district you are in stays in the row: at 1280 wide the workshop's own district had gone behind "+5 more" while three empty districts kept their slots, so a row that sheds now keeps the focused kind, then the raised ones, still in the row's order. `pnpm verify drawn-once` mounts a document modeled on the workshop's, the way Cloud mounts one, at 1280, 1440 and 1920 wide, in three engines and both schemes. It holds that the goal and the summary are said once, each topic once in the record, no heading in the record stands over nothing, the record covers no other card, caption or the bar, its title stands below the bar in the window, the panel says "Covers: all 4 topics", and the district's name is inside its box, at the workshop's name and at a 37-letter one, and says its count once. It also holds the same for a part with only its card, and that a view of the host's own taller than its box keeps to it. Every one of those claims failed on 0.1.17 except the one for a part with only its card. The hosted page carries 576.0 KB compiling and 532.3 KB handed a compiled app, 186 bytes more each over FR-139, and its budgets rise by that with a little room to 576.2 KB and 532.4 KB, which leaves Cloud's shell 18.8 KB under its 595; the scene before it draws is 4.1 KB more (897 697 bytes, limit 877 KB), and the pages face alone 3.8 KB minified, 1.3 KB gzipped (budgets 517 850 / 177 950). `capabilities().shipped` gains FR-141, FR-142 and FR-143.
  
  Compatibility: markup and sentences a host or a program may match. The insight observation `insight:load:<id>:<edge>` (same id) reads "<name> <the relation's words>: all <n> <plural>" or "<name> <words>: <n> of the <m> <plural>" where it read `<name> holds <n> of <m> "<edge>" — most of them`. A relation with no words is spoken from its key ("part of") where a camelCase key was printed as written. Under a kind's declared page, the record in focus is one `[data-graview-primitive="panel"]` holding `[data-graview-spec="page"]`; the `.graview-spec-host` wrapper is gone, and the page's opening title block is drawn as the panel's title. The record in focus marks its host `data-graview-record-focus`. A district's name is `[data-graview-district-name]`, `data-graview-fitted` when drawn smaller, with a `title` when cut. New: `whatBlocksSay` and `BlocksSaid` (`@graview/core/blocks`), `edgeWords` (`@graview/core`), `Connections`'s `hide`, and `useDefaultElsewhere` and `RecordHeadContext` (`@graview/primitives`). The document's view vocabulary, check finding codes, ops, stored formats, the wire and tool names are unchanged. What Graview Cloud changes: nothing to mount; its views harness can hold that a record selected Down is drawn once, by `pnpm verify drawn-once`'s claims, and anything matching the old load sentence matches the new one.
- b00d5cf: A view of one record sits beside the record's editable fields, a view can offer a record's long text to edit without retyping it, and the views guide says what a view is handed (FR-149, FR-150, FR-151). On Graview Cloud, Nick's "Farm Bureau POM Workshop" has a deliverable with a three-thousand-character `draft`; a chat wrote a worker view of it (`attach: "deliverable"`, `cardinality: "one"`), and once applied the record on the scene was the view alone, labeled "Made by Claude, for nick", with no way left to change the draft. Registering a worker view of one record now draws it above what the registry drew for the record before: on the scene the record drawn at full is the view and then the record's own fields, each editable where an act writes it; on Pages the record's page is its heading, the view, then its facts and what can be done, as it was. A manifest that says `replaces: "page"` draws the view alone, as before, and on Pages without the facts, the links and the acts (what is wrong and what has happened stay); `checkManifest` refuses any other value, and `replaces` on a view of many or of the home. The views guide said a write takes only what the person typed — "Do not prefill" — so a view that offered "Edit draft" asked for all three thousand characters again. Now a view marks a field and the host fills it: `<textarea name="draft" data-prefill="draft">` in a `fieldset` bound to the record is filled, after the view draws it, with that record's `draft` as the viewer sees it, whole and with its line breaks, when an act in the fieldset is named in the manifest, is done to that record, takes `draft`, writes it (its `writes`, or an argument named like the field), writes no other record's fields, and may be run there by this viewer; otherwise it stays empty, so a seat that may not write the draft is never handed it to edit. The filled value is the viewer's to edit, and a press carries it only back into the field it came from: pressed for another act that takes it, it is refused `untyped`, and a view that writes into the field after the host filled it makes it the view's, as ever. The value is a field of a record the view was already shown, so prefilling hands the view nothing new, and it can be saved only where it came from. And the guide said each of `props.nodes` had `fields`; a record's fields are on it by name (`node.draft`, `node.status`), beside `id`, `kind` and `label`, and a view of one finds its record in `props.node`, never in `nodes`. A view written to the guide drew nothing. The graview-worker-view skill, `@graview/guest`'s README and `GuestNode`'s documentation now say so, and the skill gains a worked example of a view of one record (`examples/a-record.js`: a deliverable's subject and its draft as paragraphs, and "Edit draft" prefilled), which a test runs headless over the workshop in miniature so the guide cannot drift from the props again. `guest-sandbox --transport=record` holds it in Chromium, WebKit and Firefox, with the skill's own example on Cloud's workshop in miniature: on the scene and on Pages the view and the record's editable fields are both drawn, `replaces: "page"` draws the view alone on both, the view draws the draft's paragraphs, "Edit draft" opens the whole draft filled in, a person's edit saves with its line breaks intact, and for Rae, who may not write the draft, the same field and one bound to a memo she may not see are filled with nothing and her press changes nothing. Run against 0.1.17, the scene drew the view alone, the field was empty, and saving it replaced the draft with what was typed. The guest host's first load when a page registers a worker view carries 1.0 KB more and the open kit's host 2.6 KB more; their budgets rise by that. The hosted page carries 163 bytes more, compiling or handed a compiled app, the record page asking whether a view replaces it; its budgets rise by that. `capabilities().shipped` gains FR-149, FR-150 and FR-151.
  
  Hardened by the security review before it shipped: a field the host fills is filled only when it holds the record's value whole, and is left empty otherwise; an untouched filled field sends the record's value as it is when pressed, not the copy it was filled with; a field is filled only for an act that declares it writes that field (an own property, never one inherited); and a view that replaces the record's page and fails leaves the record's own face, its fields, in its place rather than a page with neither.
  
  Compatibility: ops, stored formats, the document format, wire messages, `GUEST_PROTOCOL`, check finding codes and tool schemas are unchanged; `GuestProps` is as it was (its documentation was corrected, not its shape). New: `WorkerViewManifest.replaces` (`"page"`, optional), refused by `checkManifest` with any other value or on a view of many or of the home; the `data-prefill` attribute on an `input` or `textarea` a worker view draws, which the host fills; `PressedField.from` and the `Prefilled` type (`@graview/guest/host/views`), the record and field a host-filled field came from; `@graview/react`'s `DefaultDrawnElsewhere` (the context `DefaultViewElsewhere` provides, now read by a worker view too), `markReplacesPage`, `replacesPage` and `REPLACES_PAGE`; and `data-worker-view-beside` on the element holding a view of one and the record's own view under it. Changed: a worker view of one record is no longer drawn in place of the record on the scene; it is drawn above the record's own fields, as on Pages, unless its manifest says `replaces: "page"`. A view of one that fails on the pages face draws nothing in its place (the page already is the record), where it drew the record's card a second time. What Graview Cloud changes: its chat guide's "views" topic (`workers/cloud/src/mcp/guide.ts`, the `views` entry) says `props.nodes` have `(id, kind, label, fields)` and "Do not prefill"; it should say a record's fields are on it by name, a view of one reads `props.node`, a field is offered to edit with `data-prefill` and the same `name` inside a fieldset bound to the record, and a view of one sits above the record's fields unless the manifest says `replaces: "page"`. A view applied before this that relied on being the record alone adds `replaces: "page"` to its manifest.
- 7f4f1bb: A record's prose keeps its paragraphs, spans the record under its label and is changed in a text area, and a record's facts read in the order the kind declares, or the order its page says (FR-146, FR-147, FR-148). Graview Cloud, on Nick's "Farm Bureau POM Workshop": a deliverable holds an email drafted in full, a `text` field `draft` of about three thousand characters with paragraphs, a numbered list and a bulleted one written as `\n` and `\n\n`. The record drew it as one continuous block, the line breaks collapsed, in a value column a third of the page wide, with "Status", "Summary" and "Due" crammed above it in the same style, and its facts in the order Status, Summary, Due, Draft, Subject line: the order the record's keys had been written in, which nobody chose and nothing could change. A blank line is now a paragraph, a single line break a line break, lines that start "1." or "2)" a numbered list (starting where it starts) and lines that start "-", "*" or "•" a bulleted one, drawn as `<p>`, `<br>`, `<ol>` and `<ul>` with every word a text node (no markdown, no markup, nothing a value can turn into HTML), by `TextBody` from `@graview/primitives` and `/pages`: on the scene's record, the routed record page, a card's, row's or page's `{ "text": "{draft}" }` block (a `field` block keeps its breaks in its one line), and the record page a scaffolded app writes. A field is prose when the declaration allows it more than 500 characters (a document's `text`; `z.string().max(5000)` in TypeScript), or when its value holds a line break or runs past 160 characters (`isLongText`, and `readableFields` marks each field `long`). Prose is drawn the record's width with its label above it, in the facts' order, and the short facts stay a compact table; the scene's record reads down the panel, its relationships under its facts, when a fact is prose or the page groups them. Its label carries an "Edit" (named "Edit the draft") that opens a text area, as a click on the words does: as tall as what it holds (`field-sizing: content`, measured where an engine lacks it), named for the field, Enter a new line, Ctrl or ⌘ with Enter or leaving it saving through the act the framework found, Escape putting it back, the keyboard back on "Edit" after. The text area is fetched the first time one is opened. The routed record page's values are changed where they stand too, as the scene's are, when the face is handed views. A form asking for prose (`DerivedForm`, the scene's ask) asks in a text area. Find quotes prose as one line. `describePlace` reads a record's facts in its page's order, each group under its title, each value as stored. A record's facts follow the kind's declared fields, then its computed ones, on every face and in `readableFields`. A kind's page may say otherwise: `kinds.<kind>.page` in a document, `{ "fields": ["subject", "draft"], "groups": [{ "title": "Schedule", "fields": ["due", "status"] }] }`, and `display.page` in TypeScript, put `fields` first, each group under its title, and the rest in declared order, under "Details" when there are groups. The edit is `{ "op": "set-page-fields", "kind", "fields", "groups"? }`, said in words ("A deliverable's page shows subject and draft first and due and status under "Schedule", and the rest under "Details".") and by `diffDocuments` ("How a deliverable's page orders its facts changes."); an empty `fields` and no `groups` give the declared order back. A rename moves the page's name with the field and a removal takes it off the page. The compile refuses a page that names a field the kind does not have (`page-field`), one named twice (`page-field-twice`) or two groups of one title (`page-group-twice`); `graview check` says `page-unknown-field` and `page-field-twice` of a TypeScript declaration. The studio carries a kind's page through its round trip. `pnpm verify long-text` mounts a document shaped like Cloud's workshop the way Cloud mounts one, in three engines and both schemes, on the routed record page at 390 and 1280 and the scene's record at 1280: the draft drawn as ten paragraphs, a numbered list of four and bulleted lists of six; its value the record's width with its label above it; the facts in declared order, and in the page's when the kind says one, the rest under "Details"; the draft edited in a text area that holds every line break, is as tall as the text and is named "Draft"; a paragraph added in place and saved stored with the others intact and drawn as an eleventh; and a place's card that says `{draft}` keeping the paragraphs and lists. Run against 0.1.17, every claim failed. The hosted page carries 2.1 KB more compiling and 1.3 KB more handed a compiled app: the declared order, a kind's page and the test for prose in core, and the compile's reading of `kinds.<kind>.page`; its budgets rise by that.
  
  Hardened by the security review before it shipped: a numbered or bulleted line is read in one pass whatever it holds, so a long line with a line separator in it no longer takes quadratic time; a page's field names are a record's and a kind's own properties, never inherited ones like `constructor`, in `readableFields`, `graview check`, the document writer and `diffDocuments`; and `display.page` holds to the document's limits (40 fields to a list, 12 groups, a title of 1 to 60 characters), which `graview check` refuses as `page-too-large`.
  
  Compatibility: additive to `graview-document@1`: `kinds.<kind>.page` is optional, and a document without it means what it meant, except that a record's facts now read in the kind's declared order where they read in the order the record's keys were written; a build that predates the key refuses it as `unknown-key`. `EDIT_OPS` gains `set-page-fields`. New check codes: `page-field`, `page-field-twice` and `page-group-twice` (compile errors, on the new key only) and `page-unknown-field`, `page-field-twice` and `page-too-large` (`graview check`, on `display.page` only). New: `display.page` and the `PageFields` type, `pageSections`, `isLongText` and the `FieldSection` type (`@graview/core`); `ReadableField.long`; `ArgShape`'s text gains `long` and `ScalarField` (`formFields`) gains `long` for a string allowed past 500 characters; `TextBody`, `textBlocks`, `hasShape`, `LongValue` and the `TextBlock` type (`@graview/primitives`; `/pages` also gains `EditableValue`). Derived tool names and input schemas are unchanged. Markup: `[data-graview-fields]` is a `div` of one `dl` per section where it was the `dl`; a group is `role="group"` named by its title (`data-graview-field-group`); a prose row is `[data-graview-long="<field>"]`, a `div` of `dt` and `dd` spanning the list, its value a `[data-graview-text-body]` of `p`, `ol` and `ul`, and its text area `textarea[data-graview-field="<field>"]`; a text block whose value has a line break is a `div.graview-spec-text` holding the body, where it was a `p`. The routed record page's `[data-testid="record-fields"]` holds one `dl` per section, its groups under `h3[data-graview-field-group]`, its values the scene's `EditableValue` controls when the face is handed views. Ops, stored formats and the wire are unchanged. What Graview Cloud changes: nothing it must. A chat that sets the order of a record's page uses `set-page-fields`; Cloud's own chrome around the record page is unchanged by this. `capabilities().shipped` gains FR-146, FR-147 and FR-148.
- ec2c73a: The scene has its place control in the bar (FR-144), and the places stand in the bar when there is room (FR-145). Nick, on 0.1.17: "is there a way to have a subnav on Scene like how there is for Pages … where i can select from the Lenses available in the Scene? … Might also be nice to have some of them available with a More dropdown when screen real estate allows (for pages nav and scene nav)". On the scene the bar said nothing after the switch, and the scene's pictures were chosen on a district's marquee or from a panel that folds to a rail. Now the same control stands there on both faces: on the scene it names what is in view — "The whole thing", or the picture showing — and lists the whole thing and every picture the seat may see, grouped as on Pages and with the same keyboard; choosing one moves the scene's `in.view` exactly as every other way to a picture does (its kind's district in focus, on the ground, showing it), and choosing the whole thing rises to it from above, as Up does, with no picture in view, and under `routing: "address"` the address with it, a step Back undoes. The panel keeps no picker of its own: the bar is the one place a picture is chosen from, and the district's marquee stays in the picture. Where the bar has room after the name, the switch and the tools, the places themselves stand on the row as plain words in their declared order — the one you are on always among them, underlined in the accent and in the weight the switch's pressed face has — and the rest fold into "More ▾"; with room for fewer than two the one control comes back, and a phone's bar keeps it. Which stand is weighed from the bar's own width — again on a resize, when the brand's face arrives, when the brand, the face or the places change — with Find giving first, down to its least, then the places folding into More, then the one control, then the app's name; the places are weighed with the switch's words kept, so the switch says its words before a third place stands. The bar stays one row of 48 px. On Cloud's workshop at 1920 px all seven places stand (Home, Dates, Decisions, Deliverables, What the workshop covers, Email to Todd, Connections), at 1280 five and More, at 1024 three and More, at 390 and in 480, 640 and 900 px boxes the one control; the scene's three stand from 1280 up. In WebKit the place list was as tall as its most with its groups spread through it; it is as tall as what it holds. `pnpm verify quiet` measures the bar on both faces at 1920, 1440, 1280, 1024 and 390 and in 480, 640 and 900 px boxes on a 1440 desk, three engines and both schemes: one row of at most 48 px, every control on its middle line, the place you are on seen on the row or the phone's first line, four or more places standing at 1920 on Pages and fewer at 1280, the scene's pictures standing at 1920, the one control on a phone and in the narrow boxes, the same row after the window is narrowed and widened again, every place reached in two presses by pointer and by keyboard with the list snug, and on the scene each picture chosen from the bar the scene's `in.view`; `pnpm verify address` chooses a picture from the scene's bar and finds the address and `in.view` moved together and Back undoing it. The hosted page carries 4.7 KB more compiling and 4.8 KB more handed a compiled app, all of it the bar — the places drawn as words with More and weighed, 3.7 KB, and the scene's places, 0.9 KB; its budgets rise by that. With a record drawn once, a view beside its record and long text on a record page in the same release, the hosted page carries 583.2 KB compiling and 538.7 KB handed a compiled app, under budgets of 583.4 KB and 538.8 KB, which leaves Cloud's shell 11.6 KB under its 595. `capabilities().shipped` gains FR-144 and FR-145.
  
  Compatibility: the look and markup a host's page reaches; ops, stored formats, the wire, the declaration, check's finding codes and tool schemas are unchanged. New: `AppBar`'s `scenePlaces` prop; `useScenePlaces`, `scenePlacesOf`, `WHOLE_KEY` (`"scene:whole"`), `WHOLE_LABEL`, `placesThatStand`, `PLACE_GAP` and `FEWEST_STANDING` from `@graview/primitives` and `/frame`; on the scene the bar's places `app-place-scene:whole` and `app-place-scene:<kind>:<as>`, each with the scene's address for it as its `data-place-path` (`/places/overview#overview=1` for the whole thing, `/places/overview#focus=aggregate%3A<kind>&in.view=<as>` for a picture); places standing on the row, inside `nav[data-testid="app-places-standing"]`, each `app-place-<key>` with its `data-place-path`, the current one `aria-current="page"` holding `app-place-current`. Changed: on the scene the bar is no longer empty after the switch; `app-places-open` is "More" when places stand and the one control when none do, and absent only when every place stands; `app-places` holds the places that do not stand, and is a `div` inside the control's `nav` (labeled "The app’s places", or "What the scene shows") where it was itself the `nav`; each place is in the bar exactly once. How a harness reaches any place, at every width and on both faces: press `[data-testid="app-place-<key>"]` (or `[data-place-path="<path>"]`) inside the embed if it is visible; if not, press `[data-testid="app-places-open"]` and then press it in `[data-testid="app-places"]`; `[data-testid="app-place-current"]` says where the reader is (`docs/stability.md`). What Graview Cloud changes: its harnesses that press `app-places-open` and then a `data-place-path` first press the place itself when it is visible — at a desk's width it may stand on the row, and with every place standing there is no `app-places-open` — and those that read the scene's bar as having no place control now find the scene's; those that count the bar's places read them from the embed (`[data-place-path]`), not from `app-places` alone.
- e42bba9: The pages face's "Ask" stays inside its embed. On graview.dev the routed face of a chapter stood its Ask fixed at the foot of the window, as a page's own control would: over every section of the landing page scrolled past a pages chapter, and, once the hero was switched to Pages, over the hero's caption ("LIVE the example garden…"), because the hero's stage animates with a transform and a transformed ancestor is the box `position: fixed` is measured from. In an embed the Ask and its drawer are now placed from the embed's box as it shows on the screen: at the foot's left of that box (at the window's foot while the box runs past it), the drawer down the box's left side and no wider than it, placed again as the host's page scrolls or the box changes size, read back and corrected where a host's transform moved them, and put away while too little of the box shows to hold them. A face that is the whole page keeps the window's foot, as before. Notices and the way back placed at an embed's foot (`placeAtTheFoot`) are likewise not drawn over the host's page while their embed is scrolled out of the window; they are still said aloud. A pane hung from a control in an embed (the place list, the person's menu, the problems) stays inside the embed's box where it fits there: on graview.dev's hero at 1024 wide the place control stands at the box's left on Pages, and the list, hung from its right edge, opened 240 px out of the box over the page's own heading; it now hangs from the control's left edge, and a pane wider than the box keeps to the window as before. The hosted page carries 269 bytes more for it, compiling or handed a compiled app. For 0.1.18 as a whole, with everything this release carries: the hosted page is 583.5 KB compiling (597 503 bytes) and 538.9 KB handed a compiled app (551 873), under budgets of 583.6 KB and 539.0 KB, which leaves Cloud's shell 11.4 KB under its 595; the sizes the release's other changesets give are each what its change measured as it landed. And the seat's header puts its toggle (▸/▾) at its end: its grid had three columns for two children, so the toggle stood in the middle one, a stray mark just after the subject's name ("the whole thing ˅").
  
  Compatibility: the look and placement a host's page reaches; ops, stored formats, the wire, the declaration, check's finding codes and tool schemas are unchanged. Inside an element marked `data-embed-content`, `[data-testid="page-ask"]` and `[data-testid="page-ask-drawer"]` carry `left`, `top` (the drawer also `height` and `width`) and `visibility` set from that box, with `bottom: auto`, where they were fixed to the window's left and foot; `visibility: hidden` while the box is out of the window. `placePane` (`@graview/react`) keeps a pane whose anchor is inside `[data-graview-embed]` within that element's box when it fits, hanging it from the anchor's other edge or holding it at the box's edge. An element `placeAtTheFoot` places is `visibility: hidden` while its anchor shows less than its own height. What Graview Cloud changes: nothing; a harness that looks for the Ask in an embed finds it inside the embed's box.
- ba17b00: The app bar fits its box. graview.dev's landing page gives the garden a box about 650 px wide on a 1440 desk, and on 0.1.17 the bar laid itself out there as a desk's bar squeezed: the app's name crushed to a letter a line down the bar's side and over the page under it ("S e e d b e d"), the place cut to "W… ▾", and Find holding the room. Nick: "the title malformed is brutal". The bar reads its own width now, never the screen's, and gives in an order: Find first, then the place down to 9em of its name (whole in its title), then the app's name, which wraps between its words onto a second line and never inside one (it was allowed to break anywhere, in a column held to a third of the bar). Find is a small box at every width that says "Find…" and its shortcut — ⌘K on a Mac, Ctrl K elsewhere, nothing on a touch screen — and is drawn wide while the keyboard is in it or it holds words; reached by Tab and by its shortcut as before, and on a phone's bar (below 640 px of its own) still a magnifier that opens the box over the row, whose list is now a sheet the bar's width hung from the bar's edge, where it was the screen's width from the screen's left even in a narrow box on a desk. The switch between the scene and the pages draws its marks alone when its words do not fit beside the rest of the row — weighed as the row is drawn, so it never flips back and forth at one width — and a host may ask for its marks alone at every width with the embed's new `switch: "icons"` (`"words"`, the default, says the words where they fit); the words are always the buttons' names and titles. `pnpm verify quiet` measures the bar in boxes of 360, 480, 560, 640, 720 and 900 px on a 1440 desk and on whole pages at 390, 1024, 1280 and 1440, both faces, a four-word name and a one-word one, a place named in a sentence, three engines and both schemes: the app's name on at most two lines and never narrower than its first word, one row of at most 48 px in a box down to 480, nothing of the bar drawn over the page under it, the place showing ten letters of its name or all of it, and Find reached by Tab and by its shortcut and typed into in every form it takes; and that the switch asked for as marks keeps its words as its names. Run against 0.1.17, the name stood on up to ten lines a letter wide, over the page by up to 69 px, and the place showed one letter. The hosted page carries 572.5 KB compiling (from 570.2) and 528.8 KB handed a compiled app (from 526.4), all of it the bar; its budgets rise by that to 572.8 KB and 528.8 KB, which leaves Cloud's shell 22.2 KB under its 595.
  
  Compatibility: the look and markup a host's page reaches; ops, stored formats, the wire, the declaration, check's finding codes and tool schemas are unchanged. New: the embed's `switch` option (`"words" | "icons"`, `BarSwitch` from `@graview/embed`, `@graview/primitives`, `/frame` and `/pages`), `AppBar`'s `switch` prop, `BAR_PHONE` (640, the bar's own width below which it is a phone's), on the switch `[data-testid="app-faces"]` the attributes `data-switch` (what was asked) and `data-switch-drawn` (what is drawn: `"icons"` on a phone's bar, when asked, or when the words do not fit), Find's shortcut `app-find-keys` (`aria-hidden`; the box's `aria-keyshortcuts` says it), the bar's `--graview-bar-width` custom property, and `--graview-bar-find-end`, the room the Find box keeps at its end for the shortcut (read by `FindBox` and `PageFind`). Changed: the switch's words are hidden by `data-switch-drawn="icons"` where a container query hid them on a phone; `app-find` is the box's wrapper, holding the face's box in `.graview-bar-find-slot` and the shortcut beside it; `.graview-bar-tools` is `display: contents`, so Find, the standing and the person stand on the bar's row themselves; the app's name breaks only between words (`overflow-wrap: normal`) and the app column is held to half the bar where it was a third. Find's box is the same input (`find-box` on the scene, `nav-find` on Pages) at every width a desk's bar has, narrower until it is used. What Graview Cloud changes: nothing it must. Its harnesses that measure Find's width on a desk measure it focused or with words in it (it is 9rem, about 144 px, until then, and 16rem while used); those that read the switch's words read its accessible names or titles, or `data-switch-drawn`, since a narrow bar now draws the icons alone; a shell whose box is small, or whose own page says what the two faces are, may pass `switch: "icons"`.
- feb577a: The place list is ready when it opens (FR-140). Graview Cloud, on a desk, from the scene: press Pages, open the place list and choose "Vendors" within a few hundred milliseconds, and the pick was dropped — the list was open, the entry a real link, `aria-pressed` already said Pages and `app-place-current` already showed, but nothing happened and the address stayed `/`. The routed face is fetched the first time it is drawn, and its router handed the bar its way of going to a place while it rendered; a render the fetch suspends is never committed, and a router that was never committed ignores a navigation, so the pick went to a router that was not there yet (and, after the scene and back, to the one of the last time Pages was drawn). The router now hands the bar its way of going once it is on the page and takes it back when it leaves, and a place asked for before then waits and is gone to as the face arrives: a pick made the moment the list is open goes to that place, however soon after pressing Pages, by pointer or by keyboard. `pnpm verify quiet` presses Pages, opens the list and picks an entry with no pause on ten fresh pages, and again after the scene and back, in three engines: 20 picks of 20 land on their place in each (on 0.1.17, in Chromium, every first pick was dropped). The hosted page handed a compiled app carries 155 bytes more for it (528.9 KB); its budget rises to 529.0 KB. `capabilities().shipped` gains FR-140.
  
  Compatibility: unchanged — ops, stored formats, the wire, the declaration, check's finding codes and tool schemas are as they were. New: `PagesSteering.pending` (`@graview/pages`), optional, the path a bar asked for before the face was listening; `PagesSteering.go.current` is now set once the face is on the page and cleared when it leaves, where it was set as the face rendered and never cleared. What Graview Cloud changes: its harnesses may drop the pause between pressing Pages and picking a place.
- Updated dependencies [44d109d]
- Updated dependencies [2278594]
- Updated dependencies [2fba4ab]
- Updated dependencies [b00d5cf]
- Updated dependencies [7f4f1bb]
- Updated dependencies [b26a186]
- Updated dependencies [ec2c73a]
- Updated dependencies [e42bba9]
- Updated dependencies [ba17b00]
- Updated dependencies [feb577a]
- Updated dependencies [33884db]
  - @graview/core@0.1.18
  - @graview/react@0.1.18
  - @graview/primitives@0.1.18
  - @graview/tools@0.1.18
  - @graview/layout@0.1.18

## 0.1.17

### Patch Changes

- b124330: What the review after 0.1.16 found in the old documents and the switch (FR-134, FR-136, FR-137), fixed. A document 0.1.16 wrote whose scene was called something of 25 to 40 characters stopped compiling: `pages.overview` took 40, and the `pages.scene` it is now read as took 24, so the respelling narrowed the key. `pages.scene` and `pages.pages` take 40 again, and the bar cuts a long word on the switch with an ellipsis, whole on hover. `arrange-pages` refused `overview` as a key it did not know, so a chat or a tool written before 0.1.17 could no longer rename the scene; it reads `overview` as `scene` now, and `scene` wins when both are said. `editDocument` with no edits gave the document back as stored, old keys and all, where any other edit list gives it in the current spelling; it gives the current spelling too, so a studio opened on a stored document and applied with no change hands back what `toDocument` writes. A declaration whose switch would say one word twice (`pages: { scene: "Lists", pages: "Lists" }`, or `scene: "Pages"`) is warned of by `graview check` as `pages-faces-alike`. In an embed narrower than `pagesBelow`, a reader who pressed Scene could not get back: Pages told the host the face, and a host that keeps its own face drew the scene still. Pages now stands the scene aside again, as it stood before, and the host's face is kept for when there is room. A home view written as blocks drew the app's description over its own headline, like an eyebrow; the description now follows the home's headline, and a home with none, or one a worker draws, still says it first. The profile's choices (who you sit as, the app's settings, the scheme) and the footer's "Answers come from" were capsules ringed in the accent; they are quiet boxes now, the one chosen pressed the way the bar's switch presses a face. The hosted page carries 570.1 KB compiling and 526.4 KB handed a compiled app, within their 570.5 and 526.5: the embed says an address within the app one way where it said it four.
  
  Compatibility: additive, for the document. `pages.scene` and `pages.pages` take up to 40 characters (were 24 in the unreleased build, and `pages.overview` took 40), `arrange-pages` reads `overview` as `scene`, and `editDocument([])` gives the document in the current spelling. A new check warning, `pages-faces-alike`. `@graview/primitives` and `/pages` gain `HomeLine`, the line said under a home's headline. Markup: the app's line on a home made of blocks (`app-subtitle`) is the next sibling of the home's first headline rather than the first child of `home-view`; the setting, seat and scheme buttons keep their test ids and `aria-pressed`, and their pressed look is a tint rather than an accent ring. Ops, stored formats, the compiled-app format, wire messages and tool names and schemas are unchanged. `capabilities().shipped` is unchanged.
- b124330: The scene and the pages are two things, and the bar says so; the places move out of the bar; and a home view is the front page on a desk too (FR-136, FR-137, FR-138). Nick, on 0.1.16 at a desk: "the new nav kinda sucks, and i don't see a way to go to the scene vs pages anymore". FR-132 had made the scene "Overview", one of the places laid along the bar as tabs, and on Graview Cloud's workshop app — two pictures named in sentences ("What the workshop covers", "Email to Todd") beside three kinds' lists — the tabs filled the bar's top edge and wrapped to a second row, the page under the bar repeated them ("On the overview ↗", the other pictures again), and the home a chat wrote stood as a card over the scene's top right. Right after the app's name the bar now has one switch: "Scene" and "Pages", an icon and a word each (the icons alone on a phone, the words their accessible names), two buttons whose `aria-pressed` says which face is drawn. Scene draws the scene under the bar; Pages goes back to the page the reader was on. A declaration may call them something else (`pages: { scene: "The farm", pages: "Lists" }`; `arrange-pages` takes `scene` and `pages`), and the scene keeps its address, `/places/overview`, so links, `where()`, `setPath` and `setApp` are as they were. On Pages, the place you are on is one control after the switch, its name and a chevron, that opens every place the app has: the home first, then Lists (one per kind) and Pictures (each named lens, and how the kinds connect), each with its mark in its kind's hue, a long name wrapped inside the list. Every place is two presses away, the keyboard reaches the switch, the control and every entry, and Escape gives it back to the control. The bar is one row of 48 px, its rule included, whatever the app holds, every control on the row's middle line; on a phone the place control is the page's first line, under the bar. A picture's page keeps only its own link, "All deliverables as a list"; the other places are the list's. An app with a home view — the declaration's `views.home`, or a worker view attached to `"home"` — opens on Pages at its home, full width under the bar, on a desk as on a phone, when the host names no face; under address routing it does so at the bare address whatever face the host names, and `where()` says so. Without a home view nothing changes. Why the old claim missed the wrap: "at most one bar row on a desk" counted the distinct tops of the bar's three regions (the app, the places, the tools), and a tab that wraps inside the places' region moves no region's top; it ran on two apps whose place names were short, at 1280 px. `pnpm verify quiet` now measures every control on the bar by its own box on a document shaped like Cloud's and on the same with thirty places, at 1000, 1024, 1280 (also at twice the pixels) and 1440 px and at 390, in three engines and both schemes: one row of at most 48 px, every control on the row's middle and none at the top edge, the switch saying Scene and Pages and marking the one drawn, every place in two presses by pointer and by keyboard, nothing calling the scene "the overview", a picture's page not repeating the places, and a home view opening full width under the bar. `pnpm verify address` holds that the switch is a step Back undoes and that an app with a home view opens on it at the bare address; `pnpm verify declared` that the front page made of data is where the app opens and nothing floats over the scene. The hosted page carries 569.9 KB compiling (from 566.3) and 526.1 KB handed a compiled app (from 522.6), the switch and the place list 2.4 KB of it and the embed's opening 0.8 KB; its budgets rise by that to 570.5 KB and 526.5 KB, which leaves Cloud's shell 24.5 KB under its 595. `capabilities().shipped` gains FR-136, FR-137 and FR-138.
  
  Compatibility: markup, options and addresses a host holds, and the document's `pages`. Gone: the bar's place tabs (`.graview-bar-places`, `.graview-bar-tab`, `.graview-bar-measure`), `app-places-more` and `app-places-more-list`, the overview's entry `app-place-overview` (the scene is the switch's), the routed face's `place-stop` and `sibling-pictures` under a picture's title, the scene's landing for a home view (`home-landing`, `home-landing-away`, and `HomeLanding` from `@graview/primitives` and `/scene`), `OVERVIEW_KEY` (`@graview/primitives`, `/frame`, `/pages`), `overviewTitle` (`@graview/core`) and `OverviewLink` (`@graview/pages`), and `barPlaces`'s `overview` option. New: the switch `[data-testid="app-faces"]` (`role="group"`) with `app-face-scene` and `app-face-pages` (`aria-pressed`); the place control `app-places-open`, its words `app-place-current`, its list `app-places` (a `nav`, now opened by the control and `hidden` until it is) with groups `[data-place-group="home|lists|pictures"]` and entries `app-place-<key>` (`home`, `kind:<kind>`, `place:<kind>:<as>`, `connections`) carrying `data-place-path`; on a phone the place line `app-place-line` (`[data-graview-place-line]`); a picture's own `place-as-list`; `AppBar`'s `faces` (`BarFaces`, `BarFace`), `BarPlace.group` and `.kind` (`BarPlaceGroup`), `BAR_HEIGHT`, `HOME_KEY` and `HOME_PATH`; `sceneTitle` and `pagesTitle` (`@graview/core`), `SceneLink` (`@graview/pages`, saying "In the scene ↗" where `OverviewLink` said "On the overview ↗"), `EmbedProps.onOpening`, and `opensOnTheHome` (`@graview/embed`). `barPlaces` lists the home first and has no overview. `POPOVERS.places` (`@graview/react`) is the place list: its trigger `app-places-open`, its pane `app-places`. The document's `pages.overview` is respelled `pages.scene` (a line in `RESPELLED`, so a stored document keeps its word on the switch), and `pages` gains `pages`; `arrange-pages` takes `scene` and `pages`, and still reads `overview` as `scene`, and its sentences say "the switch calls the scene …". An embed whose host names no face opens on Pages at the home when the app has a home view and its `pages.first` names no other place (`where().face` is `"pages"`), where it opened on the scene; under `routing: "address"` the bare address, with no fragment and no entry the router wrote, does so whatever `face` the host names, and `<Embed>`'s `onFace` is told `"pages"`. `placesOf(app)` marks the home `first` when the app has a home view and no `pages.first`. What Graview Cloud changes: its harnesses press `app-face-scene` and `app-face-pages` where they pressed `app-place-overview` and a place's tab, and reach a place by `app-places-open` and then `app-place-<key>`; they read the face drawn from `aria-pressed` on the switch, and the place from `app-place-current`. A shell that mounts on the Graview at the app's bare address now lands on the home view when the app has one; one that wants the scene there links to `/places/overview`. A chat tool may send `arrange-pages` with `scene` where it sent `overview`; the old word still works. Ops, stored formats, the compiled-app format, wire messages and tool names are unchanged.
- Updated dependencies [cc690c4]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
- Updated dependencies [b124330]
  - @graview/core@0.1.17
  - @graview/primitives@0.1.17
  - @graview/react@0.1.17
  - @graview/layout@0.1.17
  - @graview/tools@0.1.17

## 0.1.16

### Patch Changes

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
- Updated dependencies [87e43d3]
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
  - @graview/primitives@0.1.16
  - @graview/react@0.1.16
  - @graview/layout@0.1.16
  - @graview/tools@0.1.16

## 0.1.15

### Patch Changes

- efab5b2: One place says how many problems there are (FR-122). Cloud's vendor template, fresh, breaks three rules, and its Pages home said so three times: "3 problems" on the embed's bar, "Problems 3" in the page's tabs, and "3 problems — see what is broken, and what would fix it" under the headline. The count is now said once. Under the embed's strip, whose Standing says it and opens the problems, the shell's Problems tab names the page with no number. A face with no bar above it keeps the number on its Problems tab. The home never says the number: it says "Rules are broken — see what, and what would fix it" ("A rule is broken" for one) and links to `/problems`, on the derived home and above a home view alike. `pnpm verify quiet` counts every visible text above the fold that says the number and is about the problems, on the vendor template's Pages home and Graview face at 390×844 and 1280×800, in Chromium, WebKit and Firefox and both schemes. Before, the Pages home said it twice on a phone (the tab's count sat past the right edge of the row that scrolls) and three times at a desk. Now every one of the 24 screens says it exactly once, on the bar's Standing; the Graview face already did. The same harness holds that the Standing's name says the count, that Tab reaches it, and that Enter opens the list of problems.
  
  Compatibility: markup changes a host may style against. The shell's Problems tab carries `data-testid="problems-count"` only when no bar above says the count, and the home's link to the problems no longer holds the number. `PageContext` gains an optional `standingAbove`, which the embed sets while its strip is drawn; a context without it keeps the tab's count. `capabilities().shipped` gains `FR-122`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
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
  - @graview/primitives@0.1.15
  - @graview/react@0.1.15

## 0.1.14

### Patch Changes

- fc42f1e: A coverage cell over a path selects what it joins (FR-111). A filled cell wore only its column's id, so on a Strengths lens that crosses people with skills through a `strength` record, choosing Ryan × SEO selected SEO, and its line ran to the collapsed strengths' district — a stand-in for records the picture does not draw. A filled cell now says what it joins (`data-graview-joins`: its row, its column and the records on the path, `["p-ryan","sk-seo","st-ryan-seo"]`), and choosing it selects exactly those: on the Graview face the scene's selection is the three (`onPick` carries the joins; shift or ⌘ adds them), and on the routed face's `/places/<as>` the picture stays where it is, lit with its row and its column, instead of going to the column's page — the row's and the column's names still go to their pages. The lens draws the crossing's own lines, from the cell to the row's name and to the column's head, ending on each, inside the picture so they scroll with it; a stacked grid on a phone names the column inside the cell, so there the line is the row's. A record on the path gets a line only where it is drawn as itself, and nothing is drawn to a district: the scene's selection lines give way to a chosen crossing, and draw from the cell only to a joined record that has a card of its own on the stage. `verify-declared` chooses Ryan × SEO on both faces at 1440×900 and 390×844 and asks that each line ends on what it names and that no line goes to a district.
  
  Compatibility: unchanged for stored data, ops, tool schemas and the wire. A filled coverage cell keeps `data-graview-pick` (the column's id) and gains `data-graview-joins`; a host or test that read the scene's selection after a cell press reads the row, the column and the joining records where it read the column. The routed face's place page no longer navigates on a cell press. `capabilities().shipped` gains `FR-111`.
- 45842b7: A number field may say its range (FR-114). In a document, a `number` or `integer` field — and an act's declared argument — takes `min`, `max` and `step` (`"level": { "type": "integer", "min": 1, "max": 5 }`); `step` is what its values are whole multiples of, JSON Schema's `multipleOf`. The range is the field's schema, so everything that reads the schema honours it: a value outside it is refused at apply as `invalid`, whichever act brought it (a `set-level` given 9, a `note-strength` that makes a strength at 9, a derived `edit-<kind>`); an agent's tool says `minimum`, `maximum` and `multipleOf`; and `describeArg` and `formField` carry `min`, `max` and now `step` (1 for a whole number), which the routed face's form, the workbench's answer box and the studio's agent panel put on their number inputs, so a form will not take 9. A declared argument that fills a ranged field and says no range of its own is asked for within the field's. `graview check` refuses `default-range` when a default is outside its field's range or off its step, and `field-range` for a range on a field that is not a number, a `max` below its `min`, or a `step` that is not above zero, by path — asked with the checker (`compileDocument`), not by a page compiling a document its host has judged, so the hosted page does not carry them. `editDocument` gains `set-range` (`{ kind, field, min?, max?, step? }`, `null` clears one), refused on a field that is not a number or one whose default it would leave outside; `set-default` is refused outside the range, and `retype-field` to anything that is not a number lets the range go. `diffDocuments` says a changed range ("strength's level now takes 1 to 3, where it took 1 to 5; values outside it are cleared"), and a narrowed one is breaking and listed in `narrowedRanges`; `planMigration` clears the values a narrowed range no longer takes. `toDocument` writes a TypeScript field's inclusive bounds (`.min(0).max(1)`, `.multipleOf(0.5)`) as its document field's range. The studio keeps a document's range through a change it makes, says it up front (`studio-keeps-range`, "taken from 1 to 5"), and refuses to retype such a field rather than let the range go unsaid.
  
  Compatibility: unchanged for stored data, ops and the wire. Additive within `graview-document@1` (docs/stability.md): a field without a range means what it meant. `ArgShape`'s number and `ScalarField` gain an optional `step`, and an integer argument now describes itself with `step: 1`. `DocumentDiff` gains `narrowedRanges`, and the edit vocabulary gains `set-range`. `graview check` gains two error codes, `default-range` and `field-range`, which judge only keys a declaration could not hold before. `capabilities().shipped` gains `FR-114`.
- 8c43964: A pill means "press this to choose", or a state (FR-117). Building En Dash Org on Graview Cloud ended in one verdict: "too many pills, and too much cut-off text, on every face". When everything is a capsule, nothing reads as the thing to press, and a state badge, the one pill that earns its place, no longer stood out. Now one rule holds on every face. A capsule is a choice the reader can make, or a record's state badge, and nothing else is one. In a set of choices (the face switch, a calendar's range, the "Answers come from" setting, the embed's seats), the one chosen wears the capsule and the others are words to press. The places are text tabs that scroll, with the current one underlined, on a desk and on a phone alike. They are tabs rather than a menu because the places are the app's own navigation, read at a glance: a menu hides every name behind a press, and tabs keep every name whole and on screen. The tabs scroll sideways, a mouse wheel included, and the edge with more beyond it fades. The place you are on is scrolled into view, and each tab is a button the keyboard reaches. The "+N more" select and the phone's single select are gone. A district's name in the scene is text on its plot, haloed in the ground's colour, and its trouble bar is the name's baseline. The open control beside it is a quiet chevron. The scene's "Up" / "Down to …", the zoom control, the seat's suggestions and a calendar's previous, today and next are quiet buttons or links. A record is a card. A chip, a coverage cell's label, a relation's sign on a line and a kind's link on the routed home have a card's corners. A place page's other pictures are links. A kind's mark is its plot in miniature, a small iso tile in the kind's hue, rather than a round dot. A badge is not drawn where its context already says it. No card on a status board wears its own column's status, and a row under a grouped list's heading does not repeat that heading's value. The same goes for a field block of the board's own field. Other badges and blocks are drawn as before. A new harness, `pnpm verify quiet`, mounts the embed over the org app and Cloud's vendor template, as Cloud mounts it. It counts pills by Cloud's own definition: a visible element under 34 px tall, with a corner radius of at least half its height and a fill or a border. It runs in Chromium, WebKit and Firefox at 390×844 and 1280×800, in both schemes. The org app's desk Graview face goes from 39 pills to 4, and the vendor template's phone Pages home from 34 to 7. On the vendor template's desk Graview face it is 20 to 4, and on the org app's phone "Skills and levels" 12 to 7. No board card wears its own column's status, where four did. Cloud's hosted page loads 580 402 bytes up front (567 KB), where it loaded 580 510, so the design pass is 108 bytes smaller up front. The embed without the studio is 696 582 / 178 525 bytes first, where it was 696 428 / 178 422, and its gzipped budget is now 178 600.
  
  Compatibility: `Places` renders `nav[data-testid="places"]` holding `button.graview-place-tab[data-testid="place-<as>"]` (with `aria-pressed`) at every width. The `places-more` select and the compact `select[data-testid="places"]` are gone, and `compact` now puts the tabs on a row of their own. At altitude, `.graview-kind-face` has no capsule: no background, border or radius, and `[data-graview-tally]` is drawn at its foot. `.graview-kind-open`, `.graview-zoom`, `.graview-zoom-button`, `.graview-altitude-control` and `.graview-kind-tag` are no longer capsules. `Chip` has a 6 px radius. A kind's mark with no figure (`[data-graview-figure-kind="dot"]`) is a clipped iso tile, no longer a circle. The columns lens and a grouped list tell the cards they draw which value their heading already says; there is nothing new to import. `capabilities().shipped` gains `FR-113`, `FR-117` and `FR-118`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- 05b0a95: A hosted page has room again: Cloud's hosted page loads 555.0 KB up front, where this round's features had brought it to 570.0 KB, and its budget comes down from 572 KB to 563 KB. Graview Cloud holds its shell to 595 KB with about 25 KB of its own, so the framework's page has to stay near 565 KB for Cloud to have any room; Cloud's shell built from these sources measures 554 KB, where it measured 569. Nothing a reader sees changed. A bundler gives a whole file to a page's first chunk when the first chunk can reach it and any chunk uses it, and the frame of every face reached, through the entries it imports up front, files that only a drawn view uses. Those now have entries of their own, fetched with the face that draws them. `@graview/react/drawing` holds the measured text, the kit's connector, the boundary a view draws inside, the sets a view lights and dims by, the fields edited in place, the others placed on a picture and the attention a seat pipes in (React 6.1 KB smaller up front, and `@graview/render` no longer up front at all). `@graview/tools/edit` holds the fields a record lets a reader change, and the reader's pins left `@graview/tools/frame` (tools 1.7 KB). A label's fit left `@graview/layout/view`, which keeps only the estimate of a line's width (layout 1.6 KB). The arranging of a list is `@graview/core/arrange`'s (core 4.0 KB). And the assistant fetches the describer when a place is first asked about, not with its seat, so the pages face alone loads 475.8 KB first, where it loaded 488.7. The bundle budgets come down where they shrank: the pages face alone to 488 000 / 166 000 bytes, the embed without the studio to 682 500 / 173 500, and the embed with the studio handed in to 1 472 000 / 436 500.
  
  Compatibility: the arrangement's functions moved from `@graview/core` to `@graview/core/arrange`: `arrange`, `arrangeable`, `arrangeAllows`, `admitArrangement`, `asksForThePast`, `bucketStart`, `conditionHolds`, `edgesOf`, `formatArrangement`, `matches`, `NO_ARRANGEMENT` and `parseArrangement`. Their types stay on `@graview/core`. `useActivity`, `useAttention`, `useDrawnSize`, `useTextMeasure`, `useEditableFields`, `useFlagged`, `useImplicated`, `useReached`, `NOTHING_FOUND`, `useKit`, `kitConnector`, `ViewBoundary`, `anchorOf`, `placeOthers` and `AUDIENCE_ROW` moved from `@graview/react/provider` to `@graview/react/drawing`, and all of them are still on `@graview/react`. `editableFields`, `loadPins`, `savePins`, `togglePin` and `NO_PINS` are no longer on `@graview/tools/frame`: `editableFields` is on `@graview/tools/edit`, and all of them are still on `@graview/tools`. `fitLabel`, `areaOf`, `boxOf`, `centroidOf`, `overlaps` and `spanAt` are no longer on `@graview/layout/view` and are still on `@graview/layout`. `@graview/core/arrange`, `@graview/react/drawing` and `@graview/tools/edit` are new entries, and a linked project's vite config aliases each of them. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
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
- Updated dependencies [1712959]
- Updated dependencies [45842b7]
- Updated dependencies [8c43964]
- Updated dependencies [f16cfbc]
- Updated dependencies [63dfe90]
- Updated dependencies [b8c4527]
- Updated dependencies [ab91f13]
- Updated dependencies [b9435aa]
- Updated dependencies [05b0a95]
- Updated dependencies [196033b]
- Updated dependencies [6ac06de]
- Updated dependencies [bd69456]
  - @graview/core@0.1.14
  - @graview/primitives@0.1.14
  - @graview/react@0.1.14
  - @graview/layout@0.1.14
  - @graview/tools@0.1.14

## 0.1.13

### Patch Changes

- ed5444b: A host whose page is the app can give the routed face the address bar (FR-106). The embed's routed face ran on a memory router, so in Graview Cloud's hosted app a place could not be linked, reloaded or shared: loading `/places/vendors-by-status` drew the home, and opening the board's tile left the address at `/`. The embed takes `routing: "address"` now, with a `basePath` for a host that serves the app under a path of its own (`/apps/<id>/`; `/` by default). The routed face then reads its route from the address and pushes each page it opens. Places (`/places/<as>`), records (`/<plural>/<id>`) and the home have their own addresses. Back returns to where you were, and a reload stays put. The address also says which face is drawn. A page past the home is the routed face. A fragment at the home is the scene's stop, kept the way the whole-page Shell keeps it: a step is pushed, and moving the furniture replaces. A bare home is the routed face's home, or on arrival the host's `face`. The face toggle pushes the address of the face it goes to, so Back undoes it, and the toggle returns to the page you left. `mount` opens on the face the address names, and `faceAtAddress(options)` says which that is for a host that renders `<Embed>` itself. `routing: "memory"` stays the default for an embed inside somebody else's page, and it never writes `history` or changes `location`. A host that keeps its own history stays on memory routing. `onNavigate(path, how)` tells it each page the routed face opens, and `setPath(path)` on either handle sends the face back to one. `PagesApp` takes the same `onNavigate` and `path`. `addressOf(place, { basePath })` in `@graview/core` spells a place from `placesOf` under the base, exactly as the face's own links do, `pathWithin` reads an address back, and `basePathOf` normalises a base. Trailing slashes are the same base, and encoded slugs stay encoded. A new harness, `pnpm verify address`, holds all of this in Chromium, WebKit and Firefox at a desk and a phone, and it checks that an article's embed makes no history writes. The scene's fragment sync (`UrlSync`, `useUrlSync`, `adjustment`) is now a module of its own, so a page that never syncs the fragment does not load it up front. Cloud's hosted page loads 577 855 bytes up front (564 KB), where it loaded 575 357; the budget stays at 572 KB. The embed without the studio is 694 569 bytes first, where it was 692 174, and its budget is now 695 000 / 177 500. The gzipped budget for every face is now 439 000.
  
  Compatibility: `@graview/react/provider` no longer exports `UrlSync`, `useUrlSync` or `adjustment`; `@graview/react` still exports all three. `capabilities().shipped` gains `FR-106`. Memory routing is the default, so an embed that does not ask for the address bar behaves as before. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [2b05a64]
- Updated dependencies [8bc3c59]
- Updated dependencies [4d3c1f9]
- Updated dependencies [ed5444b]
  - @graview/core@0.1.13
  - @graview/primitives@0.1.13
  - @graview/react@0.1.13
  - @graview/layout@0.1.13
  - @graview/tools@0.1.13

## 0.1.12

### Patch Changes

- 4801c44: What only a fetched face, an agent's seat or the checker uses has left `@graview/core`'s main entry and `@graview/core/document` for subpaths named for what they hold, and the hosted page has room again. A hosted page imports both barrels up front. esbuild gives a whole file to every chunk that can reach it, so a name a barrel re-exported rode in the page's first chunk as soon as any lazily loaded face used it, though the page never called it before a reader acted. Measured from esbuild's metafile, three moves were each worth more than 2 KB. The first is `@graview/core/blocks`: a view's blocks resolved against a record, and the computed values they read. It took 8.3 KB off. The second is `@graview/core/check` with `@graview/core/scene`. The checker was reachable from both barrels: `checkApp` from the main entry, and `compileDocument` beside the compiler a page uses. Through it the page reached the city, which only the scene draws. The checked compile and template instantiation are now modules of their own, so the compiler a page uses no longer imports the checker. This took 2.6 KB off. The third is `@graview/core/figures`, the shipped drawings, which took 2.8 KB off. The page now loads 575 357 bytes up front (562 KB), where it loaded 589 079 (575 KB). Cloud's own shell, built from these sources, is 560.3 KB, where it was 573.7. The budget claim is now 572 KB: the new figure with 10 KB of headroom. The embed without the studio now loads 692 174 bytes first, where it loaded 787 572. The studio, fetched only when it is drawn, asked for `checkApp` through `@graview/core`, so the checker and the document compiler it reaches rode in the frame's first chunk. Its budget comes down to 693 500. A test names every moved export and holds it off both barrels, and the hosted page's test holds the modules themselves out of what it loads first. Some levers were measured and left alone because each was under 2 KB: `formFields` and the rest of the act form (1.8 KB), `beginning` (1.7 KB), the JSON Schema helpers (1.3 KB) and `walkKinds` (0.3 KB). zod's JSON Schema writer (20 KB) stays up front. `zod/mini`, which the page needs, re-exports `toJSONSchema`, so no subpath of ours can put it out of the page's reach while the companion's act tools use it.
  
  Compatibility: these exports moved, with no alias left behind. From `@graview/core` to `@graview/core/check`: `checkApp`, `formatFindings`, `describeApp`, `generateAgentsMd`, `generateLlmsTxt`, and the types `CheckResult`, `Finding` (the checker's), `Severity` and `DescribeOptions`. From `@graview/core/document` to `@graview/core/check`: `compileDocument` and `instantiateTemplate`. `compileDocumentWithoutCheck` stays in `@graview/core/document`. From `@graview/core/document` to `@graview/core/blocks`: `compileBlocks`, `fieldSpecsOf`, `isTallBlock`, `resolveBlocks`, `safeHref`, `sayNumber`, `computedNames`, `computedValues`, `withComputed`, and the types `BlockContext`, `ResolvedBlock`, `ResolvedList`, `SpecBlock`, `ComputedRecord`, `ComputedValues` and `PlainComputed`. From `@graview/core` to `@graview/core/scene`: `BLOCK`, `cityExtent`, `cityMap`, `heightOf`, `MAX_SIDE`, `plotsOverlap`, `roadsOf`, `sharedEdges`, `sideFor`, `toIso`, `villageCap`, `villageOf`, `sceneDistricts`, and the types `Building`, `CityHints`, `CityMap`, `Plot`, `Road`, `SceneDistrict` and `SceneDistrictOptions`. From `@graview/core/document` to `@graview/core/scene`: `sceneThumbnail`, and the types `SceneThumbnailOptions` and `ThumbnailSource`. From `@graview/core` to `@graview/core/figures`: `FIGURES`, `FIGURE_NAMES`, `figureBrief`, `figureFaults`, `figureSvg`, and the type `Figure`. `@graview/primitives` still re-exports `compileBlocks`, `safeHref`, `sayNumber` and `SpecBlock`. A project made by `graview create` imports `checkApp` and `compileDocument` from `@graview/core/check`, and a linked one aliases the four new subpaths. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [4801c44]
  - @graview/core@0.1.12
  - @graview/layout@0.1.12
  - @graview/react@0.1.12
  - @graview/primitives@0.1.12
  - @graview/tools@0.1.12

## 0.1.11

### Patch Changes

- Updated dependencies [e6f90e0]
- Updated dependencies [e6594bb]
- Updated dependencies [fc50abf]
- Updated dependencies [31a6383]
- Updated dependencies [617b432]
- Updated dependencies [a738797]
- Updated dependencies [e567a7b]
- Updated dependencies [a190947]
  - @graview/core@0.1.11
  - @graview/primitives@0.1.11
  - @graview/layout@0.1.11
  - @graview/react@0.1.11
  - @graview/tools@0.1.11

## 0.1.10

### Patch Changes

- 6b7edf9: A declared lens draws (FR-79). A document's `lenses` were accepted and drew nothing, and so were a TypeScript app's: a lens drew only because the app's own UI called `createTimelineLens(…)` and registered the result with a title, so a chat that wrote a lens into a document made something nobody would ever see. A `lenses` entry now takes a `title`, an `on` (the kind it stands on, when its bindings do not say) and data-only `options`, and a shipped lens with a title is a place: a pill on the bar, a drive-in from altitude and a page at `/places/<as>`, registered over each kind it stands on at many × full and many × summary. `declaredLenses(app)` in `@graview/core` decides which lenses draw, with which factory options resolved from the bindings, and why the rest do not; `SHIPPED_LENSES` names the six it maps — `timeline`, `calendar`, `coverage`, `board`, `plan`, `reach` — with their roles and the options each takes. `registerDeclaredLenses(registry, app)` in `@graview/primitives` (and `@graview/primitives/frame`) registers each as a door to the shipped factory, fetched when a lens is first drawn (`fetchDeclaredLenses`), and `declaredViews(app)` is the defaults, the view specs and the declared lenses in one registry. The embed calls it for every app it mounts, so a document's lenses draw with no views at all. What a factory needs that cannot be data is derived: a timeline's columns from the values its `column` field takes (or `options.columns`), its axis words from its extent, a calendar's `today` from the reader's own clock unless `options.today` names one. `graview check` says why a titled lens cannot draw, at its path — `lens-cannot-draw`, `lens-option-unknown`, `lens-title-taken`, `lens-not-shipped`, every one a warning — and a shipped lens needs no `requiredRoles` or `binds` of its own (`requiredRolesOf`, `bindsOf`). `plan` joins the shipped names in the checker and in `graview describe`, which now says which declared lenses draw, over what, at which address, and why a titled one does not. `placesOf(app)` lists every place an app has — the home, each lens, each kind — as `{ slug, title, kind, cardinality, address, stop, lens?, hidden?, first? }`, for a host to list. Apps/todo, apps/rota, apps/gauntlet and apps/discography declare their shipped lenses with titles and register none of them by hand. The studio keeps two lenses of one name apart by their titles. `@graview/primitives/scene` is a new subpath (the companion, the inspector, the places bar), which the embed's scene face and the pages' assistant import so that a face which draws no lens does not carry the six factories; `@graview/primitives/pages` also exports `registerDefaultViews` and `registerViewSpecs`. The bundle budgets for every face and for the studio handed in rise to 1_400_000 / 412_000, and what a page without the studio loads first to 203_000 gzipped, said in `scripts/lib/bundle-budget.mjs`, which now measures from the page's own entry rather than the first chunk esbuild lists. A hosted page carries 563 KB up front. Unit tests compile a document declaring one lens of each shipped type and find each drawn by its title on the embed's bar and at its page, `check` and `describe` agreeing with the one list; `verify-declared` does it in a browser. The `graview-lens` skill says to declare a shipped lens rather than register it. `capabilities().shipped` names FR-79.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `title`, `on` and `options` are new optional fields of a `lenses` entry, and `requiredRoles` is optional on `LensDeclaration`. The new codes are warnings, never errors, and a declaration that checked clean before still does; a check's `where` names a titled lens by its title. The wire — `capabilities().shipped` gains `FR-79`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `arrange` and `arrangement`, so a hand-built registry needs neither.
- fff6319: A `DerivedForm` names its parts: the form, each field (with `data-graview-field` saying its control), its label, its control, a picker and its chevron, a group, a list's rows and its add and remove, the refusal and the submit each wear `data-graview-part`. Their look moved from style attributes to rules at one element's weight, so an app's `[data-graview-part="control"]` restyles every control without `!important`, and with no sheet of its own a form looks as it did.
- 77a9fdc: A home view from the closed block set (FR-81). The home was always derived, and a document that wrote `views.home` was refused. A declaration's `home` — a document's `views.home`, a list of blocks — is now the home's body on both faces: on the routed face it replaces the derived home under the shell, its first headline the page's `h1`; on the Graview face it stands as a landing over the picture whenever the scene is at home (nothing focused, nothing chosen), at ground level and from altitude, on the side the companion leaves free, put away by going anywhere or by its own button (`HomeLanding` in `@graview/primitives` and `@graview/primitives/scene`, drawn by `Shell` and the embed's scene face). An empty graph still opens on the way in: the home view yields to the beginning until there is a record to show. Three blocks join the set, and work in a card, a row and a page as well as the home: `headline` (a template), `figure` with an expression (`{ figure: "sum(all('package'), net)", as: "number" | "money" | "percent", currency: "USD", label }`; `{ figure: true }` is still the kind's picture), and `list` (`{ list: expr, sort: key | { by, direction: "asc" | "desc" | "choices" }, limit, group: field | { by, headings }, empty, as: "card" | "row" }`), which draws each record with its own card or row spec and makes it a link — a record's address on the routed face (`SpecLinks`), a pick on the scene. Blocks about no one record may not name a bare field and reach records with `all('kind')`; a list's sort key and group are held to the kinds its source reaches. A lens named `blocks` with a title, an `on` and `options.blocks` is a place drawn from the same blocks, so a chat can write a picture with no code (`SHIPPED_LENSES.blocks`). The registry carries the home view beside the places (`registry.home(view)`, `registry.homeView()`), set by `registerDeclaredLenses` and fetched when first drawn (`fetchHomeView`); `graview describe` says the home is drawn from blocks, and the document diff says when the home's look changes. FR-83's gap closes: a kind's `glance` may name a computed field (the card and the list line work it out over the seat's graph), and a `label` or `describe` may name one worked out from the record alone — one that reads beyond the record is refused, since a label is said with no graph in hand. `packages/core/tests/document/fixtures/lifelogics.gdd.json` rebuilds LifeLogics' front page and its four lenses as data; unit tests draw it, and `verify-declared` draws it on both faces at 1440×900 and 390×844 in both schemes. The `graview-pages`, `graview-node-kind` and `graview-lens` skills say how. The bundle budgets rise with measured numbers in `scripts/lib/bundle-budget.mjs`: an embed without the studio to 815_000 / 215_000 (measured 802_562 / 209_988), every face and the studio handed in to 1_430_000 / 424_000 (measured 1_420_964 / 418_572 and 1_414_220 / 413_619); a hosted page carries 584 KB up front, and a face before it draws at most 840 KB (the scene measured 836_810, from 817_424). `capabilities().shipped` names FR-81.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `views.home` as a list of blocks, the `headline`, `list` and expression `figure` blocks, and the `blocks` lens are new; `views.<kind>` as an object of slots reads as before, so a kind called `home` keeps its views. A titled lens named `blocks` was a warning before and draws now; what its blocks cannot say is a warning at its path, never an error. A `label`, `describe` or `glance` naming a computed field was an error and is now accepted where it can be said. New codes (`list-sort`, `list-group`, `list-limit`, `list-as`, `list-empty`, `view-currency`) are errors only on blocks that could not compile before. The wire — `capabilities().shipped` gains `FR-81`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `home` and `homeView`; `RenderContext` an optional `budget`.
- 77a9fdc: A view can list related records (FR-82). A to-many walk in a block flattened to "A, B and C" or a count, and nothing could draw each related record or link it. The `list` block now takes a walk from the record as its source in a card, a row or a page — `{ list: "out('includes')", as: "row" }` on a package's page lists its offers, each drawn with the offer's own row and each a link; `{ list: "in('answers')" }` on a note's row lists the offers that answer it. A row that lists records or says a figure is drawn as a block rather than a one-line pill. The list reads the graph the view is handed, which for a seat is what that seat may see (FR-55): a related record it may not see is not listed, not counted in "and N more", and opens no group heading of its own, and a list left with nothing says its `empty` words. Lists nest at most three deep (`MAX_LIST_DEPTH`); past that a list says its records' names, each a link, so a card that lists records whose cards list records — round a loop or down a long chain — always ends, and every expression keeps its own step budget. `graview check` holds a walked list's sort key and group to the kind the relation reaches, and refuses a walk along a relation no kind declares. Unit tests draw the LifeLogics document for an owner and for a partner who sees only the offers their firm delivers, and find the partner's package page, note rows, home counts and group headings saying nothing of the rest; `verify-declared` follows a listed record on both faces. `capabilities().shipped` names FR-82.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: a walk is a new source for the new `list` block, and nothing that compiled before reads differently. The wire — `capabilities().shipped` gains `FR-82`. Ops, stored formats and tool schemas are unchanged.
- 5703a27: A worker view's links stay in the app (FR-93). The kit's `gv-link` could go to any `https:` address a host allowed, and a view written by a chat should be able to send the reader to a record or a place of the app it is drawn in, and nowhere else. The open kit already draws no `href`, so a view's `<a href="https://…">` is text. A view now writes `<a data-record="offer:coaching">` or `<a data-place="the-packages">`, and the host makes that a link: focusable, with the role of a link, and followed by the host when the viewer presses it or presses Enter on it. It goes only to a record the viewer may see or a place the app has. `graview.navigate("offer:coaching")` and `graview.navigate({ place: "the-packages" })` from the view's code are held to the same, and the guest-view protocol gains `navigate` with a `place`. A view's props list the app's named places as `places`, with each one's slug, title and kind, and `mountWorkerView` takes `places` and an `onNavigate` that hears `{ record }` or `{ place }`. A followed link is the view's region's alone: the face around it does not also take it for a press on the card. A press bound to an act is the host's alone in the same way.
  
  Going somewhere means what the face says it means. `@graview/react` gains `useGoTo` and `GoToContext`. On the Graview face, going to a record focuses and chooses it, and going to a place draws it. The routed face provides its own: a record's page, and a place at `/places/<slug>`. `workerView` and `workerHome` use it, so a worker view's links work on both faces with nothing more from the app. The kit's `gv-link` keeps `links.origins`: it is the kit's one deliberate way out, to the origins a host lists, and an open-kit view has no such way.
  
  A unit test draws a view's links into a shadow root and follows them by a press and by Enter. A link to a record Lin may not see, a place the app does not have, an address, and the same asked from code each go nowhere, and the last three are counted dropped. `guest-sandbox --transport=place` adds a second worker view, "What we heard", and makes the package lens's offers links. On the pages face, an offer's link goes to that offer's page, and "See the packages", followed with Enter, goes to the package lens. The view's `<a href="https://…">` is drawn as text with no href and no role. On the Graview face the same link to the place draws it, and an offer's link focuses and chooses the offer. All seventeen claims hold in Chromium, WebKit and Firefox.
  
  Compatibility: the wire — additive: `navigate` may carry a `place` in place of `to`, and `GuestProps` gains an optional `places`. Ops, stored formats, check codes and tool schemas are unchanged.
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
- Updated dependencies [39a3983]
- Updated dependencies [7d77ff7]
- Updated dependencies [6b7edf9]
- Updated dependencies [cbe1cc6]
- Updated dependencies [4ae597b]
- Updated dependencies [f9d5951]
- Updated dependencies [c3e2c1d]
- Updated dependencies [77a9fdc]
- Updated dependencies [6809372]
- Updated dependencies [fff6319]
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
  - @graview/primitives@0.1.10
  - @graview/core@0.1.10
  - @graview/react@0.1.10
  - @graview/tools@0.1.10
  - @graview/layout@0.1.10

## 0.1.9

### Patch Changes

- 4e1d6e3: Every popover opens over everything, and everything else stands on one ladder (FR-76). On a hosted app the profile menu opened under the seat's rail and could not be read: each surface picked its own `z-index` in one stacking context, the profile and the problems 20, the rail 40, the altitude control 5, the zoom 8, a menu 60, the studio 100. Now the transient surfaces — the profile, the problems, the activity, the Find box's suggestions, the districts a row could not hold, a card's acts at the pointer, `ChatPanel`'s pill and the studio's own seat — are shown with `showPopover()` in the browser's top layer, which Playwright's Chromium, WebKit and Firefox all have: drawn over every rail, the scene and anything on a host's page, whatever `z-index`, `overflow: hidden` or `backdrop-filter` their ancestors carry, and still inside the element they opened in, so an embed's scoped theme reaches them and nothing lands on the host. In the top layer a pane is placed by what opened it (`useTopLayer` and `placePane` in `@graview/react`): under it, or over it where there is more room above, kept to the viewport, and no taller than the room it has, so what it holds scrolls inside it. Where `showPopover` is missing the pane stands on the ladder's popover rung. Everything that stays on screen takes a named rung from one ladder written once in `@graview/core` (`LAYERS`, `layer(name)`): scene, overview, rail, popover, dialog, toast, which `themeCss` writes on its root or an embed's box as `--graview-layer-<rung>`. The scene's ground is a stacking context of its own, so what orders its plots, cards, lines, figures and zoom (`SCENE_LAYERS`) can never climb over a rail. `POPOVERS` in `@graview/react` names every popover in the family with what opens it and its pane. A test reads every source file of every package and finds no `z-index` written as a number outside the ladder; `verify-chrome` opens every popover of the registry on the embed's Graview and pages faces and on the Shell, at 1440×900 and 390×844 with the seat open, and finds the pane in the top layer, inside the viewport, and under the browser's own `elementFromPoint` at its middle and at its last row. `capabilities().shipped` names FR-76.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-76`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
- Updated dependencies [0ecda3f]
- Updated dependencies [b5a4bfc]
- Updated dependencies [e811d26]
- Updated dependencies [d953bf9]
- Updated dependencies [4e1d6e3]
- Updated dependencies [7597e22]
- Updated dependencies [1aba73e]
- Updated dependencies [e4f7b67]
  - @graview/react@0.1.9
  - @graview/primitives@0.1.9
  - @graview/core@0.1.9
  - @graview/layout@0.1.9
  - @graview/tools@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies [afd37a3]
- Updated dependencies [0e6cccd]
- Updated dependencies [eed0b56]
- Updated dependencies [b12f49d]
  - @graview/core@0.1.8
  - @graview/layout@0.1.8
  - @graview/primitives@0.1.8
  - @graview/react@0.1.8
  - @graview/tools@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7
  - @graview/layout@0.1.7
  - @graview/primitives@0.1.7
  - @graview/react@0.1.7
  - @graview/tools@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/core@0.1.6
  - @graview/primitives@0.1.6
  - @graview/layout@0.1.6
  - @graview/react@0.1.6
  - @graview/tools@0.1.6

## 0.1.5

### Patch Changes

- 826e19b: A hosted page carries 536 KB up front, not 1,075 KB, and each face of the embed is fetched as it is first drawn (FR-57). Graview Cloud's shell — `openRemote` and the embed over a document compiled in the browser — loaded every face before the app drew: the scene, the companion, the inspector, the routed face and its router, the chat and the agent's tool surface, and every default view. The embed imported every face outright, and a bundler splits a page by which files its first chunk can reach: the frame took its provider from `@graview/react`, its theme from `@graview/primitives`, and the provider took the reader's rung from `@graview/tools`, and each of those reaches the rest of its package. Now the frame — the region, the theme, the strip, the provider — is what a page loads first, and the scene, the pages and the picture are each a chunk fetched as they are drawn, with the framework's own views beside them. The frame reaches only the narrow entries `@graview/react/provider` (the provider, hooks and view registry without the scene), `@graview/primitives/frame` (the theme, the strip's Profile and Standing, and the framework's views behind doors), `@graview/tools/frame` (the reader's rung, pins and editable fields without the agent) and `@graview/layout/view` (the view state without the city); the routed face reaches `@graview/primitives/pages` and fetches the companion when "Ask" is opened, and a district fetches its arrange row when it is opened full. `scripts/verify-hosted-page.mjs` (`pnpm hosted`, first in `pnpm verify`) builds Cloud's page the way Cloud does and holds it to 600 KB up front and 150 KB of zod; it also says what each face fetches as it draws, 770 KB in all before the scene draws and 729 KB before the pages do.
  
  CI's bundle budgets follow: the pages face alone is held to 530 KB (from 950 KB) and the embed without the studio to 780 KB first loaded (from 1.2 MB); every face, loaded whole, is 11 KB smaller minified and 2.5 KB larger gzipped, its chunks each gzipped alone, so its gzipped budget is raised from 373 KB to 380 KB.
  
  Compatibility: the embed — a change of shape. `mount` returns with the frame on the page and the face on its way: its box stands empty (`aria-busy`) until the face's chunk arrives, and `handle.drawn()` resolves once the face asked for is drawn, after `mount` and after `setFace`. `preload(...faces)`, a new export of `@graview/embed`, fetches faces before they are drawn, and an embed mounted once its face is here draws it in the first commit, as before; with no face named, every face. `onReady` is told when the first face is drawn, not at the frame's first commit, and the new `onDrawn` option each time a face is. The framework's own views in an embed's registry are doors that draw them once fetched (`frameworkViewDoors`, `registerFrameworkViews`, `fetchFrameworkViews`, new exports of `@graview/primitives`); a host's `views` function is handed them as before. `@graview/react/provider`, `@graview/primitives/frame`, `@graview/primitives/pages`, `@graview/tools/frame` and `@graview/layout/view` are new subpath exports — each also exported from its package's main entry — and a product that aliases the framework's packages (a linked project's vite config, which `graview create` writes) aliases them ahead of the bare names. `@graview/embed/pages` is unchanged and still draws in the first commit. Ops, stored formats, the wire, check codes and derived tool schemas are unchanged.
- Updated dependencies [f989024]
- Updated dependencies [97f2a0a]
- Updated dependencies [1e21d54]
- Updated dependencies [281761b]
- Updated dependencies [a83a311]
- Updated dependencies [f1fcf13]
- Updated dependencies [826e19b]
- Updated dependencies [e22a00d]
- Updated dependencies [5a2086e]
- Updated dependencies [6ff733b]
- Updated dependencies [76df9ba]
  - @graview/core@0.1.5
  - @graview/primitives@0.1.5
  - @graview/react@0.1.5
  - @graview/tools@0.1.5
  - @graview/layout@0.1.5

## 0.1.4

### Patch Changes

- 0183340: A tool's schema does not depend on zod's minor version. An agent tool's input schema is a stability surface, and zod writes its own regex for a string format — `z.email()`, `z.uuid()`, `z.iso.datetime()`, `z.iso.date()` — beside the format's name. That regex differs between zod 4.4.3, which this repository locked, and 4.6.5, which a consumer resolves from the published ranges, so Cloud's tool-schema snapshot saw sixteen "inputSchema changed" entries that were only zod's regex. `toJsonSchema`, and with it `mutationToolSchema`, `nodeJsonSchema`, `schemaJson` and the conformance kit's tools, now says a format string by its JSON-schema `format` alone (`email`, `uri`, `uuid`, `date-time`, `date` …) and drops zod's `pattern`; a pattern the author wrote with `.regex(…)` is kept, beside the format where there is one. Moving the workspace to zod 4.6.5 found a second dependence on zod's internals: zod 4.6 no longer fills a schema's `_zod.bag` as it builds it, so `describeArg` lost a number's bounds and a date's pattern, and a date argument was asked for as free text. It now reads the checks on the definition, which both versions keep. Every package's zod range is now `^4.6.5`, so the tests run on what a consumer gets.
  
  Compatibility: tool input schemas — a format-based string no longer carries zod's regex `pattern`, only its `format` (an `email` property is `{ "type": "string", "format": "email" }`); a `z.url()` property is unchanged, and an author-written pattern is kept. A snapshot of a tool surface taken with either zod version changes once, for those properties only, and then holds across zod minors. The conformance kit's recorded fixtures are unchanged: none declares a format string, and the lock holds. `describeArg` and `argShape` answer as they did on zod 4.4 for every schema, now on 4.6 too. Every package's `zod` dependency moves from `^4.4.3` to `^4.6.5` (products never install zod; `@graview/core` re-exports it). The embed's bundle budgets rise with zod 4.6, which gives every schema type its own JSON-schema processor: the pages face alone from 815,000 / 220,000 to 950,000 / 252,000 bytes and every face from 1,150,000 / 330,000 to 1,290,000 / 362,000 (minified / gzipped), about 130 kB / 30 kB of zod's that a host on zod 4.6 was already paying. The document format, ops, stored formats, the wire and check codes are unchanged.
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
  - @graview/react@0.1.4
  - @graview/primitives@0.1.4

## 0.1.3

### Patch Changes

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
  - @graview/primitives@0.1.3
  - @graview/layout@0.1.3
  - @graview/tools@0.1.3

## 0.1.2

### Patch Changes

- 7f354e0: A log a seat may not fully see is redacted, not gapped. `seenBy` used to leave out the ops that touched what a seat may not see, which left holes in the seq that `OperationLog.from` refuses, so a served store had no log it could send. Those ops now stay in place as withheld ops, `withheld: true`. A withheld op keeps its id, seq, batch, time and `undoes`. Its author is `WITHHELD_AUTHOR` ("Someone") and its intent is `WITHHELD_INTENT` ("A change you cannot see"). The mutation, inverse and batch intent are dropped. Its primitives, reads and writes keep only what the seat sees, so the seat's copy of a record it can see still moves. `redact(ops, sees)`, `withhold`, `touchesUnseen`, `touchedBy` and `isWithheld` do the redaction, and `logSeenBy(store, principal)` and `seesId(store, principal)` read it for one seat.
  
  A log with withheld ops loads, folds and undoes around them. `checkUndo` refuses to take back a withheld op and says only that it was "a change you cannot see". When a withheld op stands in the way, it says "a later change you cannot see depends on it", without its sentence, id or what it read, and offers no batches to bring along. `seenBy(...).canUndo` judges over the redacted log, and `Store.undo` judges a seat with sights that way first, so neither a refusal nor a 409 quotes a change the seat may not see. The activity rail shows a fully withheld batch as "A change you cannot see", with no author, nothing it touched and no undo. A record's page leaves withheld ops out of its history (FR-16).
  
  Compatibility: additive for ops: `Operation.withheld` is a new optional field, an op without it reads as before, and no store makes one for itself. Changed for readers of `seenBy(store, principal).log` and `.batches()` under a policy with `sees`: ops a seat may not see now come back withheld in their place rather than being left out. `checkUndo` now takes any `LogReading` (`all`, `undoneIds`, `epochs`), which an `OperationLog` still is. Stored formats are unchanged.
- 55f8b27: An embed holds inside a chat's widget. `mount` takes `height: "auto"` and `onIntrinsicHeight`, and tells the host the height it asks for as it changes: the strip and the whole page on the pages face, the strip and the picture's box on the others. It takes `hostContext: { theme }` over the page's own scheme, and `scheme: "auto"` now follows the host page's `data-theme` and the system's preference as they change rather than reading them once. `pagesBelow` gives the scene and the Graview way to the pages face below a width. `remote` takes a store from `openRemote` and its presence. `memory` keeps the reader's settings and the tab's session where the host says, and a frame whose `localStorage` and `sessionStorage` throw still mounts. The routed face no longer asks for a window's height when embedded, which grew a frame sized from its content without end.
  
  Presence speaks one dialect and forgets the gone. `participantKey` and `parseParticipant` name the `kind:id:session` format the op log, the figures and the wire share. What a presence channel reports is dropped once its last word is older than `REMOTE_PRESENCE_TTL_MS`, whether or not the channel says the person left. A people directory (`people` on `mount`, `GraviewProvider` and the pages' context, `Person` in core) names authors in the rail, the pages, the profile and presence without offering anybody a seat, so a hosted reader sees no seat switcher and no "Sit as somebody else"; `nameOfAuthor` reads it after the seats. The handle gains `setPeople`, `setSeats` and `setHostContext` (FR-13).
  
  Compatibility: additive for the wire — `participantKey` writes the key the served store already wrote, and `openRemote` keeps the TTL it had, now named `REMOTE_PRESENCE_TTL_MS`. `EmbedOptions` gains optional `people`, `hostContext`, `remote`, `memory`, `presenceTtlMs`, `onIntrinsicHeight` and `pagesBelow`, and `EmbedHandle` gains `setPeople`, `setSeats` and `setHostContext`, which a host implementing the handle itself must now provide. Changed in meaning: an embed with `scheme: "auto"` follows the host's scheme after mount, and a figure's own name in presence is the one `nameOfAuthor` gives (a seat's label, a directory's name, `Principal.name`) where it was the principal's id. Ops, stored formats, the declaration and derived tools are unchanged.
- The pages alone draw the app's views, and a view that throws on a page says so in its own place. `@graview/embed/pages` takes `views(schema, registry)` as `mount` does. Its pages draw from the same registry: the framework's defaults, the declaration's view specs, then the host's own (FR-35 on the pages-only entry). The pages face of `mount` gets the registry, the app's settings and presence through the same `PagesContent`. `mount` takes `heading` (FR-25) beside the frame options. On the pages, a lens or a kind's own group view that throws draws behind a `ViewBoundary`, as it does in the scene. The rest of the page keeps working, and the host's `onError` hears of it (FR-24).
  
  The pages-only bundle's budget is raised from 765 kB to 815 kB minified, and from 205 kB to 220 kB gzipped. The growth is the default views and view specs the pages now draw from: about 48 kB minified and 15.5 kB gzipped.
  
  Compatibility: additive — `views` moves from `EmbedOptions` to `FrameOptions`, so both entries take it. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
- 570f9e2: A view registered once is drawn on every face, over the defaults rather than instead of them.
  
  - **The embed hands its views to the routed face.** `mount({ views })` used to build the pages face without the registry. A registered view was drawn in the workbench and never on a phone. The pages face now gets the same registry, with the app's settings and presence, so the gallery's card is the registered one × summary. The record page draws the kind's own one × full view under its heading (FR-35).
  - **Registering one view keeps the rest.** `views(schema, registry)` is handed a registry that already holds the framework's own view for every cell and the declaration's view specs. A function that builds a registry of its own is laid over those same defaults (`layerViews`), so one card no longer costs every other view. `<DefaultView {...props} />` draws the framework's own view for a cell inside a view of your own. On the record page, which is the default record, it draws nothing (`DefaultViewElsewhere`). `ViewRegistry.registrations()` lists every registration in the order it was made (FR-36).
  - **A member drawn as a row is a cell a view can claim.** When a kind has a one × glyph view of its own, as a component or a spec's `row`, two places draw it. A focused group draws each member as that line, each a target for its record. The list page draws each record as that line, with the whole line as the link (FR-37).
  
  The framework's own one-cell views are now marked as defaults (`isDefaultView`), the way its group views were, so a surface can tell them from an app's.
  
  Compatibility: the declaration — additive: `ViewRegistry.registrations()` and `ViewRegistration.across` are new, and a registry that implements the interface by hand needs the method. `EmbedOptions.views` is now called with a second argument, the registry to register onto. A function that ignores it still works, and is laid over the defaults instead of replacing them. Ops, formats, the wire and tools are unchanged.
- Updated dependencies [3afdd09]
- Updated dependencies [f36ccfc]
- Updated dependencies [346fbe3]
- Updated dependencies [b910210]
- Updated dependencies [7f354e0]
- Updated dependencies [74c9388]
- Updated dependencies [a7fc818]
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
- Updated dependencies [c74b21f]
- Updated dependencies [984c96f]
- Updated dependencies [b71e7c5]
- Updated dependencies [2493564]
- Updated dependencies [c5c1c91]
- Updated dependencies [346fbe3]
- Updated dependencies [b334c25]
- Updated dependencies [afcb06d]
- Updated dependencies [9680187]
- Updated dependencies [570f9e2]
- Updated dependencies [6460336]
  - @graview/core@0.1.2
  - @graview/primitives@0.1.2
  - @graview/tools@0.1.2
  - @graview/react@0.1.2
  - @graview/layout@0.1.2

## 0.1.1

### Patch Changes

- e1b9f5c: A form asks in the record's words. An argument that fills a field of the kind its act makes or acts on is labelled as that field ("VIN", "Body style"), its choices are said as the record says them ("SUV", "Plug-in hybrid"), and an argument called `label` is asked for as a "Name" — on the routed face's forms and in the scene's ask alike (`argumentWords`). A refused argument is said field by field in the same words — "Not yet: Email — invalid email address." — rather than as `Invalid arguments for mutation "sign-up" email: …` (`failureWords`, `InvalidArguments`). The watch is told a declaration's choice values, and the key's own words wherever the declaration has others.
- 097d684: A count of one says the kind's noun: "1 car", "1 test drive", where a place card, Find, a district's name, a band of a district and a coverage's gaps said "1 vehicle" and "1 test-drive". One function says it now (`counted`).
- 866d437: A list page's rows keep to the page and let a long unbroken value break: the list of shoppers, each with an email, scrolled sideways on a phone at a reader's 200%.
- a1859c5: A form sends a list nobody added to as an empty list (`formArgs`). "Put a car on sale" with no features listed was refused on press, "Features — expected array, received undefined", for a car the declaration allows.
- fa8bd61: A list page's "Related:" names each relation in its own words from that end — "The test drives booked in it", linked to the test drives — rather than the edge's name ("Drives Test drives"), and a list of one says the kind's noun ("1 car"). The watch is told an edge's spoken name wherever the edge has words of its own.
- d76a957: A policy says who may see what, as well as who may do it. `Policy.sees` keeps a kind to the roles a sight names — with `own`, to the principal's own record and what an edge joins to it — and a kind no sight names stays everybody's. `store.seenBy(principal)` is the store as that principal may see it: its graph, log, history and problems hold only what they may see, and every act still goes to the store itself; with no `sees` it is the store, unchanged. The scene's provider and the routed face hand every surface that view, a kind a seat sees none of and may not begin is kept from it like an administered module, and the way in leaves it out. `graview check` refuses a sight naming an undeclared kind (`sight-unknown-kind`). A watching harness is told what the seat may not see (`tellTheWatchWhatIsUnseen`, `useTheWatchKnowsWhatIsUnseen`).
- f1cf758: The map of the kinds marks each relation's name as said on purpose (`data-graview-speaks-ids`) — it names the declaration's relations, and their words follow — and the watch no longer counts a choice value's spoken form ("Mon") as a key's words, which a calendar prints as an ordinary weekday.
- 313eea3: Two kinds that name a picture alike each have their own page: "The timetable" over talks and over workshops are no longer one address and one key, so the workshops' timetable is reachable on the routed face and React is not handed two children called the same. A shared name says whose with `?of=<plural>`; `pathOfPlace` gives an app's own page the right link.
- Updated dependencies [bf36bbe]
- Updated dependencies [ed02370]
- Updated dependencies [e0c8cac]
- Updated dependencies [e1b9f5c]
- Updated dependencies [cbdd94a]
- Updated dependencies [097d684]
- Updated dependencies [e88f729]
- Updated dependencies [a1859c5]
- Updated dependencies [1df48c8]
- Updated dependencies [ccfe1cd]
- Updated dependencies [c307981]
- Updated dependencies [fa8bd61]
- Updated dependencies [32ea5ac]
- Updated dependencies [d76a957]
- Updated dependencies [c222b58]
- Updated dependencies [deb98ca]
- Updated dependencies [b535cb2]
- Updated dependencies [6b297f0]
- Updated dependencies [414ddde]
- Updated dependencies [a575ca9]
- Updated dependencies [3c0d822]
- Updated dependencies [f1cf758]
- Updated dependencies [b9cdc16]
- Updated dependencies [6966a4e]
- Updated dependencies [0b78acc]
  - @graview/react@0.1.1
  - @graview/primitives@0.1.1
  - @graview/core@0.1.1
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

- 400a6df: A fact on a chip says what it is. `readableFields` gives every field an `alone` reading — a word as itself, a number with its label ("Track 8", "Length 4:27"), a yes/no as "Explicit: yes" — and the default summary card, the pages' gallery and the list lines all use it. A song's card used to read "8 · 4:27 · Yes".
- dfbba3f: A figure is handed to the DOM once, and it fits the card it is drawn on.
  
  React 19 decides whether to re-apply `dangerouslySetInnerHTML` by comparing the prop object to the last one by identity, so the inline `{{ __html: art }}` every call site wrote tore the art out and parsed it again on every render — thirty-four times for a single click on the ground. The wasted parsing was the smaller half: a double-click only pairs if both clicks land on the same node, and the re-render the first click caused had already replaced it, so double-clicking a district on its figure selected the card and went nowhere while double-clicking the same card an inch to the left travelled into it. A new `useMarkup` hook holds the object still, and the brand's logo goes through it too.
  
  The figure also moves from its own row to the name's line. On the ground a district card is a glyph — seventy pixels holding a name, a count, a trouble mark and a control — and a drawing above the name pushed the content past the card's own edge on every card in the strip, clipped rather than visibly broken, which is why only a measurement caught it.
- 8bdbe72: A form asks the question the act left open. `DerivedForm`'s node picker listed every node of the kind, ignoring the candidates the affordance had already narrowed — so a record's own "depends on" offered the record itself, and an act that hands something on offered whoever already had it. The derived record page now passes `affordance.open` through; a form with no act behind it (a rule's repair, a list page's creating act) still offers every node of the kind, which is the honest answer there.
- 3f86b09: A glance does not say its heading again, word by word. A card's summary and a list line dropped a value only when it was the whole heading, so a vehicle headed "2027 Subaru Forester Sport" — its label built from its year, make and model — spent two of its three facts on "Year 2027" and "Subaru" and never reached the price. `readableFields(..., { glance: true })` drops a value the heading carries as whole words; a record's full facts keep every field, because that is where each one is changed.
- 1ebfd44: A kind has a figure. `defineNode(kind, { figure })` takes inline SVG — one `viewBox`, `currentColor` strokes, no fill — or the name of one from a small shipped set (person, plot, box, task, shift, list, vehicle, rule, note), and a brand may override any kind's. One `<KindFigure>` draws it everywhere a kind is drawn: the kind card at altitude, the district beside its plural, the routed face's rails and record eyebrows. A kind without one is drawn exactly as before; nothing about a figure is required.
  
  `graview check` refuses a figure that cannot be drawn — no `viewBox` (nothing can size it), a literal colour (invisible in one of the two schemes), nothing stroked with `currentColor` (it will not take the kind's ink), or a name nothing ships — and refuses a brand drawing for a kind the app does not declare. `drawFigure` in `@graview/tools` asks a model for one in the house style and judges the answer with the same function, so a drawing that would fail the build never reaches a person as a proposal; a model that throws or draws badly falls back to the nearest shipped figure BY NAME and says so, because guessing that a cleat is a box would be the framework having an opinion about a domain it has never met. `graview figure <entry> --kind <k>` prints the line to paste.
- a23e496: A kind can say what one of it is called. `defineNode("staff", { plural: "Staff", noun: "staff member" })`: a kind whose id is a mass noun — staff, equipment, inventory — had only its id for a singular, so every sentence about one read "Change the staff", "Remove the staff", "a staff called …". `nounOf(definition, kind)` is the declared noun or the id spoken, and the derived edit and remove acts, the strip's "nothing you may do with …", the routed face's pickers and search, the chat's facts and derived questions all read it. The studio carries it through the round trip and writes it back, and graview-node-kind says when to declare it.
- e165c5b: A titled group view is a place. `register(kind, cell, view, { title })` names it; `views.places()` lists the names; the shell's bar and the embed strip show them as pills, pressed while you are there, so a lens is somewhere to go by name rather than a picture that vanished when you clicked into a member. And the list page withholds a creating act the seat may not take — struck through, with the policy's own reason — instead of offering a form that refuses on submit.
- c3879ba: A picker on the routed face is never wider than its field. A select is as wide as its longest option, and a form's picker over a real inventory — "Open a deal", over 320 vehicles named like "2027 Mercedes-Benz GLE AMG 53 4MATIC+ Coupe" — was 618 pixels on a 390-pixel phone, so the place page scrolled sideways. The form's controls shrink to their track and cut an option inside the box.
- cc3ddbc: `rankedRepairs` is exported, so a design can order a rule's repairs by the same derivation the strip reads rather than by the order the rule listed them.
- 190c4a8: A record's ties tell two of one name apart, and the scaffold's own record page shows the record. `recordFacts` gives each tie target an `apart` — what tells it from another of the same name in its group — and the derived record page says it beside the link, so a vehicle's two "Check engine light on" appointments are two things. The record page `graview create` writes now lists the record's facts, which it had dropped (a one-kind scaffold has only a name, so the gap was invisible until the kind grew a price), and makes each tie a link rather than a comma-joined line of names.
- 63ba472: A relation is captioned from the end you are standing on. A record page's connections section put the edge kind over the reading — so an owner's record said "Assigned to" above "What they are seeing to", which is exactly the backwards reading `graview check` warns about, and where a declaration had no words for that direction the two lines were the same string twice. The eyebrow says what is listed now — the far end's kinds, in their own plurals — which is true from either end.
- fadebb9: A repair on the routed face asks for what it left open and nothing else. `DerivedForm` takes `only`, and `Repairs` passes the repair's `missing`, so "Correct when Kerosene came out" asks for the date rather than every field of the edit act (the name first — a date typed there renamed the single). The form submits under the repair's own words and, once answered, gives the keyboard back to the repair's button or to the page's heading.
- f801b4d: A repair is an act, and a seat may not be able to take it. Both repair surfaces rendered a rule's repairs straight from the violation, without asking the store whether this principal may run them — so a narrower seat was handed a live button and met the refusal on submit, while the actions strip beside it had already struck the same act through. `Repairs` takes the principal now and withholds what it must, with the policy's own sentence.
- 8e872b5: A repair with a blank in it is an ask. The problems page and the record page rendered every repair a rule named as a bare button applying the violation's own arguments, so a repair declaring `missing: ["owner"]` threw "expected string, received undefined" into the console and told the person nothing. Both surfaces — and the scaffolder's record-page template — now use one exported `Repairs` component: one press when the repair needs nothing, the derived form when it still has something to choose, and a refusal said where the press happened.
- c3033f4: The search page fits a phone at twice the text. Each group of hits is a grid track the width it was given and a hit's name may break: two records of one name told apart by a seventeen-character VIN made a hit 503 pixels wide at a reader's 200% on a 390 phone, and the page scrolled sideways.
- 2cc27e9: Another seat's work is named by the seat's name. `nameOfAuthor(author, { graph, schema, seats })` reads the user node, else the seat the principal was offered under, else the id; the activity rail, the profile, and the routed face's history use it, and `PageContext` carries `seats` (the embed hands its own over). An app with seats and no installation read "user-lena" and "U user-june".
- 490eccd: A design's shell registers without a cast. `surface("shell", Shell)` takes a `ShellComponent<S>` — `{ context, children }`, as the pages skill describes it — rather than a page's type, which has no children and made every design write `Shell as PageComponent<S>`.
- e809183: An embed's stop may name a place. `#view=the-season` is the link a page can write — `placeHref` spells it — and the scene's URL sync has resolved it to the group the place is a picture of since it existed; the embed read its `stop` through `fromUrl` alone, so a host page saying `data-stop="#view=the-season"` landed at the default view with the place's pill unpressed. The embed resolves it now, on mount and when the stop changes through the handle.
  
  A board in a room with no height of its own is sized by its width. The board lens drove its size from the measured height of the room it stood in, which a scene band and a page region have; in a chapter embed on the docs site the panel sits in a column as tall as its content, so the room measured four pixels, the board came out six by four, and every slot on it was a four-pixel target. Below a height a board could be read at, it takes the room's width and lets its aspect give the height, which is what a board in a document is.
  
  The embed has a fourth face, `picture`: one named lens and nothing else — the place the stop names, drawn at full size over the kind's current members, with no bar, no rail and no standing. A page that is about a lens shows the lens, not an app with the lens somewhere inside it; three of those stacked on the docs site's lenses section were three windows with a calendar somewhere in each. `PlacePicture` in `@graview/pages` is the component behind it, for an app's own page that wants the same.
  
  The calendar's day grid and agenda list are keyboard stops. Given less height than their rows they scroll inside themselves, and a region that scrolls with no focusable element in it is one a keyboard cannot scroll at all; each carries the span's own name.
- b9b0635: A time of day is asked for. An argument whose pattern is a date with a time in it (`YYYY-MM-DDTHH:MM`, the gauntlet's workshop start and a talk's slot) described itself as a plain date, so every face offered a date picker, the picker gave `2026-09-20`, and the act's own pattern refused it: no workshop could be made and no talk given a slot, on either face, at either width, with either hand. The date shape and its form field now carry `time: true` for such a pattern; the routed form, the scene's ask, the edit in place and the studio's agent panel ask with a date-and-time control, and the conversation and the starter fill one with a time of day.
- 2c25067: Casts the compiler did not need are gone: 163 lines of `as never` and 52 `as unknown as` narrowed to a single cast, each removed only where the whole monorepo still type-checks without it. What is left is where the types genuinely cannot say it.
- f4dbcc8: Every key typed into the pages' Find box arrives. The box wrote each keystroke to the address and took the address back, and an address that caught up after the next key was taken for a change and written over the box — typed at full speed, "pay the deposit now" became "pyte depoi now", and on a slow runner "digital" was searched as "dgtl". Words the box handed to the address are its own echo; it follows the address only when something else changed it.
- 7a61e87: A condition that names a retired state asks for the past. `status:demo`, where demos are behind the horizon, found nothing in the Find box and listed nothing on the list page, while telling the reader to add `is:any`. `asksForThePast(definition, conditions)` says when a condition names one of the lifecycle's retired values, and both `search` and the list page widen that kind's horizon for it.
- 0c465b9: A record does not offer to sort and filter a relation that holds one thing by declaration. A deal's record read "Sort and filter who is buying →" under its one buyer, and a vehicle's "Sort and filter the lot it is parked on →" under its one lot — a link to a list that can only ever hold the name above it. An edge declared `cardinality: "one"` offers the pile only from its far end, where it may be many.
- a9381af: One control row arranges every surface. `ArrangeBar` in `@graview/primitives` draws Sort by (with a direction), Group by (with a bucket for a date), the conditions as chips with one grouped select to add another, and the words a person types — all from `arrangeable()`, so it offers only what the kind's declaration offers, in the declaration's words; a surface hands the current arrangement in and takes the next one back, and declines a part with `allow`. `arrangementOf(view)` and `withArrangement(view, next)` carry it in a stop as `in.sort`, `in.filter`, `in.group` and `in.q`. The arrangement grammar gains `q`: words a node's label or any scalar field must contain, the same matcher a search would use (`matches`).
  
  The pages list page arranges through the shared module under the shared keys — `?sort=due:desc`, `?filter=done:false,holds:today`, `?group=due:month`, `?q=tape` — and keeps every link it used to write: `?by=<edge>` groups, `?<edge>=<id>` and `?with=<edge>` narrow, `?past=1` widens the horizon. A stale link that asks for something the kind cannot be arranged by is told so and shown the rest. The kind's default picture in the scene draws the same row at full fidelity and groups its members when asked, with the choice in the fragment so an arranged district is a link and Back restores it.
- 3815bcf: Relationships are structure on the routed face. `kindMap(store)` derives every declared relation between the kinds with its own words and its live count, and the face draws it as "How it fits together" on the home page and at `/map`, each line with the same mark the scene's key draws (`RelationMark`, now exported from primitives and usable without a scene), each count opening the far kind's list narrowed to the ones that have the relation. A kind's page says what it relates to, groups by a relation from the address (`?by=<edge>`) and narrows by one (`?<edge>=<id>`, `?with=<edge>`), so a list you arranged is a link you can send. A record links the other way round — the far kind's list narrowed to itself — and says which pictures it is seen in, each a page and a stop in the scene.
- 216ba97: The assistant is on every page, and it is the same one. A routed face that grew a chat box of its own would be two assistants with two habits over one graph, so the pages face opens the scene's companion: one control in the corner, a drawer beside the reading column, the same subject header, acts, relations and conversation. The route is what "this" means — a record page is about that record, a kind's page about that kind, a picture about the kind it is a picture of — set as the provider's selection, so a question means the same thing on both faces. Grounded questions are offered before anybody types (`offer` on `ChatPanel`, also in the scene's rail), answered by the graph's own responder with no model at all. A proposal applies through the same runtime, attributed to chat and undoable, and one the policy withholds is struck through with its own sentence. The seat's open questions are listed on the problems page, which is the face's inbox, and the intelligence rung is chosen from the footer. The control is mounted by the router rather than the default shell, so an app that replaced every surface with a design of its own still has the assistant.
- 6e0fbb7: A form opened for an act offered from the far end of a tie submits under the words its heading uses. `DerivedForm` takes `label`, and the derived record page, the places page and the record page `graview create` writes hand it the affordance's label — a song's page headed "Place it in an era" had a button saying "Put it in the era", the era's side of the act.
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
- b7fa5e3: The menu leads with the thing you clicked. `deriveAffordances` takes a `focus` — the node the gesture landed on — and ranks by it: that node's own repairs first, in the order the rule listed them, then its own acts (settled before asking), then everything the rest of the selection offers. Until now a rule that implicated five late tasks in ONE violation offered its ten repairs in whatever order it walked its subjects, so right-clicking the fourth task met the first task's repair at the top and the obvious press fixed somebody else's problem. Which node an act is FOR is read off the mutation's own `nodeRef` arguments rather than the violation's cast list, so "a new date for Book the hall" is Book the hall's repair wherever it came from. Every surface reads one rank, now stamped on each affordance as `rank`: the pointer menu (which names what it was opened on), the actions strip (whose focus is the last thing selected), and the routed record, where a rule's repairs are ordered by `rankedRepairs` instead of as declared. The destructive tail is unmoved, and a derivation with no focus ranks exactly as it did before there was one.
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
- e30d22f: The pages face is nine files, cut where its own section banners cut it — the context, the typography, the shell, the map, the places, the home, the list, the record, the problems — with `pages.tsx` saying what they are and re-exporting them; the page frame (`PageMain`) lives with the shell rather than with the problems page it happened to be written beside. Nothing it exports changed.
- fc7103b: The pages face lands on a gallery. The derived home read as a readme: the brand's name repeated under the masthead, a sentence of counts, the relations in full, a section per kind with its description and four members — and the app's own pictures as two 288-pixel cards a third of the way down a 760-pixel column, the smallest thing on the page. Now the standing is the headline ("2 gardeners, 3 plots and 1 planting.", or "Nothing here yet." and which act begins it) and the pictures come next, large and live: every titled lens as a card the width of half a desk or a whole phone, drawn by the lens itself at a scale measured from the card, inert, captioned with its name and how much it is over. The kinds follow as one row of counts, the relations as one line that opens `/map`, and Recently stays short at the foot.
  
  Every kind is a picture by default. `registerDefaultViews` titles nothing, so a new app had no places and no pictures on its pages at all. A live kind with no titled lens now gets a card of its own — a group view the app wrote is drawn as it is; the framework's own is replaced by a contact sheet of the members at summary fidelity, the same card the scene stands in the district — titled by its plural and opening its list. Titling a lens replaces the kind's card rather than adding to it. A picture with nothing in it says so and names the act that would begin it, rather than showing a blank frame. Given no view registry the face still lands on the gallery, each kind a card of its members' names.
  
  The shell is one row — the pictures (home), the kinds, Map, Problems — and scrolls sideways on a phone rather than wrapping to three rows; the shell and the gallery take a 1160px column while the pages that are read keep their 760. A picture's page carries its sibling pictures as a strip, and `/places` is the same gallery at its own address. `Gallery`, `GalleryCard` and `galleryOf` are exported for a design that wants the cards on a page of its own.
  
  `graview create` hands `PagesApp` the app's views and settings in the `main.tsx` it writes, so a new project's pages face has its pictures, its map and its assistant without anyone editing the file. The `graview-pages` skill says what now comes for free; `verify-pages` measures the gallery on the framework's default face — two across at a desk, one on a phone, every frame with something drawn in it, the nav one row — rather than asserting it.
  
  A new page opens at its top. The router kept the document where it was, so a card pressed at the foot of the gallery opened the picture's page already scrolled to its own foot; the readme-shaped home was short enough to hide it. The face now resets on every new address — not on Back, which the browser restores itself, and not on a change of search alone, which is the page you are on — scrolling whatever holds it: the window, or the nearest ancestor that scrolls when the face is inside an embed's frame.
- 591a15a: The app's pictures are pages. Given the view registry in its context (`views`, with `settings` and `presence` where the app has them), the routed face puts the scene's provider under its routes and every named lens becomes a page: an index at `/places` draws each lens small and live, inert, with its name and what it is a picture of; each lens at `/places/<as>` is drawn full width in fullscreen mode over the kind's current members, with the acts that begin the kind beneath it and the way to the same picture in the scene; a pick inside it travels to the record. The home leads with the pictures, a kind's page lists its own by name, and the shell's nav mirrors the scene's bar — pictures, then kinds, then Problems. Without views the face is the derived site it always was. `placePath(as)` gives a place's routed address.
- d22655e: An act answered on a record gives the keyboard back to the act. The derived record page opens an act's form in place and closes it once the act is applied, which took the keyboard to `<body>`; it now returns to the button that opened the form, or, when the act is no longer offered, to the "What can be done" heading.
- a38a5af: The routed face offers Find and the way back, whichever shell draws it. Taking the last change back could not be done on the pages of any app — nothing on a page offered it — and rota's pages had no Find box, because only the derived shell drew one and every design replaces the shell. The face's root now owns both: a shell that places `<PageFind>` or the new `<PageUndo>` says where they go, a shell that places neither gets Find in a bar above it and the way back docked at the corner, and only `surface("shell", Shell, { without: ["find" | "undo"] })` goes without. The way back says what it takes back ("Take back “Rename to …”"), takes back the person's own latest change as that person — never one the policy would refuse — answers ⌘Z and Ctrl+Z anywhere on the face but inside a text field, where they stay the field's own, and lands the keyboard on the page's heading when there is nothing left to take back.
- e7151d4: The type scale goes up a step. The framework's own text ran from 9px to 12.5px at a 16px root — a scale built around a 12.5px body, which a person reading a product for an hour called small, and which was small. Body text is 14px now, small text 13, marks and captions 12, the smallest label 11, and headings a notch up with them. The cards the layout sizes in the reader's own unit follow: a district's floor is 148px rather than 132 so "COMPONENTS" in 14px capitals holds one line, the districts' row is a little taller, and a focused card may take 1200px of a wide screen rather than 1040. The companion and the quick relations keep to the rail's share of a narrow scene rather than standing over the picture at 1000px.
- 1eedcff: A record's link to the far kind's list says what it lists in this end's words — "Sort and filter the songs on it" — instead of the edge's name read as a verb, which gave "All artists by Blue Hour" and "All songs tracks Blue Hour" on an album's page.
- ccaa5f4: Search reaches the pages face and the conversation. `/search?q=` lists what the words find grouped by kind, each hit with its why and each kind's heading a link to its list with the words carried; words that find nothing say what was searched ("current ones; add is:any for past ones") and offer the beginnings the seat may run, "A task called “zzz”", with the words already in the name (`beginningsFor`, `SearchToCreate`, and `DerivedForm`'s new `initial` — starting values that stay editable). The derived shell's nav carries the box, `PageFind`: on a kind's list it narrows that list, elsewhere it goes to `/search`, typing replaces rather than pushes; an app's own shell can use it, with `narrowsLists: false` when its lists have a box of their own. The list page reads its words with the shared matcher — `key:value` tokens and `is:any` included — shows why a row is there when it was not the name, and under the derived shell drops the row's second box. `/search` is a derived route an app's own `route()` is warned off. A message the conversation reads as no act and no fact, whose words find records, is answered with them as `picks`, each a press in the chat that goes there. The activity rail shows the records a read looked at, so an agent's `search_graph` says what it found.
- 95196d7: Two records of one name are told apart wherever a person picks one. `tellApart(nodes, definitionOf)` gives each namesake the first fact that differs — "Blue Hour · single", "Blue Hour · album" — and the pages form's pickers, the strip's ask, the Find strip, the search page (through a node hit's new `apart`) and an arrangement's group headings all say it. A single and its album were two identical rows.
- 55c4151: The compiler says when code is unused (`noUnusedLocals`, `noUnusedParameters`), and what it found is gone. `Occupants` draws the others and nothing else: its props are `width` and `whereIs`, the walking seat's pad, reach and pointer plumbing removed. `SceneProps`, `ResolvedViewProps` and `DoorProps` lose a type parameter nothing read, and `placeOthers` a `height` it never used. One `violationKey`, exported from `@graview/core` (no longer from `@graview/react`); one zod `unwrap` in core; the structure and invariant providers name a node the way its kind does, through core's `labelOf`, rather than by its `label` field alone.
- 5b401bb: What the review of search found. A boolean field is a state, asked for as a condition (`done:false`), not a word: it read as "No", so "n" found every open task in the Find box, a list's `?q=` and the chat — `searchableFields`, `describe` and `llms.txt` no longer list booleans. The picture lights every match from the result's new `matched` list rather than the strip's capped hits. A list's `q` made only of tokens nothing offers (a pasted `https://…`) finds nothing, as the Find box does, and a lone `is:flagged`, `is:clear` or `is:past` narrows in both. `actsOn(store, id, words)` lists a record's acts without a search of the graph; `search()` takes `touched`, and the scene works out what is flagged and touched once per graph change, not per keystroke; a list parses its words once rather than once per row. A lit district's count, Enter on a kind hit and a double-click are one transition — `withJackIn(…, { carry })` — which comes down to the ground, close and narrowed. The row's words (`in.q`) no longer follow you to the next focus, and `withoutSearch` clears the search with the words it carried. A pick in the pages face's Ask drawer goes to the record's page (`onPick` on `ChatPanel` and `Companion`), and the list page reuses the affordances it already has for search-to-create.
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
- Updated dependencies [fb5b3ad]
- Updated dependencies [923bbfa]
- Updated dependencies [e695209]
- Updated dependencies [ccc912a]
- Updated dependencies [7c0e701]
- Updated dependencies [73e3b86]
- Updated dependencies [190c4a8]
- Updated dependencies [e59fa1f]
- Updated dependencies [69aed60]
- Updated dependencies [d042ff2]
- Updated dependencies [f801b4d]
- Updated dependencies [8e872b5]
- Updated dependencies [708871a]
- Updated dependencies [c5e4ac7]
- Updated dependencies [42c2c96]
- Updated dependencies [9a3fe4b]
- Updated dependencies [2cc27e9]
- Updated dependencies [b90b6c7]
- Updated dependencies [a5d4967]
- Updated dependencies [97067b6]
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
- Updated dependencies [796bf9e]
- Updated dependencies [a6f64b0]
- Updated dependencies [d907771]
- Updated dependencies [0bb6827]
- Updated dependencies [b5e95a1]
- Updated dependencies [894f0f1]
- Updated dependencies [130e9c6]
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
- Updated dependencies [2b2df36]
- Updated dependencies [a9381af]
- Updated dependencies [d9bfdb8]
- Updated dependencies [8976510]
- Updated dependencies [d5227b5]
- Updated dependencies [0c320d9]
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
- Updated dependencies [fc7103b]
- Updated dependencies [9767a5e]
- Updated dependencies [8dbae9a]
- Updated dependencies [7840cd5]
- Updated dependencies [e9e495f]
- Updated dependencies [636a00d]
- Updated dependencies [0a6a3fe]
- Updated dependencies [a0ffc2f]
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
- Updated dependencies [f8f0e29]
- Updated dependencies [3506c69]
- Updated dependencies [daccd55]
- Updated dependencies [be9fb19]
- Updated dependencies [e7151d4]
- Updated dependencies [ce13ec8]
- Updated dependencies [e7735c1]
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
  - @graview/tools@0.1.0

## 0.0.1

### Patch Changes

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
- 329da2e: The pages face reads like a product's own site, not a back office. The
  default shell, home, list, record and problems pages open with the thing
  itself — the installation's name and mark on a masthead, a front page that
  summarises what is here in the app's own declared words, lists whose
  members carry a line of their own facts, records titled in the display
  face with the kind's own description as the lede, relations captioned by
  the edge's declared words (an inbound edge by its `inverse`), and actions,
  forms and history receding beneath the content. Typography rides the
  brand's display and body faces at a real scale in both schemes; a kind's
  accent marks it on every page. `hueFor` — the hue thread every surface
  reads — now lives in `@graview/core` beside the brand that overrides it,
  re-exported by `@graview/render` unchanged. Every testid, route and
  parity derivation is as before.
- Updated dependencies [ec91236]
- Updated dependencies [37bb6af]
- Updated dependencies [e38fe86]
- Updated dependencies [964d140]
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
