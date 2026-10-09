# @graview/embed

## 0.1.19

### Patch Changes

- 46f2ac8: Small truths after the cleanup. A record described by `describePlace` is at the address the routed face gives it. It was `/deliverable/a b`, an address no page answers; it is now `/deliverables/a%20b`. A seat handed a face's store and views lists the places the declaration does. It now orders the pictures as the arrangement does and calls the scene what the bar calls it, where before it said "Scene" whatever the app named it. `placesOf` and `placesFromViews` are one builder now, and a test holds them equal on every example app. A model's tool for an act is titled what the actions strip and the seat call it: "Mark done", not "MarkDone".
  
  A kind that declares no plural is called by one rule everywhere: its name in words and an "s", split as `humanizeField` splits a name, so `shelfItem` is "shelf items". Standing alone as a label (a heading, a hit, a group's name, a button or link that starts with it) it starts with a capital: "Tasks", "Shelf items". Inside a sentence it does not: "Turn off tasks". Its address keeps the name as written (`/shelfitems`). The relation key, seeding, the trail, the road map, the module switch, the band's groups, edge signs, the columns lens and Find had each said the bare kind or a humanized one. Keeping a lens, `graview describe` and Find give a place's address with one rule, adding `?of=` where two kinds share a name. The relation key drawn on its own is as wide as the Key's pane, where it was capped against a left rail the scene no longer reserves.
  
  The keyboard always lands somewhere in Firefox and Safari on macOS too. Those browsers do not focus a button when it is clicked, so pressing Keep on a drawn view took the keyboard off the seat's field without giving it to Keep, and Keep was then taken away with its frame: the keyboard was left on the page's body. A press on a control while the keyboard is nowhere now counts as where it stood. The same rule reads its root's own document and asks nothing once that window is closed, so a timer it set just before a page was torn down no longer reads a document that is gone.
  
  Compatibility: ops, stored formats, the wire, the document format, check's finding codes and tool names are unchanged. New in `@graview/core`: `pluralOf`, `pluralLabel`, `actTitle`, `kindPath`, `recordPath`, `placePath`, `sharesItsName` and `placesFrom`. `@graview/layout`'s internal `pluralOf` and `@graview/pages`' `pluralSlug`, `recordPath` and `placePath` now call them, with the same results. Changed:
  - `describePlace(…).place.address` for a record is `/<plural slug>/<encoded id>`, not `/<kind>/<id>`.
  - `placesFromViews` returns places in `placesOf`'s order, and takes `pages` (the arrangement), from which it names the scene with `sceneTitle`.
  - A tool's `title` and `annotations.title` for an untitled act is `humanizeField(name)` ("Mark done"). It was the name with only `-` and `_` spaced ("MarkDone").
  - For a kind with no declared plural:
    - Inside a sentence it is now "tasks" where the bare kind was said: the module switch says "Turn off tasks", not "Turn off task".
    - As a label it is "Tasks": `kindMap(…).kinds[].plural`, `placesOf(…)`'s kind titles, the routed face's titles and links, the relation key's ends, seeding's plan, the context menu's subject, the way back up, the trail's crumb, the columns lens's label and edge signs. These said "task", "tasks" or "shelfItems" before. Find's kind hit and a band group's words keep "Tasks".
    - A camel-cased, snake_cased or kebab-cased name is said in words: "shelf items" in a sentence and "Shelf items" as a label, where the routed face said "shelfItems". Addresses are unchanged: `kindPath` keeps the declared plural, or else the name as written and an "s".
  - `RelationKey` drawn on its own is capped at `min(280px, calc(100% - 28px))`, the Key's pane's width, not `max(110px, calc(min(250px, 22%) - 32px))`.
  - A click on a control while nothing holds the keyboard now lands the keyboard beside that control if the control is then removed.
- 46f2ac8: A cleanup after the seat. Graview Cloud's hosted page carries 9.5 KB less before the app draws: 577.3 KB where it was 586.6 (532.7 handed a compiled app, where it was 542.0), which leaves Cloud's shell about 17.5 KB under its 595 where it had 8. The rules for what only the scene draws — a district's card and its drive-in, the altitude control, the others in the city and the seat's marks — were still in the sheet every face draws up front. They are the scene face's now, drawn with the scene as the plots and the roads already were.
  
  Typing in Find at a big hub fits one frame again. The scale harness's worst frame typing at the discography's hub was 38 ms, and 55 on a slower run, against its 50. It is 20 now. The hits are a set made once per search, not twice per band card. A host keys what it lights by a hash, not a string of every lit id. The layout no longer reworks the flagged and the log's weights for each keystroke. A record's words are folded once. The ranking uses one collator. `isCurrent` reads the clock only for a kind whose lifecycle is a date.
  
  The same thing is said once where several packages each said it: a sentence's first letter, an act's name in words, a kind counted, a kind's card named, and where an embed lands on a stop that names a place. Comments and test names that still spoke of the companion and its rail now speak of the ask field and the panel. The nightly runs the seat-guide harness where it still asked for the companion's, which had stopped its whole shard. The rule that lands the keyboard somewhere stops asking once its root is unmounted, rather than reading a document a test had already torn down.
  
  Compatibility: internal; no public name, export, behavior or format changes. `themeBaseCss` no longer carries the scene's rules named above; `sceneCss` does, and `themeCss` carries every rule it did.
- 46f2ac8: The host decides the AI, once, and a reader never sees a rung. The seat had a ⚙ that opened "What answers" — "this graph", "on this device", "Jev, which decides", "a model, with my key", with a key field for whoever had one — the same pills again as "Answers come from" in the person's menu, "graph-native" under the field, "Let a model read it →" under a sentence the graph could not read, and answers that ended "(Jev decides rather than talks — the graph is answering here.)". A person asking what is overdue was being asked which machine should answer. Now the AI a seat may use is the host's, given as `ai` on `GraviewProvider`, `mount`, `<Embed>`, a routed face's context or `PagesApp`'s, and the studio's seat uses the app's own: `{ complete }` is the host's model (prompt in, text out), `decide` a decision provider such as `jevDecide(...)`, `onDevice: true` a model in the reader's browser, and `name` what the op log records. The graph answers first, always — where things are, what is wrong, what a record says, the repairs a rule names, a view a template draws — and an open question, or a view no template draws, goes to the host's model when there is one. With none, it is answered "I can answer about what's in this app. Open questions need AI, which isn't on here."; an answer a model gave carries one quiet "Answered with AI", and one the graph gave carries nothing; a model that fails leaves the graph's answer with "(AI didn't answer just now, so this is from the app alone.)", and an on-device model a browser cannot run says AI isn't available there. A decision goes to the host's `decide`, else to a decision provider the app's declaration names (`kind: "decision"`, through the dev server's door at its `bridge` or `/__graview/decide`), else to the host's model behind the parse-and-refuse layer, else to the graph's own rules. Every guarantee holds: what the seat may see, declared acts only, previews, undo, and the log's attribution — a change a model proposed is applied with `via: "ai:<name>"` ("ai:model" when unnamed), which Activity does not show a reader. Taking the picker out shrinks what a page carries: Cloud's hosted page 806 bytes up front, the scene face before it draws 2.2 KB and the pages face 6.3 KB, the pages face alone 6.1 KB and every face 8.8 KB.
  
  Compatibility: breaking for the components and the API a host's seat reaches; ops, stored formats, the wire, the document format and tool schemas are unchanged. Added: `HostAi` (`complete`, `decide`, `onDevice`, `name`), `NO_AI`, `NO_AI_SAID`, `ANSWERED_WITH_AI`, `aiTalks`, `aiVia` (`@graview/tools` and `@graview/tools/frame`), `seatResponder(ai, { floor, onStatus })`, the `ai` prop on `GraviewProvider` and `useGraview().ai`, `ai` on the embed's `mount`/`<Embed>`/pages options and on `PageContext`, `via` on `ChatReply` and `SeatTurn`, `via` on `ToolRuntimeOptions`, `failed()` on what `localCompletion` returns (whose `warm()` now returns a promise), and the test ids `seat-answered-with-ai` (`<testId>-answered-with-ai` on any seat's thread) and `<testId>-header` on `SeatHeader`. Changed: `completionFor(ai)` and `decideFor(ai, { intelligence })` take the host's `HostAi` and the app's declared providers; a graph answer it could not read is `unsure`; `viaSaid` says nothing for `ai:<name>`. Removed: `IntelligenceConfig`, `IntelligenceSource`, `DEFAULT_INTELLIGENCE`, `RUNGS`, `rungFor`, `rungHonesty`, `loadIntelligenceConfig`, `saveIntelligenceConfig`, `describeIntelligence` and `configuredResponder` (`@graview/tools`, and the first seven from `@graview/tools/frame`); `LadderSetting`, `SeatSettings` and `describeSource` (`@graview/primitives`, `LadderSetting` from `@graview/primitives/pages` too); `useGraview()`'s `intelligence`, `chooseIntelligence`, `hostAnswers` and `registerHostAnswers`; `ChatPanel`'s `settings` and `onSettings`; `SeatHeader`'s `source`, `sourceTitle`, `settings`, `onSettings` and `foot`; `SeatThread`'s `onChooseModel`; the reader's stored rung (`graview:intelligence` in their browser, no longer read). Test ids removed: `seat-settings` (⚙), `seat-source`, `seat-ladder`, `chat-settings`, `chat-source`, `chat-ladder`, `<testId>-offer-model`, `studio-agent-settings`, `studio-agent-source`, `studio-agent-ladder`, `setting-intelligence` and its `setting-intelligence-graph`/`-local`/`-decision`/`-remote`/`-why`, `intelligence-key`, `intelligence-decision-key`, `intelligence-provider`, `intelligence-model` and `intelligence-base-url`. What Graview Cloud changes: pass its model to the app as `ai: { complete, name }` on `mount` (and `decide` if it holds a decision provider) — its users see no choice and no rung's name; a harness that opened `seat-settings` or read `seat-source` reads the answer, its "Answered with AI" (`seat-answered-with-ai`) or the "isn't on here" sentence instead; nothing on the wire or in stored apps moves.
- 46f2ac8: The whole-page Shell's scene wears the one app bar, exactly as an embed's scene face does. The Shell had kept a bar of its own on the scene: a wordmark, the browser's back and forward drawn again as ← →, "Lists", the trail, the places as tabs, Find, the standing, Activity and the person. An embed and the routed face wore the `AppBar`, so the same app looked like two apps, and on a phone the Shell's bar wrapped to three rows. Now both draw the app's mark and name (the way home, to the pages' front page), the Scene and Pages switch, what the scene shows and every picture it can (standing on the row where they fit, under "More" or one control where they do not), Find, Activity once something has happened, the standing and the person. It is one row of at most 48 px at a desk and on a phone, with the place on the page's first line under it on a phone, as an embed's is. The scene's Find and Activity are put in the bar by the scene face, the Shell's and an embed's alike, so a page that opens on the pages never fetches Activity. What the bar said about the picture rather than the app is on the picture, in its top corner opposite Up, and only while it holds: "the past", "zoomed in", "moved", a raised relation and whose stop you follow, each with its ×. The record in focus is not named again over its own card; Escape, the browser's own back and forward, and the bar's places are the way back.
  
  A day the framework puts in a sentence is said as a card's glance says it. "Pay the deposit" was due 2026-08-28 on the bar, in the problems and to the seat while the task's card said 28 Aug 2026. Now a rule's message says "was due 28 Aug 2026" however the rule wrote it, and a template's `{due}` or `{due | date}` says the same. A record's facts say a day the same way too. The edit control alone holds the day as it is kept, which it writes back. A choice is said as it is declared (its `display.format`), else spoken: "Tue", never "tue". The edit control's options are said the same way. The todo example no longer declares its weekdays upper-case. A date filter asks for its day beside the filter with the browser's own date control and an "Add", not the browser's prompt that asked for "(YYYY-MM-DD)", and its chip says "Due before 15 Sep 2026". The rota example opens on its own fortnight rather than the real week, which was empty without `?today=`.
  
  The place tabs' rules left the sheet every face draws for the tabs' own, and `viaSaid` is a module of its own, Activity's alone. A hosted page's first load is 578.0 KB, 0.7 KB over the cleanup's, and 533.4 KB handed a compiled app: the days and choices said as read, and the bar's place for the scene's own tool. Every face of the embed carries the scene's Activity: about 6.5 kB more minified.
  
  Compatibility: ops, stored formats, the wire, the document format, check's finding codes and tool names are unchanged. Changed: the Shell's scene bar is the `AppBar`. Its test ids are `app-bar`, `app-home`, `app-name`, `app-faces`, `app-face-scene`, `app-face-pages`, `app-find`, `app-find-open`, `app-places-open`, `app-place-scene:<kind>:<as>`, `standing`, `activity-button` and `profile-button`. `wordmark`, `backtrack`, `pages-link` and the scene's `places` and `place-<as>` tabs are gone from it. On a phone, Find is behind the bar's magnifier. `ShellProps` loses `nav` and `homeLabel`; `pagesHref` now names where the switch's Pages and the way home go, and `null` draws no switch. `Wordmark` and `Backtrack` are no longer exported from `@graview/primitives`. The scene's view chips (`past`, `zoomed`, `moved`, `raised`, `following-who`) are drawn on the picture, in a `nav` named "View" (`trail`), and the scene draws no crumb of the record in focus (`focused`). `ReadableField` has `stored`, the value as kept. `readableFields` says a `YYYY-MM-DD` value as "28 Aug 2026" and a `z.enum` value through `valueWords` in a record's facts as on a glance. A rule's `message` says every standalone `YYYY-MM-DD` as the glance does. A template's `| date` and a bare day say "28 Aug 2026". `EditableValue` takes `stored`. The arrange bar asks a date condition's day with `arrange-day` and `arrange-day-add`, never `window.prompt`. New: `AppBar` lists a scene's places without a switch when it is given `scenePlaces` and no `faces`, and hands the face a place for its own tool (`BarFind.own`). `SceneBarTools`, `SceneTrail` and `useCallLog` (from `@graview/primitives` and `/scene`), and `dayAsRead` and `daysAsRead` (from `@graview/core`).
