# Releases

This is what came in each Graview version, newest first, in a few plain lines for deciding whether to upgrade. Every `@graview/*` package and `graview` share one version, so each version is said once.

Each version links its release and its full changelog. **Before you upgrade** says what breaks or moves for a host; [Stability](https://graview.dev/docs/stability.html) says what a version may change at all.

- [`0.1.36`](https://graview.dev/docs/releases.html#v0-1-36)
- [`0.1.35`](https://graview.dev/docs/releases.html#v0-1-35)
- [`0.1.34`](https://graview.dev/docs/releases.html#v0-1-34)
- [`0.1.33`](https://graview.dev/docs/releases.html#v0-1-33)
- [`0.1.32`](https://graview.dev/docs/releases.html#v0-1-32)
- [`0.1.30`](https://graview.dev/docs/releases.html#v0-1-30)
- [`0.1.29`](https://graview.dev/docs/releases.html#v0-1-29)
- [`0.1.28`](https://graview.dev/docs/releases.html#v0-1-28)
- [`0.1.27`](https://graview.dev/docs/releases.html#v0-1-27)
- [`0.1.26`](https://graview.dev/docs/releases.html#v0-1-26)
- [`0.1.25`](https://graview.dev/docs/releases.html#v0-1-25)
- [`0.1.24`](https://graview.dev/docs/releases.html#v0-1-24)
- [`0.1.23`](https://graview.dev/docs/releases.html#v0-1-23)
- [`0.1.22`](https://graview.dev/docs/releases.html#v0-1-22)
- [`0.1.21`](https://graview.dev/docs/releases.html#v0-1-21)
- [`0.1.20`](https://graview.dev/docs/releases.html#v0-1-20)
- [`0.1.19`](https://graview.dev/docs/releases.html#v0-1-19)
- [`0.1.18`](https://graview.dev/docs/releases.html#v0-1-18)
- [`0.1.17`](https://graview.dev/docs/releases.html#v0-1-17)
- [`0.1.16`](https://graview.dev/docs/releases.html#v0-1-16)
- [`0.1.15`](https://graview.dev/docs/releases.html#v0-1-15)
- [`0.1.14`](https://graview.dev/docs/releases.html#v0-1-14)
- [`0.1.12`](https://graview.dev/docs/releases.html#v0-1-12)
- [`0.1.10`](https://graview.dev/docs/releases.html#v0-1-10)
- [`0.1.9`](https://graview.dev/docs/releases.html#v0-1-9)
- [`0.1.8`](https://graview.dev/docs/releases.html#v0-1-8)
- [`0.1.7`](https://graview.dev/docs/releases.html#v0-1-7)
- [`0.1.6`](https://graview.dev/docs/releases.html#v0-1-6)
- [`0.1.5`](https://graview.dev/docs/releases.html#v0-1-5)
- [`0.1.4`](https://graview.dev/docs/releases.html#v0-1-4)
- [`0.1.3`](https://graview.dev/docs/releases.html#v0-1-3)
- [`0.1.2`](https://graview.dev/docs/releases.html#v0-1-2)
- [`0.1.0`](https://graview.dev/docs/releases.html#v0-1-0)

## 0.1.36

Published October 18, 2026

A record's pictures load under the host's base on every face, and a view draws the pictures and app images it was promised.

- **Pictures load where the host serves them.** An app served under a path (`/a/<app>/`) drew its records' pictures and documents from the site's root; `HostFiles.src` now says where, and `filesAt` works it out from its own address, so a host that already uses it needs no change.
- **Views get their pictures.** A view that asks for pictures receives each image's `src`, live and in a preview, and a picture the host doesn't answer for is said with what the host answered.
- **Views draw the app's own images in every form** they are written in, and a refusal only offers what the host actually draws.

**Before you upgrade:** `HostFiles` takes `src`; `fileSrc` on `@graview/core`; views take `file`; `runWorkerViewHeadless` takes `asset` and `origin`; `sayRefusal` takes the host's `{ origins, assets }`. The guest host's first load is about 0.4 KB larger.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.36) · [The full changelog for 0.1.36](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0136)

## 0.1.35

Published October 18, 2026

A relation to another app can be made by an edit, a host may say later whether it still keeps a file, and playback asks for a past declaration when it gets there.

- **A cross-app relation from an edit.** The `add-relation` edit, the studio and anything that sends edits can now relate a kind to another app's kind (`"to": ["@nick/house/house"]`), refused with the checker's own words when it can't be. Migrations no longer drop such a relation's links.
- **Files a host answers for later.** `HostFiles.kept` may return a promise: a picture is drawn as itself until the host answers, then as removed later if it was, and each file is asked once.
- **Past declarations on demand.** Playback asks the host for a past version's declaration when it reaches it (`declarationAt`), so a page no longer carries every version up front.

**Before you upgrade:** `add-relation` accepts a `to` of `"@<address>/<kind>"`. `HostFiles.kept` may return `Promise<boolean>`. `HistoryHost` takes `declarationAt`. Nothing breaks; the hosted page carries about 0.5 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.35) · [The full changelog for 0.1.35](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0135)

## 0.1.34

Published October 18, 2026

The right-click menu tells a visitor how to get in, draws a panel where it was asked, spends no thinking-model call on opening, and is ready before the click.

- **A visitor is told how to get in.** A host passes `signIn` while nobody is signed in; a reader who may do nothing sees one sign-in row in the menu and at a list's foot instead of every act struck through, and is not offered Notify me.
- **A panel drawn from the menu stays on its face.** On Pages, "Draw a panel" opens the draft page with Keep as a lens and Discard; over the scene the draft is framed as a panel; a failed ask is said in the menu.
- **Opening a menu costs nothing.** With only a thinking model, suggestions wait for a "Suggest…" press; with a Fast slot they are asked once per record until it changes.
- **The menu is ready before the click.** Resting on a record, focusing it or touching it prepares its menu, so it opens complete.
- **The eleventh walk** (an animal shelter at real size) found six problems, all fixed: finding a past record by name, filtering a status board, offered repairs that were refused, a misnamed heading, Tab from a chosen box, and the scaffold's own test under a policy.

**Before you upgrade:** `mount`, `<Embed>`, `GraviewProvider` and `PageContext` take `signIn` (`SignIn` from `@graview/core`). `HostAi.suggestOnOpen` is new; with only a thinking slot the menu no longer suggests as it opens. The hosted page carries about 0.2 KB more up front.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.34) · [The full changelog for 0.1.34](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0134)

## 0.1.33

Published October 17, 2026

A read-only calendar takes its own changes under a policy, and a host keeps Notify me in its own store.

- **A read-only connection works under a policy.** A calendar the app only reads now brings its own changes in when the app declares who may do what, and a change the app refuses is reported as refused rather than as the calendar being unreachable.
- **Notify me on a hosted page.** `mount` takes the host's subscription store, so subscriptions made from the right-click or a record page are kept by the host on both faces; keeping them that way adds no parser to the first load, about 9.4 KB less than before.

**Before you upgrade:** `SyncReport.refused` may now name an inbound change (`SyncRefusal`, with the remote `resource` and `id`), and `offline` is true only when the remote itself fails. `mount` and `<Embed>` take `subscriptions`.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.33) · [The full changelog for 0.1.33](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0133)

## 0.1.32

Published October 17, 2026

Ask with ⌘K and the right-click, be told when things happen, a faster first load, the GPU by default, and a Google calendar kept in step.

- **The AI where you are working.** ⌘K opens a bar beside what you're on that completes its acts, places and records; anything else is asked, and the answer is a card beside the record or list. The right-click offers suggestions, fills, new records and panels, picked only from what you may see and do. Every proposed change is previewed first, accepted all or some, and undone in one step, and Activity keeps each AI interaction.
- **Notify me.** Subscribe to an act, a kind or a record in two presses from a right-click, a record page or chat. A change by someone else that you may see tells the host once.
- **Faster.** First load to interactive is 31–38% faster on a desk and on a slowed phone, held by a CI budget, and the scene draws on the GPU where the browser can, with unfocused planes blurred.
- **Dates and calendars.** One date and date-time editor everywhere that reads "tomorrow 3pm" or "Fri 10:30" and shows times in your zone. A Google calendar can be declared in the app (a calendar, a color or #tag filter, read-only or both ways) and kept in step by `graview serve`, proven against Google itself.
- Twelve controls covered by another were fixed, and graview.dev shows the inline AI and gains this page.
- **Fewer presses to add a record.** A list's Add button now stands beside its heading, so making a record from the keyboard on the pages takes 10–14 presses where it took 17–22.
- **The GPU only where clicks land.** A Chrome whose capture build would hit-test where a view was laid out rather than where it was drawn now draws on the DOM path, so a press, a screen reader and a focused field always meet what is on screen.
- **Signs, panels and embeds that stay out of the way.** A sign at the map's edge steps past a district's name, "Go to it" hands the keyboard straight on to the record it went to, a lens is drawn in the room it has from its first frame, and an embedded app draws nothing over its host page.

**Also in it: 0.1.31**, which was versioned and never published, so its changes shipped here. Ask with ⌘K and the right-click, be told when things happen, a faster first load, the GPU by default, and a Google calendar kept in step. The quick ask and the right-click AI, notify me, a faster first load, the GPU by default, one date editor and a Google calendar kept in step, all described under 0.1.32.

**Before you upgrade:** The old seat's input, its panel and their settings are removed, along with the routed face's own copy: `quickAsk` replaces their setting on the Shell, the pages and the embed, and `quickAskOf` reads a stored one. The full list of removed names is in the changelog. The Shell's and the embed's `renderer` defaults to `auto`. A document's `datetime` is asked for with the date editor. The hosted page carries about 3.5 KB more up front (1.3 KB gzipped).

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.32) · [The full changelog for 0.1.32](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0132)

## 0.1.30

Published October 15, 2026

Play an app back, link across apps, an actor that tidies, and graview.dev as a Graview app.

- **Playback.** Open the app as it stood at any moment, and restore it to there.
- **Linked records.** A relation can point at a kind in another app, read there as whoever is looking.
- **An actor that tidies.** The app's own actor suggests fixes, which a person accepts or declines.
- A first look for a new app, an emoji as the app's mark, kind lists you can sort and group, navigation with filters and sections, a right-click menu on Pages and images by URL.
- Eighteen author requests and a run of scene and lens bugs fixed, a screen-reader pass, and the GPU path past 128 live views. graview.dev itself is now a Graview app.

**Before you upgrade:** `Store.at` and `Store.seqAt` are replaced by `pastOf` and `seqAt` on the new `@graview/core/past`. A role that removed, archived or merged other people's records only through the act that makes the kind now needs those acts named in its grant.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.30) · [The full changelog for 0.1.30](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0130)

## 0.1.29

Published October 14, 2026

A large release of field types, list tools and data features, on a lighter page.

- **New field types:** links to another app, Markdown text, phone, place and duration, and money, percent and unit formats; dates and numbers said the US way.
- **Records:** archive and merge records, lineage and provisional links, repeating dates, field-level sight, acting on several records at once, and `importRows` for bringing data in.
- **Lists:** fuzzy search, filters that scale to large lists, and cards you can read at a glance.
- `renderPlace` writes a place as static HTML, guest views can show pictures, and `store.tick` reports what changed.
- The map is laid out along the ground, and the hosted page is lighter up front than 0.1.28 despite everything added.

**Before you upgrade:** Breaking for imports: `edgeWords` and `valueWords` move to `@graview/core/words`, and the address helpers (`withShown`, `withQuery` and the rest) move out of `@graview/layout`; nothing is aliased. The scene's map is laid out anew, so a `sceneThumbnail` draws a different picture. Ops, stored formats, the wire and tool schemas are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.29) · [The full changelog for 0.1.29](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0129)

## 0.1.28

Published October 13, 2026

The people kind, grants and sights are named edits.

`editDocument` gains `set-people`, `add-grant`, `remove-grant`, `add-sight` and `remove-sight`, so who may do and see what can be changed as a named, previewed edit instead of a raw patch. Each is previewed in words and refused with the checker's own codes.

**Before you upgrade:** Ops, stored formats, the wire, the document format and check codes are unchanged. The edit vocabulary gains five ops, and an edit's refusal can now carry a specific code where every refusal was `edit`.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.28) · [The full changelog for 0.1.28](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0128)

## 0.1.27

Published October 12, 2026

People in a document, bounded seat reads, and links that say why they did not go.

- A document can name the kind that stands for its people, and its acts can say `$me` for the person acting.
- A grant can hold to your own end of a link, and a sight can reach the records that link to you.
- A seat's reads are bounded, and a worker view's link or navigate says why it did not go.

**Before you upgrade:** Breaking: `answerSeenBy` moved to its own entry, the read tools' answer shapes changed, `useSeatConversation` requires `said`, and `$me` is reserved as an argument name.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.27) · [The full changelog for 0.1.27](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0127)

## 0.1.26

Published October 12, 2026

Pictures and files on records, and a failed AI turn says why.

A kind can carry pictures and documents: `imageField()`, `fileField()`, the image block, and uploads through the host's files seam. When a host's AI turn fails, the seat shows the host's own explanation.

**Before you upgrade:** Breaking for imports only: the form helpers (`formFields` and its neighbors) moved to their own entry. Ops, stored formats, the wire, the document format and tool schemas are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.26) · [The full changelog for 0.1.26](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0126)

## 0.1.25

Published October 12, 2026

The app on a phone: the seat closes and the screen fills.

On a phone, the open seat is put away by its close button, a tap on its grab line or a pull down, and the keyboard goes with it. An app fills the phone after it rotates.

**Before you upgrade:** Tool schemas move to `@graview/core/json-schema`.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.25) · [The full changelog for 0.1.25](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0125)

## 0.1.24

Published October 12, 2026

Every seat judged over what it sees, problems that open on their fix, and a fit on the smallest phone.

- What a seat is told is worked out over what that seat can see.
- Pressing a problem opens its repairs, wherever the record sits, and a record is renamed by pressing its name.
- The bar and the home's counts fit a 320-pixel phone at the largest text size.
- Names, yes-or-no fields and facts read in plain words. Also sync fixes.

**Before you upgrade:** Ops, stored formats, the wire, the declaration, check codes and tool schemas are unchanged; only where some types are declared moved.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.24) · [The full changelog for 0.1.24](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0124)

## 0.1.23

Published October 11, 2026

The seat's turn, without the weight.

`turnThroughMessages` has its own entry, `@graview/tools/turn`, under 2 KB, so a host can wire the seat's turn up front without loading the whole tools package on first paint.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.23) · [The full changelog for 0.1.23](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0123)

## 0.1.22

Published October 11, 2026

Preview and doctor, typed documents, and a seat that reads before it answers.

- `graview preview` serves a document and a seed with Graview's own faces over them, no product needed, and `graview shots` photographs places headless.
- `graview doctor` says whether a product is on one Graview release.
- Documents are typed from the editor to the face, can declare facts about the whole graph, and give kinds a natural time and author field. Declared blocks have stable keys.
- The seat reads records with tools before it answers, the sync engine resolves conflicts as it is told, and kinds with no records fold into More.
- A security and correctness review of 0.1.21.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.22) · [The full changelog for 0.1.22](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0122)

## 0.1.21

Published October 11, 2026

Who's here on every bar, axe-clean markup, and a way back in the scene.

- Who else is here shows on the bar on both faces and on a phone.
- The framework's own markup passes axe-core for WCAG 2.0 to 2.2 A and AA, at desktop and phone widths, light and dark.
- The scene gets its own way back, and the overview has an address that survives a server round trip.
- A broken rule states its values to a host that reads only its message, and a read-only role is no longer warned for doing nothing.

**Before you upgrade:** Ops, stored formats, the wire, the document and compiled formats, check codes and tool schemas are unchanged; some presence and test-id behavior a harness reads moved.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.21) · [The full changelog for 0.1.21](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0121)

## 0.1.20

Published October 10, 2026

List pages lead with their records, and rules read like sentences.

- A list page puts its records first instead of a tall header of title and related links.
- A rule written in the rule language says its shape in plain words.
- An agent opening a new product finds what to read at the root.
- Fixed: a connect that replaces now replaces the right link, one mistake gives one check finding, and the scene from an empty address lands where the scene opens.

**Before you upgrade:** Additive: the document format gains an optional `pages.primary`, and check gains two warnings about it. Which places stand on the bar changed.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.20) · [The full changelog for 0.1.20](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0120)

## 0.1.19

Published October 9, 2026

The seat floats, takes you where you ask, and draws views you can keep.

- The seat is no longer a rail down the scene's edge: it floats, quietly, on both faces.
- Ask it to go somewhere and it goes, matching the request against what the declaration and the graph already name, without a model.
- Ask it for a way of seeing and it drafts a view that can be kept as a lens. Who-and-when questions are answered from the graph with no model.
- The host chooses the AI once, instead of the reader picking from a menu. The whole-page shell wears the one app bar, and the hosted page carries 9.5 KB less before the app draws.

**Before you upgrade:** Breaking for the components and API a host's seat reaches: the `Companion` family is removed for the floating seat and `HostAi`. Ops, stored formats, the wire, the document format and tool schemas are unchanged.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.19) · [The full changelog for 0.1.19](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0119)

## 0.1.18

Published October 8, 2026

A lens picker in the scene, and prose that reads like prose.

The scene gets its own place control. A selected record is drawn once. Long text keeps its paragraphs. Parts that fail to load retry safely (`@graview/core/retry`), and no import cycles run at load time.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.18) · [The full changelog for 0.1.18](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0118)

## 0.1.17

Published October 8, 2026

Graview's identity, and Scene and Pages side by side.

The framework's own look follows the third revision of its design kit and is exported as data. The scene and the pages read as two things on the bar.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.17) · [The full changelog for 0.1.17](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0117)

## 0.1.16

Published October 8, 2026

One app bar, and brands you can edit by name.

One bar on every face, with the scene as a place beside the others. Named acts for an app's name and brand, contrast refusals that name the failing pair of colors, icon-sized app pictures, and search results that carry their address. The framework now spells in American English.

**Before you upgrade:** Breaking: names spelled the British way are renamed with no aliases (`normalize`, `summarize`, `humanizeField`, `colorsIn` and others). The undo dock is a fixed popover rather than a box in the page's flow.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.16) · [The full changelog for 0.1.16](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0116)

## 0.1.15

Published October 7, 2026

Clearer refusals, one problem count.

Refusals that come from a rule now say so. The number of problems appears in one place. A host can hand the page an already compiled app.

**Before you upgrade:** Breaking for a caller that sent an act an argument it does not declare: it was dropped and the act ran; now it is refused as `invalid`, naming what the act takes.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.15) · [The full changelog for 0.1.15](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0115)

## 0.1.14

Published October 7, 2026

Ranges, derived edits and fewer pills.

Number fields declare their ranges. A derived edit per kind covers every field nothing else sets, and refuses what it cannot take. A design pass, from building a real product, took words out of capsules.

**Also in it: 0.1.13**, which was versioned and never published, so its changes shipped here. Status-board moves and an address bar for the routed face. A status board's columns say which lens they are in, and an act that sets the board's field is offered as a move. Scene thumbnails can be fitted to what stands. A host whose page is the app can give the routed face the browser's address bar.

**Before you upgrade:** The arrangement functions moved from `@graview/core` to `@graview/core/arrange`. From 0.1.13: `@graview/react/provider` no longer exports `UrlSync`, `useUrlSync` or `adjustment` (`@graview/react` still does).

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.14) · [The full changelog for 0.1.14](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0114)

## 0.1.12

Published October 6, 2026

A lighter hosted page: the checker and the seat's tools leave the main entry.

What only a fetched face, an agent's seat or the checker uses moved out of `@graview/core`'s main entry into subpaths named for what they hold, so a hosted page loads less up front.

**Also in it: 0.1.11**, which was versioned and never published, so its changes shipped here. A status board lens, currencies, and set walks in the rule language. A shipped `columns` lens draws a kind's records as a status board. Money fields take a currency, and the app has a default one. Figure labels are templates. The rule language walks a relation from every member of a set. The checker warns when an act reads a kind a role may not see.

**Before you upgrade:** Breaking for imports, with no aliases: `checkApp`, `formatFindings`, `describeApp` and the docs generators move to `@graview/core/check`, and other names to their own subpaths. From 0.1.11: `@graview/primitives/frame` exports `themeBaseCss` in place of `themeCss`, and a worker view's failure reads `start` where it read `refused`.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.12) · [The full changelog for 0.1.12](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0112)

## 0.1.10

Published October 6, 2026

Declared lenses and homes, and worker views you can trust with HTML.

- A lens, a home view and the arrangement of pages declared in a document now draw, and a view can list related records.
- The rule language computes what pages need (sums over expressions, sorting), and kinds can declare computed fields.
- A worker view can draw HTML, SVG and CSS with nothing able to fetch or leave its region; it needs no build, is a named place with a manifest the host enforces, stops past its limits, and can be run once headless to say what it drew.
- `describePlace` says what one place shows one seat, without a browser. Every new document feature has an edit.

**Before you upgrade:** Additive within the document format and check codes. The guest-view protocol gains messages; derived tools gain one read tool, `describe_place`.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.10) · [The full changelog for 0.1.10](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#0110)

## 0.1.9

Published October 5, 2026

A host speaks in the app's own notices, menus and pictures.

A host can show its notices in the app's own voice, put its own actions in the profile menu, and draw a picture of an app without a browser. Every popover opens above everything else and behaves the same way, and the seat's rail can be put away.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.9) · [The full changelog for 0.1.9](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#019)

## 0.1.8

Published October 5, 2026

Guest views run in a worker, for chats that cannot nest a frame.

A guest view can run in a worker as well as a frame, hardened before guest code runs and built as one classic script. The component kit it draws with is declared once and the host draws nothing else. A host says where its links may go, and a guest that stops answering is stopped.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.8) · [The full changelog for 0.1.8](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#018)

## 0.1.7

Published October 5, 2026

A read-only app says so.

An open page is told that the app takes no changes for now, and why. An op that names a missing record is served as it is.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.7) · [The full changelog for 0.1.7](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#017)

## 0.1.6

Published October 4, 2026

A host's refusals in its own words, and an embed that keeps to its box.

A host can refuse a change in its own words, an Apply with nothing changed asks the host nothing, and the embed's stylesheet stays inside its element.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.6) · [The full changelog for 0.1.6](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#016)

## 0.1.5

Published October 4, 2026

The studio in a host's page, and half the weight.

A field changes in place in the studio, the host decides who is offered the studio and can refuse a change, and what the studio will not change is said up front. A hosted page carries 536 KB up front instead of 1,075 KB, with each face fetched as it is first drawn, and the framework builds its schemas in zod/mini.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.5) · [The full changelog for 0.1.5](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#015)

## 0.1.4

Published October 4, 2026

Security: a seat learns nothing about records it may not see.

- A seat is never served the id of a hidden record, and no refusal, sentence or checkpoint reveals whether one exists.
- A change is acknowledged only once it is durable, a busy host's wait is read correctly, and a hibernating host can resume its sockets.
- Refusals on the wire are written for people, and the studio hands a host back a document.

**Before you upgrade:** The wire and live protocols narrow what a seat with sights is sent; no field is added or removed. `remove-kind` removes more of what depended on the kind.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.4) · [The full changelog for 0.1.4](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#014)

## 0.1.3

Published October 4, 2026

A live store a host can run, observe and deploy.

Refusals carry a code a program can branch on, a busy host is told apart from a refusal, presence can include agents, the declaration can change under open tabs, a remote client can be observed and can catch up, and the wire says when the client and server are on different builds.

**Before you upgrade:** Breaking for a client that named its own channel: `via` in a call is ignored, and a client sends `x-graview-via` to a server that trusts seat headers.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.3) · [The full changelog for 0.1.3](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#013)

## 0.1.2

Published October 3, 2026

The declaration as a document, a live wire, and guest views.

- **The declaration is a document:** one JSON object that compiles into the same app `defineApp` declares, with an edit vocabulary of twenty-one operations, rules written as expressions, and templates as data.
- **A live wire:** `openRemote({ live: true })` pushes every op to every browser as it lands, MCP is served over HTTP, and logs can be folded and compacted.
- **Guest views:** `@graview/guest`, a view somebody else wrote, in a sandboxed frame that can only ask.
- A SQL adapter, stored formats that carry their version, a conformance kit, and `docs/stability.md`, the promise a version keeps.

**Also in it: 0.1.1**, which was versioned and never published, so its changes shipped here. A record read whole, in its own words. A kind declares what a glance at one says, forms and lists say values in the record's words, lists narrow by numbers and words, and a policy says who may see what as well as who may do it.

**Before you upgrade:** Breaking: a store served without `seatOf` answers 401 until it passes `trustSeatHeaders: true`, `graview serve` binds 127.0.0.1, a host's `seatOf` receives a web `Request`, a full palette needs the `good` and `bad` tokens, and a kind no sight names is seen only by the system.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.2) · [The full changelog for 0.1.2](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#012)

## 0.1.0

Published October 2, 2026

The first public release of the framework on npm.

Graview's first release to npm: a framework where a typed context graph is the interface rather than the backing store. One declaration per kind drives the layout, the legal actions, the agent tools and the accessibility labels. `graview` is the tool and `@graview/*` the framework, all at one version, under the Elastic License 2.0.

**Also in it: 0.0.1**, which was versioned and never published, so its changes shipped here. The work before the first public release. It was numbered once in the repository and never published.

[The release on GitHub](https://github.com/en-dash-consulting/graview/releases/tag/graview%400.1.0) · [The full changelog for 0.1.0](https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#010)

---

What came in each Graview version, newest first: a few plain lines each, what a host must know before upgrading, and links to its release and its full changelog.

The page: https://graview.dev/docs/releases.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