- 46f2ac8: The seat floats, and is quiet, on both faces. It was a rail down the scene's left edge — "SELECTED · Pay the deposit", nine acts with nine stars, a filter field, "Show 1 more", three canned questions, the relations, a log of what it did, "What the lines mean" and "graph-native" — and on Pages a "◆ Ask" pill that opened the same rail as a drawer beside the record page's own acts, with a "Close" pill over it on a phone. Now there is one quiet field at the foot of the picture, "Ask Things…", with the Find box's geometry. Asked, it grows up from the field into a panel over the app, never pushing the page: one plain line about where the reader is (the problem on what they are looking at first), at most three things to ask built from the graph (`suggestionsFor`, `whereLine` and `offeredActs` in `@graview/tools/suggest`), at most three acts — only the repairs a broken rule names for that thing and the reader's own pins, each said about it ("Give Pay the deposit a new date") and never in a mutation's name — and the conversation, where a name is a link that goes there and a proposal is one line with "Do it" and "Not now". Every other act is one question, the context menu (right-click, or A on a card, which now opens the menu at the card) or Pages' "What can be done" away. ⇄ snaps it to the other foot; on a phone it is a bottom sheet with a grab line. The source that answers is said under ⚙ and nowhere else, and the person never reads the word "seat". It is a region named "Ask Things": opening it puts the keyboard in the field, Escape closes it and puts the keyboard back, and the latest answer is said aloud. The conversation now belongs to the app, held by the provider and kept in the tab's session storage, so it is still there after a switch between the scene and Pages, and Find's last row, "Ask: ‘…’", opens the seat with what was typed. "What the lines mean" is a "Key" beside Up. The scene gets the rail's width back and keeps a 64-pixel strip at its foot clear of cards for the field. The panel is fetched when the seat is first opened; what a page carries up front grows by the conversation's holder, about 1.3 KB. `graview check` warns of an act with no title (`act-without-title`), which every surface had offered in its mutation's name; an untitled act is now offered with that name spoken ("Move to list").
  
  Compatibility: breaking for the look and the components a host or an app's shell reaches; ops, stored formats, the wire, the document format and tool schemas are unchanged, and check gains one warning code, `act-without-title`. Removed: `Companion`, `CompanionProps`, `CompanionMode`, `COMPANION_TAB` and `COMPANION_OVERLAY_BELOW` (`@graview/primitives`, and `CompanionMode` from `@graview/embed`); in their place `SeatField`, `SeatFieldProps`, `SeatStart` (`"field" | "hidden"`), `SEAT_WIDTH`, `SEAT_PHONE_BELOW` and `LinesKey`. The Shell's `companion` prop is now `ask` (`"field"` or `"hidden"`), and the embed's `companion` option is now `seat` (`"field"` or `"hidden"`); the open/collapsed rail and the reader's remembered choice (`graview:companion:<app>`) are gone. `useGraview()` loses `railLeft` and `registerRail` and gains `seatTalk` (`createSeatTalk`, `useSeatTalkState`, `useSeatDrawn`, `seatTalkKey` and the `SeatTalk`, `SeatTalkState`, `SeatTurn`, `SeatOutcome` and `SeatSide` types in `@graview/react`); the scene lays out with 8 px on its left at every width. `Inspector`'s `placement` is `"float" | "menu"` (`"rail"` is gone), and `placement="menu"` lends the cards their acts key; `ACTS_KEY` moved to the inspector. `ChatPanel` is the conversation alone — no pill, no popover (the `chat` popover is gone from `POPOVERS`), `inside` removed, with `shared`, `composer`, `empty`, `settings` and `onSettings` added — and its proposals are "Do it" (`<testId>-apply`) and "Not now" (`<testId>-decline`). `useSeatConversation` takes the `talk` it keeps the conversation in. `useSubject({ hover })`. `FOOT_OBSTACLES` is `[data-graview-foot]`. Pages: `PageAsk` draws the seat in a box `page-seat`; `askPlace(box, view, need)` returns that box's `{ shown, left, top, width, height }`. Test ids and attributes removed: `companion`, `companion-tab`, `companion-dock`, `companion-subject`, `companion-state`, `companion-acts-key`, `companion-said`, `companion-asking`, `companion-show-me`, `companion-log`, `companion-key`, `data-graview-companion`, `-companion-mode`, `-companion-shape`, `page-ask`, `page-ask-drawer`, `chat` (the pill), `chat-panel` inside the seat (now `seat-panel`), `chat-draft` inside the seat (now `seat-field`), and the scene's `inspector-strip` on a selection (the scene's selection draws no strip; the acts are the context menu). Added: `seat`, `seat-field`, `seat-panel`, `seat-body`, `seat-here`, `seat-where`, `seat-suggestion`, `seat-act`, `seat-side`, `seat-settings`, `seat-source`, `seat-close`, `seat-grab`, `seat-said`, `seat-apply`, `seat-decline`, `seat-pick`, `seat-question`, `find-ask`, `lines-key`, `lines-key-pane`, `page-seat`, `data-graview-seat`, `data-graview-seat-side`, `data-graview-seat-shape`. What Graview Cloud changes: pass `seat` where it passed `companion` (or nothing, for the field); a shell that drew `Companion` draws `SeatField`; a harness that looked for `companion`, `page-ask` or the scene's inspector strip looks for `seat`, `seat-field` and the context menu; a layout that reserved the rail's 264 pixels keeps 8; nothing on the wire or in stored apps moves.
- 46f2ac8: The seat takes you where you ask and draws a view you can keep as a lens, on both faces. What the resolver and the drafting engine answered is now what the seat does. An answer's moves are made by the face it is asked on. The scene sets a stop through the provider, so the address follows it and Back walks out of it: a picture, a kind's district narrowed by `in.filter`, a record focused, and for "what's wrong" the standing's problems opened. Pages navigates to the move's address. In an embed it is the same provider's view and the same router, so `where()` stays true. The seat says each move in a sentence ("Went to The week."), and the name in it is a link that goes there again. A list the resolver could not narrow offers "Show as a view", which draws those records. The seat's conversation is handed the places it may go to and the place the reader stands in, and an app pinned to a day (`?today=`, a test, a replay) is asked about that day: `Store.today()`. Asked for a way of seeing ("Show tasks as a board by day", "a board of decisions by status", "who covers what"), the seat draws it with `@graview/tools/draft`, fetched with the first such ask. The draft stands in place of the picture: over the scene, under the seat, and on Pages in the main column at `/~draft`. It sits under one hairline line, "Draft — Tasks by day · Keep as a lens · Discard", and is live on the app's data as the reader may see it. Asking again ("as a calendar", "group by status", "only this month") replaces it. An ask that cannot be drawn says why in one line ("Couldn't change that: tasks' notes is not a choice…"), and the last good view stays. Keep hands the check-clean `add-lens` edit to the host (`onKeepLens`). A host that writes the declaration answers `{ kept: true }`, and the lens is in the places for everyone. Otherwise, and in an app declared in code, it is kept as the reader's own in this browser, under "Your lenses". Where a host could not write it, the seat says so: "Ask the owner to keep it for everyone." Either way it joins the place list beside the app's own, and the face goes to it. Take back, in a notice and in the conversation, hands the host the `remove-lens` edit or drops the reader's own, and the place goes. With nothing asked yet, the seat offers at most three things in the reader's words: what is wrong, then what falls due this week (else another picture to go to), then a board a shipped lens can draw ("Show tasks as a board by day"). Every one is answered without a model. On the hosted page, the frame, the resolver and the drafting engine are fetched when asked, never up front; `@graview/tools/keep` is never on the page at all. Up front the page carries 1.9 KB more, for the reader's kept lenses laid beside the app's own places as a face opens.
  
  Compatibility: ops, stored formats, the wire, the document format, check's finding codes and tool names are unchanged. New: `GraviewProviderProps.onKeepLens` and the embed's `onKeepLens` option, and on Pages `PageContext.onKeepLens`. Each is a `KeepLensHost`, handed an `add-lens` or a `remove-lens` edit and answering `{ kept, said? }`; the types `KeepLensHost`, `KeepLensAnswer`, `LensEdit` and `SeatKept` come from `@graview/react`. Also new: `SeatTurn.moves`, `.offer` and `.kept`, and `SeatTalkState.draft` and `.draftNote` with `SeatTalk.setDraft`; `ChatContext.today`; `Store.today()`; `ViewMeta.beside` and `ViewRegistry.forget`, a place reached by its name that takes no kind's default picture, and taking one away; `useSceneGo` from `@graview/primitives`, and `DraftDoor` from `@graview/primitives`, `/scene` and `/pages`; `registerReaderLenses`, `readerLenses`, `appKeyOf`, `registerLensPlaces` and `NoticeBoardContext` from `@graview/primitives` and `/frame`; `ChatPanel`'s `onMove`, `place` and `onDraft`, and `SeatField`'s; the routed face's `/~draft` route; and the test ids `draft-frame`, `draft-line`, `draft-title`, `draft-keep`, `draft-discard`, `draft-note`, `draft-lens`, `seat-went`, `seat-offer` and `seat-take-back`. Changed: the Shell always draws a notice board, its own when the host gives none. A seat move to a picture or a record drops a narrowing an earlier ask left on the stop. What Graview Cloud changes: to keep a drawn lens in an app opened from a document, pass `onKeepLens` to `mount`. Apply the `add-lens` edit (or `remove-lens`, to take it back) to the stored document as its other declaration edits are applied, or with `keepLens`/`takeBackLens` from `@graview/tools/keep` on the server, and answer `{ kept: true }`. Then hand the embed the new document with `setApp` when it is written. Without it, a reader's kept lens stays theirs, in their browser.
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [a9f6971]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [46f2ac8]
- Updated dependencies [41ed9af]
  - @graview/core@0.1.19
  - @graview/react@0.1.19
  - @graview/tools@0.1.19
  - @graview/primitives@0.1.19
  - @graview/pages@0.1.19
  - @graview/layout@0.1.19
  - @graview/studio@0.1.19

## 0.1.18

### Patch Changes

- 44d109d: A part of the page that fails to load tries again, and never breaks the page (FR-139). Graview Cloud's realtime harness takes a person's browser offline for a moment, and where the person's menu had not fetched its part yet, the page fetched that chunk while offline. The import failed, and Chromium and Firefox keep a failed module for the page's life: an `import()` of the same URL fails again at once, without a request. From then on the menu opened with only "Keeping this app", without the seat, the host's actions or "Report this app", each open threw "Failed to fetch dynamically imported module" inside the embed, and only a reload brought it back; about half of Cloud's runs on 0.1.17 failed on it. Every part a page fetches as it is first drawn now goes through one loader, `retryingImport` (`@graview/core/retry`, a page's entry only: workerd, where a host runs core, tools and ship, refuses a script with an `import()` of a computed URL in it, reached or not, so nothing a server imports reaches it), which asks again after a failure: where the failure names the URL it could not fetch (Chromium and Firefox do), it imports that URL with `?retry=<n>`, another URL and so another fetch, whose own imports resolve to the chunks the page already holds; where it names none (WebKit, which asks again on its own), it calls the bundler's import again. React parts are drawn with `lazyModule` (`@graview/react`): until a part arrives, its place says so in one line — "The rest of your menu will load when you're back online." or "… didn't load." — with a real "Try again" button, its words a polite status, and nothing is thrown. It is asked for again when the browser says it is back online, when the part is drawn again, when somebody reaches for what holds it, and when "Try again" is pressed, which asks for every part that failed; when it arrives with the keyboard on the button, the keyboard goes to the part's first control. That covers the person's menu (its top says so once, the rest waits quietly), the problems' rows (a list item in the list), the row that arranges a list, the framework's views, the declared lenses and the home view, the embed's faces (`preload` resolves either way now), the scene's keeping controls and the studio in the menu, the assistant on the pages, the rules for settling a handed-back place (asked again online or every ten seconds), and the guest host's drawing, press reader and worker (a worker view's host asks again when the browser is back online; a view whose drawing did not arrive stops with the plain face, "start"). What a server may also run — the compiler `appFromOrCompile` fetches, the agent seat's describer and the view runtime `viewScript` reads — keeps a literal `import()` and forgets a failure, so the next call asks again, without a URL of its own. The person's menu is fetched when the page is idle and online (`requestIdleCallback`, or 2.5 seconds after it draws where there is none), so it is rarely needed offline. What cannot be mended: a chunk that arrived while one of its own imports did not; the failed import is kept under its own URL, which no query on the importer changes, and only a reload gets past it. `pnpm verify offline` mounts the embed as a host does, in Chromium, WebKit and Firefox, takes the browser offline the moment the app has drawn with the menu's chunk refused from the start, and holds that the menu says so in one line with no page error, that the next open back online is the whole menu — the same controls as a page never offline, "Report this app" among them — without a reload, and that "Try again" from the keyboard keeps the keyboard while it cannot arrive and puts it on the menu's first control when it does; on main the menu's open threw in every engine. The hosted page carries 575.8 KB compiling (572.7 with the bar that fits its box alone) and 532.1 KB handed a compiled app (528.9); its budgets rise by that to 576 KB and 532.25 KB, which leaves Cloud's shell 19 KB under its 595. `capabilities().shipped` gains FR-139.
  
  Compatibility: markup and behavior a host holds, a new entry `@graview/core/retry`, and new exports in `@graview/react`. New: `@graview/core/retry` and its `retryingImport`, for a page only (the main entry, tools and ship's runtime carry no computed `import()`, which workerd refuses); `lazyModule`, `retryLazyParts`, `LazyModule` and `LazyPartOptions` (`@graview/react` and `/provider`); the line `[data-testid="lazy-part-missing"]` and its button `lazy-part-retry`, drawn in a part's place while it has not arrived. A part that did not arrive draws that line where it threw into the embed's boundary (the "@graview/embed threw while rendering" report); `preload` resolves when a face did not arrive, where it rejected. `fetchFrameworkViews`, `fetchDeclaredLenses` and `fetchHomeView` ask again on the next call after a failure, where they kept the failure. `viewScript` moved within `@graview/guest` to a file of its own, exported where it was. What Graview Cloud changes: nothing is required; its realtime harness should stop failing on the menu. A harness that takes the browser offline may wait for `lazy-part-missing` in the menu while offline, and for the menu's host actions on the next open once back online. Ops, stored formats, the compiled-app format, wire messages, check finding codes and tool names and input schemas are unchanged.
- b00d5cf: A view of one record sits beside the record's editable fields, a view can offer a record's long text to edit without retyping it, and the views guide says what a view is handed (FR-149, FR-150, FR-151). On Graview Cloud, Nick's "Farm Bureau POM Workshop" has a deliverable with a three-thousand-character `draft`; a chat wrote a worker view of it (`attach: "deliverable"`, `cardinality: "one"`), and once applied the record on the scene was the view alone, labeled "Made by Claude, for nick", with no way left to change the draft. Registering a worker view of one record now draws it above what the registry drew for the record before: on the scene the record drawn at full is the view and then the record's own fields, each editable where an act writes it; on Pages the record's page is its heading, the view, then its facts and what can be done, as it was. A manifest that says `replaces: "page"` draws the view alone, as before, and on Pages without the facts, the links and the acts (what is wrong and what has happened stay); `checkManifest` refuses any other value, and `replaces` on a view of many or of the home. The views guide said a write takes only what the person typed — "Do not prefill" — so a view that offered "Edit draft" asked for all three thousand characters again. Now a view marks a field and the host fills it: `<textarea name="draft" data-prefill="draft">` in a `fieldset` bound to the record is filled, after the view draws it, with that record's `draft` as the viewer sees it, whole and with its line breaks, when an act in the fieldset is named in the manifest, is done to that record, takes `draft`, writes it (its `writes`, or an argument named like the field), writes no other record's fields, and may be run there by this viewer; otherwise it stays empty, so a seat that may not write the draft is never handed it to edit. The filled value is the viewer's to edit, and a press carries it only back into the field it came from: pressed for another act that takes it, it is refused `untyped`, and a view that writes into the field after the host filled it makes it the view's, as ever. The value is a field of a record the view was already shown, so prefilling hands the view nothing new, and it can be saved only where it came from. And the guide said each of `props.nodes` had `fields`; a record's fields are on it by name (`node.draft`, `node.status`), beside `id`, `kind` and `label`, and a view of one finds its record in `props.node`, never in `nodes`. A view written to the guide drew nothing. The graview-worker-view skill, `@graview/guest`'s README and `GuestNode`'s documentation now say so, and the skill gains a worked example of a view of one record (`examples/a-record.js`: a deliverable's subject and its draft as paragraphs, and "Edit draft" prefilled), which a test runs headless over the workshop in miniature so the guide cannot drift from the props again. `guest-sandbox --transport=record` holds it in Chromium, WebKit and Firefox, with the skill's own example on Cloud's workshop in miniature: on the scene and on Pages the view and the record's editable fields are both drawn, `replaces: "page"` draws the view alone on both, the view draws the draft's paragraphs, "Edit draft" opens the whole draft filled in, a person's edit saves with its line breaks intact, and for Rae, who may not write the draft, the same field and one bound to a memo she may not see are filled with nothing and her press changes nothing. Run against 0.1.17, the scene drew the view alone, the field was empty, and saving it replaced the draft with what was typed. The guest host's first load when a page registers a worker view carries 1.0 KB more and the open kit's host 2.6 KB more; their budgets rise by that. The hosted page carries 163 bytes more, compiling or handed a compiled app, the record page asking whether a view replaces it; its budgets rise by that. `capabilities().shipped` gains FR-149, FR-150 and FR-151.
  
  Hardened by the security review before it shipped: a field the host fills is filled only when it holds the record's value whole, and is left empty otherwise; an untouched filled field sends the record's value as it is when pressed, not the copy it was filled with; a field is filled only for an act that declares it writes that field (an own property, never one inherited); and a view that replaces the record's page and fails leaves the record's own face, its fields, in its place rather than a page with neither.
  
  Compatibility: ops, stored formats, the document format, wire messages, `GUEST_PROTOCOL`, check finding codes and tool schemas are unchanged; `GuestProps` is as it was (its documentation was corrected, not its shape). New: `WorkerViewManifest.replaces` (`"page"`, optional), refused by `checkManifest` with any other value or on a view of many or of the home; the `data-prefill` attribute on an `input` or `textarea` a worker view draws, which the host fills; `PressedField.from` and the `Prefilled` type (`@graview/guest/host/views`), the record and field a host-filled field came from; `@graview/react`'s `DefaultDrawnElsewhere` (the context `DefaultViewElsewhere` provides, now read by a worker view too), `markReplacesPage`, `replacesPage` and `REPLACES_PAGE`; and `data-worker-view-beside` on the element holding a view of one and the record's own view under it. Changed: a worker view of one record is no longer drawn in place of the record on the scene; it is drawn above the record's own fields, as on Pages, unless its manifest says `replaces: "page"`. A view of one that fails on the pages face draws nothing in its place (the page already is the record), where it drew the record's card a second time. What Graview Cloud changes: its chat guide's "views" topic (`workers/cloud/src/mcp/guide.ts`, the `views` entry) says `props.nodes` have `(id, kind, label, fields)` and "Do not prefill"; it should say a record's fields are on it by name, a view of one reads `props.node`, a field is offered to edit with `data-prefill` and the same `name` inside a fieldset bound to the record, and a view of one sits above the record's fields unless the manifest says `replaces: "page"`. A view applied before this that relied on being the record alone adds `replaces: "page"` to its manifest.
- ec2c73a: The scene has its place control in the bar (FR-144), and the places stand in the bar when there is room (FR-145). Nick, on 0.1.17: "is there a way to have a subnav on Scene like how there is for Pages … where i can select from the Lenses available in the Scene? … Might also be nice to have some of them available with a More dropdown when screen real estate allows (for pages nav and scene nav)". On the scene the bar said nothing after the switch, and the scene's pictures were chosen on a district's marquee or from a panel that folds to a rail. Now the same control stands there on both faces: on the scene it names what is in view — "The whole thing", or the picture showing — and lists the whole thing and every picture the seat may see, grouped as on Pages and with the same keyboard; choosing one moves the scene's `in.view` exactly as every other way to a picture does (its kind's district in focus, on the ground, showing it), and choosing the whole thing rises to it from above, as Up does, with no picture in view, and under `routing: "address"` the address with it, a step Back undoes. The panel keeps no picker of its own: the bar is the one place a picture is chosen from, and the district's marquee stays in the picture. Where the bar has room after the name, the switch and the tools, the places themselves stand on the row as plain words in their declared order — the one you are on always among them, underlined in the accent and in the weight the switch's pressed face has — and the rest fold into "More ▾"; with room for fewer than two the one control comes back, and a phone's bar keeps it. Which stand is weighed from the bar's own width — again on a resize, when the brand's face arrives, when the brand, the face or the places change — with Find giving first, down to its least, then the places folding into More, then the one control, then the app's name; the places are weighed with the switch's words kept, so the switch says its words before a third place stands. The bar stays one row of 48 px. On Cloud's workshop at 1920 px all seven places stand (Home, Dates, Decisions, Deliverables, What the workshop covers, Email to Todd, Connections), at 1280 five and More, at 1024 three and More, at 390 and in 480, 640 and 900 px boxes the one control; the scene's three stand from 1280 up. In WebKit the place list was as tall as its most with its groups spread through it; it is as tall as what it holds. `pnpm verify quiet` measures the bar on both faces at 1920, 1440, 1280, 1024 and 390 and in 480, 640 and 900 px boxes on a 1440 desk, three engines and both schemes: one row of at most 48 px, every control on its middle line, the place you are on seen on the row or the phone's first line, four or more places standing at 1920 on Pages and fewer at 1280, the scene's pictures standing at 1920, the one control on a phone and in the narrow boxes, the same row after the window is narrowed and widened again, every place reached in two presses by pointer and by keyboard with the list snug, and on the scene each picture chosen from the bar the scene's `in.view`; `pnpm verify address` chooses a picture from the scene's bar and finds the address and `in.view` moved together and Back undoing it. The hosted page carries 4.7 KB more compiling and 4.8 KB more handed a compiled app, all of it the bar — the places drawn as words with More and weighed, 3.7 KB, and the scene's places, 0.9 KB; its budgets rise by that. With a record drawn once, a view beside its record and long text on a record page in the same release, the hosted page carries 583.2 KB compiling and 538.7 KB handed a compiled app, under budgets of 583.4 KB and 538.8 KB, which leaves Cloud's shell 11.6 KB under its 595. `capabilities().shipped` gains FR-144 and FR-145.
  
  Compatibility: the look and markup a host's page reaches; ops, stored formats, the wire, the declaration, check's finding codes and tool schemas are unchanged. New: `AppBar`'s `scenePlaces` prop; `useScenePlaces`, `scenePlacesOf`, `WHOLE_KEY` (`"scene:whole"`), `WHOLE_LABEL`, `placesThatStand`, `PLACE_GAP` and `FEWEST_STANDING` from `@graview/primitives` and `/frame`; on the scene the bar's places `app-place-scene:whole` and `app-place-scene:<kind>:<as>`, each with the scene's address for it as its `data-place-path` (`/places/overview#overview=1` for the whole thing, `/places/overview#focus=aggregate%3A<kind>&in.view=<as>` for a picture); places standing on the row, inside `nav[data-testid="app-places-standing"]`, each `app-place-<key>` with its `data-place-path`, the current one `aria-current="page"` holding `app-place-current`. Changed: on the scene the bar is no longer empty after the switch; `app-places-open` is "More" when places stand and the one control when none do, and absent only when every place stands; `app-places` holds the places that do not stand, and is a `div` inside the control's `nav` (labeled "The app’s places", or "What the scene shows") where it was itself the `nav`; each place is in the bar exactly once. How a harness reaches any place, at every width and on both faces: press `[data-testid="app-place-<key>"]` (or `[data-place-path="<path>"]`) inside the embed if it is visible; if not, press `[data-testid="app-places-open"]` and then press it in `[data-testid="app-places"]`; `[data-testid="app-place-current"]` says where the reader is (`docs/stability.md`). What Graview Cloud changes: its harnesses that press `app-places-open` and then a `data-place-path` first press the place itself when it is visible — at a desk's width it may stand on the row, and with every place standing there is no `app-places-open` — and those that read the scene's bar as having no place control now find the scene's; those that count the bar's places read them from the embed (`[data-place-path]`), not from `app-places` alone.
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
  - @graview/pages@0.1.18
  - @graview/tools@0.1.18
  - @graview/layout@0.1.18
  - @graview/studio@0.1.18

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
  - @graview/primitives@0.1.17
  - @graview/pages@0.1.17
  - @graview/react@0.1.17
  - @graview/layout@0.1.17
  - @graview/studio@0.1.17
  - @graview/tools@0.1.17

## 0.1.16

### Patch Changes

- 87e43d3: A host's press leaves the reader's keyboard where it is, and two embeds on one page name their search apart. Putting the seat away from its header moves the keyboard to the tab, and opening it from the tab moves the keyboard to the header (FR-78). It did so for any click, so a host page whose own script puts the seat away after the mount, as graview.dev's landing page and demos do, took the reader's keyboard into the embed before they had touched it: the first Tab no longer reached the page's skip link. The keyboard now follows the control only when it was on the control. Every landmark inside an embed is named after the embed (FR-128), but the sweep did not reach the routed face's Find box, a `role="search"` form named "Find anything", so a page with two embeds on that face carried two search landmarks of one name (axe's `landmark-unique`). It is now "<embed> · Find anything". A unit test puts the seat away and opens it with the keyboard elsewhere and checks the keyboard stays there, and another mounts two embeds on the routed face and holds their search landmarks to two names under axe. `pnpm verify site` holds again on the rebuilt `docs/site/chapters.js`.
  
  Compatibility: a search landmark inside an embed is named after the embed, as every other landmark inside it already was. Ops, stored formats, the document format, wire messages, check codes and tool schemas are unchanged.
- 1df248f: A brand's mark is read as the browser reads it, and what the review after 0.1.15 found in the brand, the bar and the overview is fixed. An inline SVG logo is put in the page through the HTML parser, and the rules that judged it searched the string for what is forbidden, so the parser could be talked past them: a handler after a slash (`<animate/onbegin=…>`), an unquoted `javascript:` link, markup after `</svg>` (`<img/src/onerror=…>`, `<base>`, `<meta http-equiv=refresh>`), an animation that sets a link, a style written in CSS escapes or character references (`u\72l(`, `@\69mport`), a namespaced `<x:script>`. Each was taken by `graview check` and drawn on every face. `svgProblem` now reads the SVG element by element as the HTML and the XML parser will, and keeps only what a picture is made of: the drawing elements (no `a`, `style`, `script`, `foreignObject`, animation or `feImage`), no prefixed element and nothing but text inside `title` and `desc`, every attribute quoted and apart, no handler, a link only to `#id` within it (or a `data:` PNG, JPEG, GIF, WebP or AVIF on an `<image>`), every `url(` a fragment of it and no escape, at-rule or image function in a value, no CDATA, no entity and nothing after the root. A path that climbs (`.` or `..`) is refused, and `markHref` hands a face no address of a scheme other than `http`, `https` or a `data:` image. The guest host makes no `blob:` of an inline SVG that could act, and fetches no path that climbs or is percent-encoded to, so a view is never handed the bytes of another page of the host. A face named in a document is left out of the style sheet when it could end its rule, even where the page compiled without the checker. Reading the mark costs about 4 kB minified wherever a mark is drawn or handed to a view: Graview Cloud's hosted page carries 579,107 bytes up front compiling (565.5 KB, its budget now 567 KB, which leaves the shell its ~25 KB under 595 with 3 to spare) and 534,306 handed a compiled app (521.8 KB of 523); the pages face alone measures 505,406 / 173,425 bytes (minified / gzipped), the embed without the studio 693,248 / 179,214, and the guest host before a worker is drawn 16,358 / 7,540, each budget raised just above. A test in `@graview/core` holds twenty-three payloads refused and a picture's own parts kept, and one in `@graview/primitives` draws none of the bypasses. The review also found: an embed narrower than `pagesBelow` under `routing: "address"` opened on "No picture is called that." (the routed face now takes `/places/overview` as the home, unless a declared place holds that address); the scene's Find in the bar took ⌘K from the host page's own editor and `/` from anywhere (it answers ⌘K only from within its embed or from nothing, `/` only from within, and never a key the host already answered); the stop "On the overview ↗" named held the scene for the rest of the visit, so `setStop` was ignored after it (it is let go when the reader leaves the scene or the host sets a stop); Escape putting the phone's Find away left the keyboard on the page's body (it goes back to the magnifier); the place you are on could hide inside "More" on a row too narrow for one tab, and a web font arriving late did not re-measure the row; the shade a `theme-contrast-below-aa` finding offered was judged on a gradient's first stop only and could fail on the others; `pages-overview-taken`'s fix told a declaration to rename the overview, which keeps its address; an accent refused because the warning color shares its hue was said as failing to read in the dark scheme, and a dark-scheme refusal asked a document for a dark accent it cannot give; `set-brand {}` was taken with nothing said, the same logo or name again was said as a change, an alt text alone was said as "The logo changes.", and words with quotes or a closing period were quoted as `"Say "hi""` and `"…booked.".`.
  
  Compatibility: `svgProblem` and so `brand-mark` refuse inline SVGs they took before: an `<a>`, a `<style>`, an animation, `feImage`, a prefixed element, an unquoted attribute, an element inside `title` or `desc`, CDATA, a named entity in an attribute other than XML's five, and a mark path with a `.` or `..` segment; a mark that only drew shapes, gradients, filters, text and its own `#` links is taken as before. Graview Cloud's `add_image` should hold an image to the same reading. `markHref` returns undefined for a scheme other than `http`, `https` and a `data:` image. `editDocument` takes an optional third argument, `{ fonts }`, as `compileDocument` does; `set-brand` refuses an edit that names no key, or an empty `typography`, `shape` or `accents`; the sentences said for an unchanged name, description or logo, and for an alt text alone, are new words, and a quoted name or line that ends a sentence carries its own stop. `passingShade` clears every stop of a gradient. `accentProblem`'s `pair.on` is a hex color and its `ratio` the accent's on the dark panel where the dark scheme refused it. `pages-overview-taken`'s fix is new words. Ops, stored formats, the document format, wire messages, check codes and tool names and schemas are unchanged.
- eefa440: A renamed app says its new name without a reload (FR-128). Graview Cloud mounts the embed with `label: app.name`. When a chat renames the app, Cloud hands the new app to `setApp` (FR-116), and the swap kept the first mount's label. The open page's region, the heading that said the app's name and every landmark inside ("A proposal · Places") went on saying the old name until a reload. A label that was the app's own name now follows the app, and `setApp` takes the new one. A label the host chose, such as "Chapter 13", stays. `setApp(app, store, { label })` gives another, and the new `handle.setLabel(label)` renames the embed in place, on the whole embed and on the pages alone (`@graview/embed/pages`). The landmarks inside are renamed with it, each named after the embed once, and nothing is drawn again. `handle.setHostActions(actions)` changes the host's own actions in the profile menu the same way, on both handles, so a host can say "Change Chores" after the rename. The wordmark already followed the new app's brand. Under the new names, a unit test renames an app on the Graview face and on the pages face. It checks the embed's accessible name, the app's name on the bar and the landmarks inside, then a host's own label kept, a label handed to `setApp`, `setLabel` on both handles, and `setHostActions`. `pnpm verify address` holds one more claim in Chromium, WebKit and Firefox, `aRenamedAppSaysItsNewNameOnBothFacesWithoutAReload`. It mounts the proposal as Cloud's shell does (`label: app.name`, `heading: 1`), renames it as `set-name` would, and hands it to `setApp`. Then on the pages face and on the scene, in the same document, the region, the heading and the wordmark say "A proposal, renamed", the landmarks inside are named after it, and the old name is said nowhere. Cloud's hosted page is 437 bytes larger up front for it; the release's figures are in the one app bar's entry.
  
  Compatibility: `EmbedHandle.setApp` takes an optional third argument, `{ label }`. A label that equals the app's name now follows the new app's name where it stayed. `EmbedHandle` and `PagesEmbedHandle` gain `setLabel` and `setHostActions`, which a host implementing a handle itself must now provide. Ops, stored formats, the document format, wire messages, check codes and tool schemas are unchanged. `capabilities().shipped` gains FR-128.
- 46c6734: Named edits for the app's name, its description and every key of its brand (FR-125). From Graview Cloud: a chat renamed an app with a raw JSON Patch on `/name` it had to discover, and nothing said whether either face drew the document's description. `set-brand` takes every brand key — `logo`, `favicon`, `typography`, `shape`, `accents`, `scheme` beside `accent`, `name`, `currency` and `locale` — and `null` clears one (a part of `typography`, `shape` or `accents` too); `set-name { name }` and `set-description { description }` are edits of their own. Each says what it did and `diffDocuments` says it in words: "The app is now called "…", where it was "…".", "The line under the app's name reads "…".", "The logo changes.", "Headings are now set in system-serif.", "Corners are now 6px.", "The app opens dark when the reader has not chosen." A mark or a face the checker would refuse is refused at the edit, by its path. The description is said on both faces: as the app name's hover on the one app bar (FR-131), and as the line on the routed face's home, wrapping, never cut. `describePlace("home")` says the app as the home draws it (`masthead`, a `DescribedMasthead`): the name, the line under it, and the logo by its alt text (the app's name when none is given) and how it is drawn.
  
  Compatibility: `EDIT_OPS` gains `set-name` and `set-description`. `DocumentDiff`'s sentence for a renamed app and for a changed description is new words; a program matching "The app is renamed from" or "The app's description change" no longer finds them. `PlaceDescription` gains optional `masthead`, and the home's `text` gains a "Masthead:" line after its first. `set-brand { name: null }` now clears the wordmark's name, and a brand left holding only a name is kept (it is drawn). `capabilities().shipped` gains FR-125.
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
  - @graview/pages@0.1.16
  - @graview/react@0.1.16
  - @graview/studio@0.1.16
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
  - @graview/pages@0.1.15
  - @graview/layout@0.1.15
  - @graview/primitives@0.1.15
  - @graview/react@0.1.15
  - @graview/studio@0.1.15

## 0.1.14

### Patch Changes

- cc50785: A new declaration keeps the reader's place (FR-116). When a chat changes an app, the host has a new compiled app and a new store, and `mount` was the only way to hand them to the embed. Graview Cloud remounted on the face the reader was on, but not on what they were looking at: the place or record open on Pages went back to the home, and the scene lost its stop and focus. The embed's handle now has `setApp(app, store)`, which swaps them in place; given a remote instead of a store, its presence comes with it. The face, the page open on Pages and the scene's stop and focus are kept. What the change took away falls back to its nearest parent: a removed record goes to its kind's list (in the scene, its kind's group), and a removed kind or place goes to the home. A lens gone from the scene goes to its kind's group, or to the home when the kind went too. Under address routing the address stays the source of truth, and one that names something gone is replaced, never pushed; under memory routing nothing touches `history` or `location`. The seat, the seats, the people, the scheme, the brand and the notices stay across the swap. The faces are drawn again, so an open menu, a scroll position and a half-typed field do not. `handle.where()` reads the place as `{ face, path, stop, kind }`, and a host that must remount hands it back with `mount(…, { at })`, where it is settled in the new app the same way. Memory routing now also returns to the page Pages was on after a trip to the scene, as address routing already did. The rules for settling a place are a chunk of their own, fetched the first time a declaration changes: Cloud's hosted page loads 566.7 KB up front, where it loaded about 565, against the same 572 KB budget. `pnpm verify address` now holds four more claims in Chromium, WebKit and Firefox: a place on Pages is still open after a new declaration, the scene focused on a record keeps its focus, a reader on a kind the change removed lands on the home, and in memory routing a new declaration writes no history.
  
  Compatibility: `EmbedHandle` gains `where()` and `setApp()`, `EmbedOptions` gains `at`, and `@graview/embed` exports the `EmbedWhere` type; `handle.store` is now the store the embed currently draws. `capabilities().shipped` gains `FR-116`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- 8c43964: A pill means "press this to choose", or a state (FR-117). Building En Dash Org on Graview Cloud ended in one verdict: "too many pills, and too much cut-off text, on every face". When everything is a capsule, nothing reads as the thing to press, and a state badge, the one pill that earns its place, no longer stood out. Now one rule holds on every face. A capsule is a choice the reader can make, or a record's state badge, and nothing else is one. In a set of choices (the face switch, a calendar's range, the "Answers come from" setting, the embed's seats), the one chosen wears the capsule and the others are words to press. The places are text tabs that scroll, with the current one underlined, on a desk and on a phone alike. They are tabs rather than a menu because the places are the app's own navigation, read at a glance: a menu hides every name behind a press, and tabs keep every name whole and on screen. The tabs scroll sideways, a mouse wheel included, and the edge with more beyond it fades. The place you are on is scrolled into view, and each tab is a button the keyboard reaches. The "+N more" select and the phone's single select are gone. A district's name in the scene is text on its plot, haloed in the ground's colour, and its trouble bar is the name's baseline. The open control beside it is a quiet chevron. The scene's "Up" / "Down to …", the zoom control, the seat's suggestions and a calendar's previous, today and next are quiet buttons or links. A record is a card. A chip, a coverage cell's label, a relation's sign on a line and a kind's link on the routed home have a card's corners. A place page's other pictures are links. A kind's mark is its plot in miniature, a small iso tile in the kind's hue, rather than a round dot. A badge is not drawn where its context already says it. No card on a status board wears its own column's status, and a row under a grouped list's heading does not repeat that heading's value. The same goes for a field block of the board's own field. Other badges and blocks are drawn as before. A new harness, `pnpm verify quiet`, mounts the embed over the org app and Cloud's vendor template, as Cloud mounts it. It counts pills by Cloud's own definition: a visible element under 34 px tall, with a corner radius of at least half its height and a fill or a border. It runs in Chromium, WebKit and Firefox at 390×844 and 1280×800, in both schemes. The org app's desk Graview face goes from 39 pills to 4, and the vendor template's phone Pages home from 34 to 7. On the vendor template's desk Graview face it is 20 to 4, and on the org app's phone "Skills and levels" 12 to 7. No board card wears its own column's status, where four did. Cloud's hosted page loads 580 402 bytes up front (567 KB), where it loaded 580 510, so the design pass is 108 bytes smaller up front. The embed without the studio is 696 582 / 178 525 bytes first, where it was 696 428 / 178 422, and its gzipped budget is now 178 600.
  
  Compatibility: `Places` renders `nav[data-testid="places"]` holding `button.graview-place-tab[data-testid="place-<as>"]` (with `aria-pressed`) at every width. The `places-more` select and the compact `select[data-testid="places"]` are gone, and `compact` now puts the tabs on a row of their own. At altitude, `.graview-kind-face` has no capsule: no background, border or radius, and `[data-graview-tally]` is drawn at its foot. `.graview-kind-open`, `.graview-zoom`, `.graview-zoom-button`, `.graview-altitude-control` and `.graview-kind-tag` are no longer capsules. `Chip` has a 6 px radius. A kind's mark with no figure (`[data-graview-figure-kind="dot"]`) is a clipped iso tile, no longer a circle. The columns lens and a grouped list tell the cards they draw which value their heading already says; there is nothing new to import. `capabilities().shipped` gains `FR-113`, `FR-117` and `FR-118`. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- 72d2a95: A place handed back to the embed is settled as its seat sees the app (FR-116, FR-55). `setApp` and `mount(…, { at })` keep a record that is still there and send one that is gone to its kind's list on Pages, or its kind's group in the scene. "Still there" was asked of the whole store. A record the seat may not see was kept and one that does not exist was dropped. Under address routing the reader writes the address, so the next new declaration told that seat which guessed ids were real: `/people/<id>` stayed when the record existed and became `/people` when it did not. The place is now settled against the store as the seat is served it, so a record it may not see falls back exactly as an absent one does.
  
  Compatibility: unchanged for ops, stored formats, the wire, the declaration and check finding codes, and tool schemas.
- 1bfd44a: Under address routing, a place handed back to the embed is settled on the face the address names (FR-106, FR-116). `mount(…, { at })` already opened on the face in the address bar, but it settled the place as if it were on the face `at` said. A host that remounts after a reload with the `at` it read earlier can hand back the scene while the address names a page. The page in the address was then left unsettled, so a record since removed showed as missing instead of falling back to its kind's list. The scene's stop was also written onto the page's address as a fragment. The address now decides the face as well as the place, and a page it names is settled like any other.
  
  Compatibility: unchanged for ops, stored formats, the wire, the declaration and check finding codes, and tool schemas.
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
  - @graview/pages@0.1.14
  - @graview/layout@0.1.14
  - @graview/studio@0.1.14
  - @graview/tools@0.1.14

## 0.1.13

### Patch Changes

- 2b05a64: A status board's column says the lens it is in (FR-109). Each column is a region, and its accessible name now starts with the lens's title: a column of "Vendors by status" is announced "Vendors by status · Researching, 0" where it was "Researching, 0", so a screen reader on a phone, which reads a region by its name alone, says which board a column belongs to. An embed names every landmark inside it after itself ("Views wedding · …"); a column marked `data-graview-named-by-lens` already says which picture it is in, and the embed leaves its name as it is, so the column is not "Views wedding · Researching, 0". The title is the declared lens's `title` on both faces, and "Board" for a columns lens registered without one. `verify-declared` asks each column by its role on both faces, at a desk and a phone, in both schemes.
  
  Compatibility: unchanged for stored data, ops, tool schemas and the wire. A test or a host that found a column region by its old name ("Todo, 2") finds it by the new one ("The board · Todo, 2"); `data-graview-column` is unchanged. Every other landmark in an embed is still named after the embed. `capabilities().shipped` gains `FR-109`.
- ed5444b: A host whose page is the app can give the routed face the address bar (FR-106). The embed's routed face ran on a memory router, so in Graview Cloud's hosted app a place could not be linked, reloaded or shared: loading `/places/vendors-by-status` drew the home, and opening the board's tile left the address at `/`. The embed takes `routing: "address"` now, with a `basePath` for a host that serves the app under a path of its own (`/apps/<id>/`; `/` by default). The routed face then reads its route from the address and pushes each page it opens. Places (`/places/<as>`), records (`/<plural>/<id>`) and the home have their own addresses. Back returns to where you were, and a reload stays put. The address also says which face is drawn. A page past the home is the routed face. A fragment at the home is the scene's stop, kept the way the whole-page Shell keeps it: a step is pushed, and moving the furniture replaces. A bare home is the routed face's home, or on arrival the host's `face`. The face toggle pushes the address of the face it goes to, so Back undoes it, and the toggle returns to the page you left. `mount` opens on the face the address names, and `faceAtAddress(options)` says which that is for a host that renders `<Embed>` itself. `routing: "memory"` stays the default for an embed inside somebody else's page, and it never writes `history` or changes `location`. A host that keeps its own history stays on memory routing. `onNavigate(path, how)` tells it each page the routed face opens, and `setPath(path)` on either handle sends the face back to one. `PagesApp` takes the same `onNavigate` and `path`. `addressOf(place, { basePath })` in `@graview/core` spells a place from `placesOf` under the base, exactly as the face's own links do, `pathWithin` reads an address back, and `basePathOf` normalises a base. Trailing slashes are the same base, and encoded slugs stay encoded. A new harness, `pnpm verify address`, holds all of this in Chromium, WebKit and Firefox at a desk and a phone, and it checks that an article's embed makes no history writes. The scene's fragment sync (`UrlSync`, `useUrlSync`, `adjustment`) is now a module of its own, so a page that never syncs the fragment does not load it up front. Cloud's hosted page loads 577 855 bytes up front (564 KB), where it loaded 575 357; the budget stays at 572 KB. The embed without the studio is 694 569 bytes first, where it was 692 174, and its budget is now 695 000 / 177 500. The gzipped budget for every face is now 439 000.
  
  Compatibility: `@graview/react/provider` no longer exports `UrlSync`, `useUrlSync` or `adjustment`; `@graview/react` still exports all three. `capabilities().shipped` gains `FR-106`. Memory routing is the default, so an embed that does not ask for the address bar behaves as before. Ops, stored formats, wire messages, check codes and tool schemas are unchanged.
- Updated dependencies [2b05a64]
- Updated dependencies [8bc3c59]
- Updated dependencies [4d3c1f9]
- Updated dependencies [ed5444b]
  - @graview/core@0.1.13
  - @graview/primitives@0.1.13
  - @graview/react@0.1.13
  - @graview/pages@0.1.13
  - @graview/layout@0.1.13
  - @graview/studio@0.1.13
  - @graview/tools@0.1.13

## 0.1.12

### Patch Changes

- Updated dependencies [4801c44]
  - @graview/core@0.1.12
  - @graview/layout@0.1.12
  - @graview/react@0.1.12
  - @graview/primitives@0.1.12
  - @graview/pages@0.1.12
  - @graview/tools@0.1.12
  - @graview/studio@0.1.12

## 0.1.11

### Patch Changes

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
  - @graview/primitives@0.1.11
  - @graview/layout@0.1.11
  - @graview/pages@0.1.11
  - @graview/react@0.1.11
  - @graview/studio@0.1.11
  - @graview/tools@0.1.11

## 0.1.10

### Patch Changes

- 6b7edf9: A declared lens draws (FR-79). A document's `lenses` were accepted and drew nothing, and so were a TypeScript app's: a lens drew only because the app's own UI called `createTimelineLens(…)` and registered the result with a title, so a chat that wrote a lens into a document made something nobody would ever see. A `lenses` entry now takes a `title`, an `on` (the kind it stands on, when its bindings do not say) and data-only `options`, and a shipped lens with a title is a place: a pill on the bar, a drive-in from altitude and a page at `/places/<as>`, registered over each kind it stands on at many × full and many × summary. `declaredLenses(app)` in `@graview/core` decides which lenses draw, with which factory options resolved from the bindings, and why the rest do not; `SHIPPED_LENSES` names the six it maps — `timeline`, `calendar`, `coverage`, `board`, `plan`, `reach` — with their roles and the options each takes. `registerDeclaredLenses(registry, app)` in `@graview/primitives` (and `@graview/primitives/frame`) registers each as a door to the shipped factory, fetched when a lens is first drawn (`fetchDeclaredLenses`), and `declaredViews(app)` is the defaults, the view specs and the declared lenses in one registry. The embed calls it for every app it mounts, so a document's lenses draw with no views at all. What a factory needs that cannot be data is derived: a timeline's columns from the values its `column` field takes (or `options.columns`), its axis words from its extent, a calendar's `today` from the reader's own clock unless `options.today` names one. `graview check` says why a titled lens cannot draw, at its path — `lens-cannot-draw`, `lens-option-unknown`, `lens-title-taken`, `lens-not-shipped`, every one a warning — and a shipped lens needs no `requiredRoles` or `binds` of its own (`requiredRolesOf`, `bindsOf`). `plan` joins the shipped names in the checker and in `graview describe`, which now says which declared lenses draw, over what, at which address, and why a titled one does not. `placesOf(app)` lists every place an app has — the home, each lens, each kind — as `{ slug, title, kind, cardinality, address, stop, lens?, hidden?, first? }`, for a host to list. Apps/todo, apps/rota, apps/gauntlet and apps/discography declare their shipped lenses with titles and register none of them by hand. The studio keeps two lenses of one name apart by their titles. `@graview/primitives/scene` is a new subpath (the companion, the inspector, the places bar), which the embed's scene face and the pages' assistant import so that a face which draws no lens does not carry the six factories; `@graview/primitives/pages` also exports `registerDefaultViews` and `registerViewSpecs`. The bundle budgets for every face and for the studio handed in rise to 1_400_000 / 412_000, and what a page without the studio loads first to 203_000 gzipped, said in `scripts/lib/bundle-budget.mjs`, which now measures from the page's own entry rather than the first chunk esbuild lists. A hosted page carries 563 KB up front. Unit tests compile a document declaring one lens of each shipped type and find each drawn by its title on the embed's bar and at its page, `check` and `describe` agreeing with the one list; `verify-declared` does it in a browser. The `graview-lens` skill says to declare a shipped lens rather than register it. `capabilities().shipped` names FR-79.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `title`, `on` and `options` are new optional fields of a `lenses` entry, and `requiredRoles` is optional on `LensDeclaration`. The new codes are warnings, never errors, and a declaration that checked clean before still does; a check's `where` names a titled lens by its title. The wire — `capabilities().shipped` gains `FR-79`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `arrange` and `arrangement`, so a hand-built registry needs neither.
- 77a9fdc: A home view from the closed block set (FR-81). The home was always derived, and a document that wrote `views.home` was refused. A declaration's `home` — a document's `views.home`, a list of blocks — is now the home's body on both faces: on the routed face it replaces the derived home under the shell, its first headline the page's `h1`; on the Graview face it stands as a landing over the picture whenever the scene is at home (nothing focused, nothing chosen), at ground level and from altitude, on the side the companion leaves free, put away by going anywhere or by its own button (`HomeLanding` in `@graview/primitives` and `@graview/primitives/scene`, drawn by `Shell` and the embed's scene face). An empty graph still opens on the way in: the home view yields to the beginning until there is a record to show. Three blocks join the set, and work in a card, a row and a page as well as the home: `headline` (a template), `figure` with an expression (`{ figure: "sum(all('package'), net)", as: "number" | "money" | "percent", currency: "USD", label }`; `{ figure: true }` is still the kind's picture), and `list` (`{ list: expr, sort: key | { by, direction: "asc" | "desc" | "choices" }, limit, group: field | { by, headings }, empty, as: "card" | "row" }`), which draws each record with its own card or row spec and makes it a link — a record's address on the routed face (`SpecLinks`), a pick on the scene. Blocks about no one record may not name a bare field and reach records with `all('kind')`; a list's sort key and group are held to the kinds its source reaches. A lens named `blocks` with a title, an `on` and `options.blocks` is a place drawn from the same blocks, so a chat can write a picture with no code (`SHIPPED_LENSES.blocks`). The registry carries the home view beside the places (`registry.home(view)`, `registry.homeView()`), set by `registerDeclaredLenses` and fetched when first drawn (`fetchHomeView`); `graview describe` says the home is drawn from blocks, and the document diff says when the home's look changes. FR-83's gap closes: a kind's `glance` may name a computed field (the card and the list line work it out over the seat's graph), and a `label` or `describe` may name one worked out from the record alone — one that reads beyond the record is refused, since a label is said with no graph in hand. `packages/core/tests/document/fixtures/lifelogics.gdd.json` rebuilds LifeLogics' front page and its four lenses as data; unit tests draw it, and `verify-declared` draws it on both faces at 1440×900 and 390×844 in both schemes. The `graview-pages`, `graview-node-kind` and `graview-lens` skills say how. The bundle budgets rise with measured numbers in `scripts/lib/bundle-budget.mjs`: an embed without the studio to 815_000 / 215_000 (measured 802_562 / 209_988), every face and the studio handed in to 1_430_000 / 424_000 (measured 1_420_964 / 418_572 and 1_414_220 / 413_619); a hosted page carries 584 KB up front, and a face before it draws at most 840 KB (the scene measured 836_810, from 817_424). `capabilities().shipped` names FR-81.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `views.home` as a list of blocks, the `headline`, `list` and expression `figure` blocks, and the `blocks` lens are new; `views.<kind>` as an object of slots reads as before, so a kind called `home` keeps its views. A titled lens named `blocks` was a warning before and draws now; what its blocks cannot say is a warning at its path, never an error. A `label`, `describe` or `glance` naming a computed field was an error and is now accepted where it can be said. New codes (`list-sort`, `list-group`, `list-limit`, `list-as`, `list-empty`, `view-currency`) are errors only on blocks that could not compile before. The wire — `capabilities().shipped` gains `FR-81`. Ops, stored formats and tool schemas are unchanged. `ViewRegistry` gains optional `home` and `homeView`; `RenderContext` an optional `budget`.
- 6852b7d: `pages` is a real arrangement (FR-80). A document's `pages` was accepted and never compiled, and an app had no way to say what its home shows first or where it opens. `pages: { order?, hide?, first? }` (`PagesArrangement`) is now typed, compiled onto the app, given back by `toDocument`, and honoured on both faces. `order` names kinds in the order the routed face's gallery and nav and the city at altitude take them (`orderKinds`); kinds it leaves out follow as declared. `hide` takes kinds off the home only — their cards and counts — and a hidden kind keeps its list, its records, its place in the nav and its search results. `first` names where the app opens: a place by its title or address word, a kind by its name or plural, or `"home"` (`openingOf`). The routed face opens there once, replacing the arrival so Back leaves the app, and the masthead still goes home; the scene opens on it when nothing else was asked (`openingView` in `@graview/react`, which the provider and the embed use). The arrangement travels on the view registry beside the places (`registry.arrange(pages)`, `registry.arrangement()`), set by `registerDeclaredLenses` and carried by `layerViews`, so every face that reads the places reads where they go. `graview check` names a kind in `order` or `hide` that is not there and a `first` that is no place, kind or home — `pages-kind-unknown`, `pages-first-unknown`, warnings at their paths — and `graview describe` says where the app opens, the order and what the home leaves off. Removing a kind in the document editor takes it out of `order` and `hide`, and renaming one renames it there. Unit tests compile a document that orders three kinds, hides one and names a lens first, and find it opening on that lens on both faces with the home in that order and the hidden kind reached by link and by search; `verify-declared` holds the same in a browser. The `graview-pages` skill says how. `capabilities().shipped` names FR-80.
  
  Compatibility: the declaration and check finding codes — additive within `graview-document@1`: `pages` was any object and is now one whose `order`, `hide` and `first` are typed; other keys are still accepted, so a document that compiled before still does. The new codes are warnings. The wire — `capabilities().shipped` gains `FR-80`. Ops, stored formats and tool schemas are unchanged.
- Updated dependencies [39a3983]
- Updated dependencies [7d77ff7]
- Updated dependencies [6b7edf9]
- Updated dependencies [cbe1cc6]
- Updated dependencies [fff6319]
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
  - @graview/pages@0.1.10
  - @graview/studio@0.1.10
  - @graview/tools@0.1.10
  - @graview/layout@0.1.10

## 0.1.9

### Patch Changes

- b5a4bfc: A host speaks in the app's own notices (FR-75). Graview Cloud said "a newer version is available", "offline — changes will be sent when you reconnect", "held while a repair is checked", a conflict with two choices and a refusal's sentence as elements of its own fixed over the app at `z-index: 1000`, in a copy of the framework's floating panel kept in step by hand. The embed's handle now has `notify({ kind: "toast" | "banner", sentence, tone?, action?, actions?, id?, timeout? })`, and so does `@graview/embed/pages`'s. It returns `{ id, dismiss(), update(change) }`. A toast goes by itself after `TOAST_MS` (six seconds; `timeout` says otherwise and `false` keeps it), unless it carries an action, when it waits for one; a banner stays until it is dismissed. A notice said under an `id` already showing takes its place. `tone` is `info` (the default), `good`, `warn` or `bad`, drawn as the notice's edge and dot in the theme's own colours. An action is a press (`onSelect`) or a link (`href`, `target`), the first drawn as the one the notice asks for, and either closes the notice; every notice has a dismiss control. Banners stand at the top of the picture and toasts at its foot, in the floating panel's look and the embed's scheme. Both are in the browser's top layer on the ladder's toast rung (FR-76), and are shown again over any popover of the family that opens after them (`raiseOverPopovers` in `@graview/react`). Each is said aloud as it arrives through a polite live region, and one whose tone is bad through an alert. `createNoticeBoard` and `Notices` in `@graview/primitives` are the board and its drawing: a React host drawing `<Embed>` passes `notices`, and the whole-page `Shell` takes a board as `notices` and draws it over its scene. This is the framework's reading of a request that arrived cut off at "the embed handle exposes `notify({ kind: "toast" | "banner"`": the sentence, the tone, the action, the id and the handle with `dismiss` and `update` are what the rest of that request most plausibly said, and `warn`, `actions` and `timeout` are added for Cloud's offline banner, conflict card and newer-build notice. A unit test says a toast, sees it said aloud and gone, keeps a banner past a minute and changes it in place, says a bad one as an alert, replaces one by id, presses an action and follows a link, and does it on the pages alone. `verify-chrome` says a banner and a toast through the handle on the embed's Graview face at 1440×900 and 390×844, in light and in dark: both are in the top layer, inside the viewport and on top at their middle, in the floating panel at better than 4.5:1, and said aloud. The toast stands over the profile opened after it, goes by itself while the banner stays and changes in place, a bad one is said as an alert, and a dismissed banner is gone. The `graview-embed` skill says to use it. `capabilities().shipped` names FR-75.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-75`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged. `EmbedHandle` and `PagesEmbedHandle` gain `notify`, so a host's own stand-in for either needs one.
- e811d26: A host's own actions are drawn in the profile menu (FR-72). Graview Cloud had nowhere in the embed for "Change the app", "Your apps" and "Report this app", so it kept them in a `<details>` menu of its own fixed over the corner of the scene. `mount(root, { hostActions: [{ label, href }] })` now draws them in the strip's profile menu, under who is signed in, in the order given: each a link (with `target` where it opens elsewhere) or, with `onSelect` and no `href`, a press; a press of either closes the menu. They are stops for the keyboard like everything else in the menu, which takes the keyboard when it opens (FR-77), and they are drawn in the embed's own scheme. `@graview/embed/pages` takes the same option, and so does the whole-page `Shell`; `HostAction` is exported from `@graview/embed` and `@graview/primitives`. A unit test finds the links in the menu of the whole embed and of the pages alone, in order and reachable, and a press that closes it; `verify-chrome` mounts the embed on a host's page with Cloud's three actions and reaches each by the keyboard alone from the profile button, on the Graview and pages faces, at 1440×900 and 390×844, in light and in dark, at better than 4.5:1 against the menu, with nothing of the host's fixed over the embed. The `graview-embed` skill says to put a host's furniture inside the embed, never over it. `capabilities().shipped` names FR-72.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-72`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
- 4e1d6e3: Every popover opens over everything, and everything else stands on one ladder (FR-76). On a hosted app the profile menu opened under the seat's rail and could not be read: each surface picked its own `z-index` in one stacking context, the profile and the problems 20, the rail 40, the altitude control 5, the zoom 8, a menu 60, the studio 100. Now the transient surfaces — the profile, the problems, the activity, the Find box's suggestions, the districts a row could not hold, a card's acts at the pointer, `ChatPanel`'s pill and the studio's own seat — are shown with `showPopover()` in the browser's top layer, which Playwright's Chromium, WebKit and Firefox all have: drawn over every rail, the scene and anything on a host's page, whatever `z-index`, `overflow: hidden` or `backdrop-filter` their ancestors carry, and still inside the element they opened in, so an embed's scoped theme reaches them and nothing lands on the host. In the top layer a pane is placed by what opened it (`useTopLayer` and `placePane` in `@graview/react`): under it, or over it where there is more room above, kept to the viewport, and no taller than the room it has, so what it holds scrolls inside it. Where `showPopover` is missing the pane stands on the ladder's popover rung. Everything that stays on screen takes a named rung from one ladder written once in `@graview/core` (`LAYERS`, `layer(name)`): scene, overview, rail, popover, dialog, toast, which `themeCss` writes on its root or an embed's box as `--graview-layer-<rung>`. The scene's ground is a stacking context of its own, so what orders its plots, cards, lines, figures and zoom (`SCENE_LAYERS`) can never climb over a rail. `POPOVERS` in `@graview/react` names every popover in the family with what opens it and its pane. A test reads every source file of every package and finds no `z-index` written as a number outside the ladder; `verify-chrome` opens every popover of the registry on the embed's Graview and pages faces and on the Shell, at 1440×900 and 390×844 with the seat open, and finds the pane in the top layer, inside the viewport, and under the browser's own `elementFromPoint` at its middle and at its last row. `capabilities().shipped` names FR-76.
  
  Compatibility: the wire — `capabilities().shipped` gains `FR-76`, nothing else on it moves. Ops, stored formats, check codes and tool schemas are unchanged.
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
  - @graview/primitives@0.1.9
  - @graview/core@0.1.9
  - @graview/pages@0.1.9
  - @graview/studio@0.1.9
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
  - @graview/pages@0.1.8
  - @graview/primitives@0.1.8
  - @graview/react@0.1.8
  - @graview/studio@0.1.8
  - @graview/tools@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies [361b5fa]
- Updated dependencies [8b1a5dc]
  - @graview/core@0.1.7
  - @graview/layout@0.1.7
  - @graview/pages@0.1.7
  - @graview/primitives@0.1.7
  - @graview/react@0.1.7
  - @graview/studio@0.1.7
  - @graview/tools@0.1.7

## 0.1.6

### Patch Changes

- a5daad4: A host's refusal is said in its own words, and an Apply with nothing changed asks the host nothing (FR-65). `onApply` could answer `{ ok: false, findings }` (FR-60), which the studio always headed "Not kept: the host could not keep this change. Your edits are still here.", so Graview Cloud said "Nothing changed in the studio." as a finding under a heading about failing to keep something. A verdict may now carry a `sentence`, which the studio says as its heading in place of its own; with one, `findings` may be empty or left out, and no empty list is drawn. Apply with nothing changed, or with every change taken back, no longer reaches the host: the studio says "Nothing to apply: the declaration is as the studio opened it. Change something, then Apply." and stays open. `Studio.unchanged()` reads that from the graph, not the history, so a change undone is no change. The applied panel's `data-applied` gains `unchanged`. Tests in `@graview/embed` hold the sentence as the heading with findings, with an empty list and with none, the studio's own heading where there is no sentence, and `onApply` not called for an untouched studio or one whose change was undone; `verify-studio` presses Apply in a host's page before any change and finds the host handed nothing, then finds the host's sentence heading its refusal. `capabilities().shipped` names FR-65.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-65`. `StudioHostVerdict` widens: a refusal may carry `sentence`, and with it `findings` is optional. A host whose `onApply` was handed an unchanged declaration is no longer called for it. Ops, stored formats, check codes and tool schemas are unchanged.
- 94da01b: The embed's stylesheet keeps to its box (FR-64). `themeCss(scheme, brand, { scope })` put the tokens, the ground and the type on the scope, but every other rule was written for a whole page, so the `<style>` an embed renders still said `h1, h2, h3, h4`, `code, kbd, samp`, `button`, `button:hover:not(:disabled)`, `button:focus-visible`, `button:disabled` and `code` bare: on Graview Cloud's builder the host's own buttons below the studio took the framework's ink on a transparent ground and failed contrast in dark (3.41:1). With a scope, the finished sheet is now rewritten so every selector that does not already start at the box is under `:where(<scope>)`, inside @media and @supports too; `:where` weighs nothing, so each rule wins exactly the contests it won on a whole page, and only where it applies changes. The reader's motion answer is still asked of the document element and applied inside the box, and the registered `--graview-altitude` and the keyframes name no element. Without a scope the stylesheet is byte for byte what it was. A test reads every selector of every rule in the scoped sheet, in both schemes and two brands, and fails on any that could match outside the box; `verify-studio` mounts the studio in a host's page with the host's own `<button>`, `<h2>` and `<code>` below it and finds their computed styles the same as on that page with no embed, in dark and in light. The pages' gallery rule and the prose links' rule are keyed on Graview's own class and attribute, and the studio and the Shell bring no stylesheet of their own. `capabilities().shipped` names FR-64.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-64`. `themeCss` without a scope is unchanged; with one, the same rules in the same order, each held inside the scope. Ops, stored formats, check codes and tool schemas are unchanged.
- Updated dependencies [a5daad4]
- Updated dependencies [94da01b]
  - @graview/studio@0.1.6
  - @graview/core@0.1.6
  - @graview/primitives@0.1.6
  - @graview/layout@0.1.6
  - @graview/pages@0.1.6
  - @graview/react@0.1.6
  - @graview/tools@0.1.6

## 0.1.5

### Patch Changes

- 97f2a0a: A host that keeps the declaration says who is offered the studio (FR-59). `maySeeTheStudio` judges by the app's own policy, which grants the app's people, not its builders: on the vendors app only an owner or a planner may do everything, so an editor Graview Cloud had already let onto its builder was shown no studio, and Cloud's way round it was to hand the embed a store with the policy taken off. Now `StudioPlace` takes `offered`, and the embed's `studio` option passes it through: `true` or `false` is the host's word over the policy's, and a function `(store, principal) => boolean` decides from the store and the seat. Omitted, `maySeeTheStudio` decides as it always has. The app's policy stays on the store for everything else the embed draws. A test opens the vendors app through `mount(…, { studio: { onApply, offered: true } })` as a seat whose only role is `viewer`: the studio is drawn, and `handle.store.policy` is still the app's; without `offered` the same seat is offered nothing; `offered: false` withholds it from an owner. `StudioOffered` is exported from both packages, and `capabilities().shipped` names FR-59.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-59`. `offered` is a new optional prop and option; omitted, who sees the studio is unchanged. Ops, stored formats, check codes and tool schemas are unchanged.
- 1e21d54: A host that refuses a change is heard (FR-60). `onApply` returned nothing, so when the studio handed Graview Cloud a change with `documentFindings` — one no edit says, which Cloud cannot preview — the studio still said "The checker is happy. Handed to the host to keep" while the page around it previewed nothing. Now `onApply` may return, or resolve to, `{ ok: false, findings }`: the applied panel says "Not kept: the host could not keep this change. Your edits are still here." with each finding's path, message and fix, the studio stays open, and its edits are untouched, so Apply again hands the host the same change. A promise is waited for ("Handing it to the host…"), a rejected one is a refusal in its own words, and an answer to an earlier press that arrives late says nothing. Returning nothing or `{ ok: true }` is kept, as before. The panel carries `data-applied` (`kept`, `asking`, `refused-by-host`, `refused-by-checker`) for a harness to read. `StudioOnApply`, `StudioHostVerdict` and `StudioHostAnswer` are exported from `@graview/studio`, and the first two from `@graview/embed`, whose `studio.onApply` takes the same type. A test removes vendor's `notes` through the studio's own actions strip in an embed whose host refuses: the refusal and its finding are shown, "Handed to the host" is not, the studio is still open, and the second Apply hands over `[{ op: "remove-field", kind: "vendor", field: "notes" }]` again. `capabilities().shipped` names FR-60.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-60`. `onApply`'s return type widens from `void` to `StudioOnApply`'s answer; a host that returns nothing is unchanged. Ops, stored formats, check codes and tool schemas are unchanged.
- f1fcf13: A studio in a host's page draws no `<main>` of its own (FR-58). Graview Cloud's builder mounts the studio through the embed's `studio: { onApply }` into an element inside its own page, and the studio drew its picture in a `<main>` inside the embed's labelled section — so axe failed the host on `landmark-main-is-top-level` and `landmark-no-duplicate-main` whatever the host did, since a main inside the embed's region can never be top-level. Now `StudioPlace` takes `landmark: "main" | "region"`, and omitted it follows `within`: a boxed studio, which is every embed's, draws its picture as a region named "The declaration", and a page-filling one keeps its main. The embed's `studio` option takes the same `landmark`, for a host whose whole body is the studio, and its type is exported as `EmbedStudio`. A test builds a page the way Cloud's is (a header, a nav, its main, a footer), opens the studio in it, and runs axe's landmark rules and `region` over the whole document: nothing; with `landmark: "main"` axe reports the two rules Cloud did. `capabilities().shipped` names FR-58.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-58`. An embed's studio draws a labelled `section` where it drew a `main`; a host that selected the studio's `main` selects `[data-testid="studio"] section[aria-label$="The declaration"]`. Ops, stored formats, check codes and tool schemas are unchanged.
- 826e19b: A hosted page carries 536 KB up front, not 1,075 KB, and each face of the embed is fetched as it is first drawn (FR-57). Graview Cloud's shell — `openRemote` and the embed over a document compiled in the browser — loaded every face before the app drew: the scene, the companion, the inspector, the routed face and its router, the chat and the agent's tool surface, and every default view. The embed imported every face outright, and a bundler splits a page by which files its first chunk can reach: the frame took its provider from `@graview/react`, its theme from `@graview/primitives`, and the provider took the reader's rung from `@graview/tools`, and each of those reaches the rest of its package. Now the frame — the region, the theme, the strip, the provider — is what a page loads first, and the scene, the pages and the picture are each a chunk fetched as they are drawn, with the framework's own views beside them. The frame reaches only the narrow entries `@graview/react/provider` (the provider, hooks and view registry without the scene), `@graview/primitives/frame` (the theme, the strip's Profile and Standing, and the framework's views behind doors), `@graview/tools/frame` (the reader's rung, pins and editable fields without the agent) and `@graview/layout/view` (the view state without the city); the routed face reaches `@graview/primitives/pages` and fetches the companion when "Ask" is opened, and a district fetches its arrange row when it is opened full. `scripts/verify-hosted-page.mjs` (`pnpm hosted`, first in `pnpm verify`) builds Cloud's page the way Cloud does and holds it to 600 KB up front and 150 KB of zod; it also says what each face fetches as it draws, 770 KB in all before the scene draws and 729 KB before the pages do.
  
  CI's bundle budgets follow: the pages face alone is held to 530 KB (from 950 KB) and the embed without the studio to 780 KB first loaded (from 1.2 MB); every face, loaded whole, is 11 KB smaller minified and 2.5 KB larger gzipped, its chunks each gzipped alone, so its gzipped budget is raised from 373 KB to 380 KB.
  
  Compatibility: the embed — a change of shape. `mount` returns with the frame on the page and the face on its way: its box stands empty (`aria-busy`) until the face's chunk arrives, and `handle.drawn()` resolves once the face asked for is drawn, after `mount` and after `setFace`. `preload(...faces)`, a new export of `@graview/embed`, fetches faces before they are drawn, and an embed mounted once its face is here draws it in the first commit, as before; with no face named, every face. `onReady` is told when the first face is drawn, not at the frame's first commit, and the new `onDrawn` option each time a face is. The framework's own views in an embed's registry are doors that draw them once fetched (`frameworkViewDoors`, `registerFrameworkViews`, `fetchFrameworkViews`, new exports of `@graview/primitives`); a host's `views` function is handed them as before. `@graview/react/provider`, `@graview/primitives/frame`, `@graview/primitives/pages`, `@graview/tools/frame` and `@graview/layout/view` are new subpath exports — each also exported from its package's main entry — and a product that aliases the framework's packages (a linked project's vite config, which `graview create` writes) aliases them ahead of the bare names. `@graview/embed/pages` is unchanged and still draws in the first commit. Ops, stored formats, the wire, check codes and derived tool schemas are unchanged.
- 5a2086e: A host whose page is the studio hands it in, and waits for no chunk (FR-63). The embed imports its own studio when it is first drawn, which is right for a page that may never open it and a round trip for one whose whole point is the studio: Graview Cloud's builder fetched about 109 kB before the studio drew. Now the embed's `studio` option takes `place: StudioPlace`, imported by the host from `@graview/studio`: the embed draws it in the render that mounts it, with the host's `onApply`, `landmark` and `offered`, and never imports its own. A flag (`eager: true`) could not do this, since what a bundler splits is decided by what the code imports, not by a value, so the studio is handed in instead. `scripts/lib/bundle-budget.mjs` reads which `@graview/*` packages esbuild's metafile leaves in a chunk the entry does not import outright, and a new budget, "embed with the studio handed in", fails when any `@graview/studio` module is in one (`lazyLacks`); `pnpm pack:inspect` holds it with the others. A jsdom test mounts an embed with a stand-in handed in and finds it drawn in the first render, and the embed's own studio never imported. The graview-embed skill says when to hand it in, and what `onApply` may answer. `capabilities().shipped` names FR-63.
  
  Compatibility: the wire — additive: `capabilities().shipped` gains `FR-63`. `place` is a new optional field of the embed's `studio` option; without it the studio is fetched when drawn, as before. Ops, stored formats, check codes and tool schemas are unchanged.
- Updated dependencies [f989024]
- Updated dependencies [97f2a0a]
- Updated dependencies [1e21d54]
- Updated dependencies [281761b]
- Updated dependencies [a83a311]
- Updated dependencies [f1fcf13]
- Updated dependencies [9787063]
- Updated dependencies [826e19b]
- Updated dependencies [e22a00d]
- Updated dependencies [5a2086e]
- Updated dependencies [6ff733b]
- Updated dependencies [76df9ba]
  - @graview/studio@0.1.5
  - @graview/core@0.1.5
  - @graview/primitives@0.1.5
  - @graview/react@0.1.5
  - @graview/tools@0.1.5
  - @graview/layout@0.1.5
  - @graview/pages@0.1.5

## 0.1.4

### Patch Changes

- cc889f4: A typed app fits wherever an app goes, with no cast. A consumer's TypeScript met four walls that the framework's own code got past with `as never` and `as unknown as GraviewApp<AnySchema>`. `installation.mutations` would not spread into an app's mutations. A typed app was not an app: `GraviewApp<S>` would not widen to `GraviewApp<AnySchema>`, because an act's `apply` and `describe` and a rule's `evaluate` were function-typed properties, checked contravariantly — so the studio's readers (`graphToDeclaration`, `migrationBetween`, `sourceChanges`, `declarationFiles`), `createStoreHandler` and the embed could not be handed one. `schema.definition(kind)` on a schema whose kinds are only `string` was `never`. And an unbound `defineInvariant` handed its rule a `never` subject. Now `apply`, `describe` and `evaluate` are declared as methods, so a typed app and its acts and rules widen; `installation.mutations` spreads into any app's mutations; `definition(kind)` answers the kind's definition, any definition of that kind on `AnySchema` (`DefinitionOfKind`); an unbound rule's subject is a node of its kind (`NodeOfKind` on `AnySchema`), its fields `unknown` until bound; and `reachLens.View` is the generic view it always was, so it registers on any app. The casts are gone from the studio, the store handler, the embed, `@graview/core/testing`, the launcher and the example apps, and type-level tests hold each wall down.
  
  Compatibility: types only, nothing at run time changes. Every type is wider than before except one: `apply`, `describe` and `evaluate` lose `readonly` (a method cannot be marked so), so code that reassigned one is now allowed to, where it was refused. `DefinitionOfKind` is a new exported type. A call such as `syncConflictInvariant()` beside a typed schema may now infer `AnySchema` where it inferred the schema, and wants `syncConflictInvariant<typeof schema>()`. The wire, ops, stored formats and check codes are unchanged.
- 0fb76b7: An embed loads the studio when the studio is turned on, not before. `@graview/embed` imported `StudioPlace` outright, so every hosted page carried the studio — about 110 kB minified, 35 kB gzipped — including an embed mounted with `studio: false`, which never draws it. The studio is now imported with `import()` behind `React.lazy` and `Suspense`, inside the boundary it already drew behind: a product's bundler splits it into a chunk of its own, a page fetches it only when an embed offers the studio, and until it arrives the strip has no studio on it yet (a chunk that fails to load is said by that boundary, like a studio that throws). `scripts/inspect-pack.mjs` now bundles the embed split as a product's bundler would, and holds a new budget, "embed without the studio": what a page loads first, 1,175,514 bytes minified and 329,683 gzipped, budgeted at 1,200,000 / 337,000, which fails if any module of `@graview/studio` is in it. "Every face" — every chunk, studio included — did not fall: the studio now carries `compileDocument` to judge a document by compiling it (about 26 kB minified, 9 kB gzipped), and its chunk is gzipped on its own (about 2 kB and 3 kB more), so it measures 1,285,784 / 365,101 (1,259,216 / 354,049 before) and its budget rises from 1,290,000 / 362,000 to 1,310,000 / 373,000.
  
  Compatibility: `mount`'s options and handle are unchanged; the studio's button appears a moment after the embed does, once its chunk arrives, where it appeared with the first render. A bundler that does not split puts the studio back in the one file, as before. `StudioApplied` is still exported as a type. Ops, stored formats, the wire and check codes are unchanged.
- Updated dependencies [df9932a]
- Updated dependencies [9de42fe]
- Updated dependencies [a9c0f2d]
- Updated dependencies [a814d97]
- Updated dependencies [75c1a26]
- Updated dependencies [e0f75bb]
- Updated dependencies [d496926]
- Updated dependencies [833e390]
- Updated dependencies [c5b36f7]
- Updated dependencies [53857e9]
- Updated dependencies [fdf82ed]
- Updated dependencies [be20407]
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
- Updated dependencies [6d324a0]
- Updated dependencies [180452e]
- Updated dependencies [ba950f3]
- Updated dependencies [1f260a7]
- Updated dependencies [062fe46]
- Updated dependencies [0497bbf]
  - @graview/core@0.1.4
  - @graview/studio@0.1.4
  - @graview/tools@0.1.4
  - @graview/layout@0.1.4
  - @graview/react@0.1.4
  - @graview/primitives@0.1.4
  - @graview/pages@0.1.4

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
  - @graview/primitives@0.1.3
  - @graview/layout@0.1.3
  - @graview/pages@0.1.3
  - @graview/studio@0.1.3
  - @graview/tools@0.1.3

## 0.1.2

### Patch Changes

- 55f8b27: An embed holds inside a chat's widget. `mount` takes `height: "auto"` and `onIntrinsicHeight`, and tells the host the height it asks for as it changes: the strip and the whole page on the pages face, the strip and the picture's box on the others. It takes `hostContext: { theme }` over the page's own scheme, and `scheme: "auto"` now follows the host page's `data-theme` and the system's preference as they change rather than reading them once. `pagesBelow` gives the scene and the Graview way to the pages face below a width. `remote` takes a store from `openRemote` and its presence. `memory` keeps the reader's settings and the tab's session where the host says, and a frame whose `localStorage` and `sessionStorage` throw still mounts. The routed face no longer asks for a window's height when embedded, which grew a frame sized from its content without end.
  
  Presence speaks one dialect and forgets the gone. `participantKey` and `parseParticipant` name the `kind:id:session` format the op log, the figures and the wire share. What a presence channel reports is dropped once its last word is older than `REMOTE_PRESENCE_TTL_MS`, whether or not the channel says the person left. A people directory (`people` on `mount`, `GraviewProvider` and the pages' context, `Person` in core) names authors in the rail, the pages, the profile and presence without offering anybody a seat, so a hosted reader sees no seat switcher and no "Sit as somebody else"; `nameOfAuthor` reads it after the seats. The handle gains `setPeople`, `setSeats` and `setHostContext` (FR-13).
  
  Compatibility: additive for the wire — `participantKey` writes the key the served store already wrote, and `openRemote` keeps the TTL it had, now named `REMOTE_PRESENCE_TTL_MS`. `EmbedOptions` gains optional `people`, `hostContext`, `remote`, `memory`, `presenceTtlMs`, `onIntrinsicHeight` and `pagesBelow`, and `EmbedHandle` gains `setPeople`, `setSeats` and `setHostContext`, which a host implementing the handle itself must now provide. Changed in meaning: an embed with `scheme: "auto"` follows the host's scheme after mount, and a figure's own name in presence is the one `nameOfAuthor` gives (a seat's label, a directory's name, `Principal.name`) where it was the principal's id. Ops, stored formats, the declaration and derived tools are unchanged.
- 6ea13f7: An embed knows what its host can keep. `mount({ studio: false })` leaves the Studio place off the strip, for a hosted reader who could change a declaration that would never be saved. `mount({ studio: { onApply } })` keeps it and hands the host what the checker passed (`StudioApplied`: the app, the migration and the files), asking after no dev-server door and writing nothing itself; `StudioPlace` takes the same `onApply`, and `useStudioDoor(null)` asks nobody. `@graview/embed/pages` mounts the routed face alone, without the scene, the lenses or the studio: bundled for the browser without React it is about 730 KB minified (195 KB gzipped), where every face is about 1.05 MB (300 KB). `node scripts/inspect-pack.mjs` bundles both and fails when either passes its budget, and a linked project's Vite config aliases the new entry (FR-19).
  
  Compatibility: additive — `EmbedOptions.studio`, `StudioPlace`'s `onApply`, `StudioApplied` and the `./pages` entry are new, and an embed without `studio` offers the Studio as before. `EmbedOptions` is now `FrameOptions` (exported) plus the scene's own options, with the same fields. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
- a634594: An embed reports what went wrong and how long it took, without what was on screen. `mount` and `@graview/embed/pages` take `onError(error, { module, face })` and `onReady({ ms, face })`. Each face, the strip and the studio's place on it draw behind a boundary: what throws says it could not draw and offers to try again, and the rest of the embed keeps working, so a page that throws leaves the strip and the scene a press away. The host is told the error's class (`EmbedError`) and the framework module that caught it, never the message, which may quote a record. A view's own boundary in the scene reports the same way: `ViewBoundary` tells the `ErrorReportContext` above it, which `@graview/react` exports. `onReady` is told once, after the first render, how many milliseconds it took (FR-24).
  
  Compatibility: additive — `onError`, `onReady`, `EmbedError`, `EmbedErrorWhere`, `EmbedReady`, `ErrorReport` and `ErrorReportContext` are new, and a view that throws with no report above it is said on the console as before. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
- The pages alone draw the app's views, and a view that throws on a page says so in its own place. `@graview/embed/pages` takes `views(schema, registry)` as `mount` does. Its pages draw from the same registry: the framework's defaults, the declaration's view specs, then the host's own (FR-35 on the pages-only entry). The pages face of `mount` gets the registry, the app's settings and presence through the same `PagesContent`. `mount` takes `heading` (FR-25) beside the frame options. On the pages, a lens or a kind's own group view that throws draws behind a `ViewBoundary`, as it does in the scene. The rest of the page keeps working, and the host's `onError` hears of it (FR-24).
  
  The pages-only bundle's budget is raised from 765 kB to 815 kB minified, and from 205 kB to 220 kB gzipped. The growth is the default views and view specs the pages now draw from: about 48 kB minified and 15.5 kB gzipped.
  
  Compatibility: additive — `views` moves from `EmbedOptions` to `FrameOptions`, so both entries take it. Ops, stored formats, the wire, the declaration and derived tools are unchanged.
- afcb06d: The workbench can be found by its headings. The seat, the inspector at the pointer, the activity and the places each open with a heading named as their landmark is, so a screen reader moving by headings reaches every region a person goes to.
  
  An embed's workbench says its name in a heading too. axe's `page-has-heading-one` failed on every embedded workbench in both schemes. `mount({ heading })` sets the level: `1` when the host's page is the app, `2` by default inside somebody else's article, and `false` when the host's own heading names it. The pages face has its own h1 and is not given a second (FR-25).
  
  Compatibility: unchanged for ops, formats, the wire and tools. `EmbedOptions.heading` is a new optional field, and an embed with no `heading` now carries an h2, which is not visible on the page.
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
- Updated dependencies
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
  - @graview/pages@0.1.2
  - @graview/studio@0.1.2
  - @graview/tools@0.1.2
  - @graview/react@0.1.2
  - @graview/layout@0.1.2

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
