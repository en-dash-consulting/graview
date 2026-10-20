# graview-host-page

`graview-host-page` is one of Graview's 26 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Host a Graview app as the page itself — a service that serves it, a chat's widget, the address bar handed over, the host's own menu and news inside it — and picture its places honestly: wait for data-graview-drawn or onDrawn rather than a timer, open a page on a view proposed and not kept (draftView), and photograph places with graview preview and graview shots (--view, --manifest).

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## The host's page: when the page is the app

`graview-embed` puts an app on somebody else's page with `mount`. This is the other end of the same call: a host whose page exists to serve the app — a service that hosts apps for strangers, a chat that draws one in a widget, a desk — and so owns the address bar, the sign-in and the news, and needs to know when what it serves can be read or pictured. **The host decides the frame; the app still decides what is in it.**

### The moves

1. **When the page IS the app, hand it the address bar.** The default, `routing: "memory"`, never touches the host's `location` or `history` — right in an article. A host whose whole page is the app passes `routing: "address"` (and `basePath: "/apps/a1/"` when it is not served at `/`), and answers every address under the base with the one page: `<base>/places/<as>`, `<base>/<plural>/<id>` and the home are the routed face's pages, pushed and reloadable; the scene is `<base>/places/overview#overview=1`; the switch is a step Back undoes. `faceAtAddress(options)` is the face an address opens on, and `addressOf(place, { basePath })` (`@graview/core`) spells a place's link. A host that keeps its own history stays on memory, hears `onNavigate(path, how)` and answers its own Back with `setPath(path)`.
2. **In a chat's widget, let the frame be sized from the embed.** `height: "auto"` with `onIntrinsicHeight` tells the host the height to give it; `hostContext: { theme }` takes the chat's theme; `pagesBelow` swaps the scene for the pages on a phone; `remote` takes an `openRemote` store, `subscriptions` the host's Notify me (`remoteSubscriptions`), `signIn` a visitor's way in.
3. **A hosted reader sits only as who signed in.** Name members through `people` (and `setPeople`), never as `seats`, which offer "sit as somebody else". Where readers cannot save a declaration, `studio: false` — or `studio: { onApply }` to keep what it applies: return `{ ok: false, sentence, findings }` when you could not (the sentence heads its panel), `offered: true` when you decided who builds, and `place: StudioPlace`, imported, when the page is the studio and should not wait for its chunk. Where only the pages are shown, import `mount` from `@graview/embed/pages` and bundle nothing else.
4. **Put the host's own furniture inside the embed, never over it.** `hostActions: [{ label, href }]` (or `onSelect` for a press) draws the host's links in the person's menu, under who is signed in, reached by the keyboard. Every popover the embed draws stands in the browser's top layer, so a host needs no `z-index` override. `quickAsk: false` draws no quick ask (⌘K) on either face. Say the host's own news through `handle.notify({ kind: "toast" | "banner", sentence, tone, action })`, not a toast of your own fixed over the app: it floats at the app's foot, moving nothing. No tour of your own: `firstLook: { seen, onDone, steps }` points at the app's controls once, your `steps` naming a `FIRST_LOOK_ANCHORS` control.
5. **A changed app keeps the reader's place.** `handle.setApp(app, store)`, not a remount, keeps the face, the page and the stop, and a `label` that was the app's name takes the new name. To remount, pass `handle.where()` back as `mount(…, { at })`.
6. **Start what it loads before it asks.** Each face is a chunk of its own, fetched as it is first drawn: `preload(face)` starts it beside the host's own requests, and `handle.drawn()` waits for the face to be on the page. What the face opens as it first draws (the home's lenses, the scene's ribbons) your build names in the head: `firstDrawChunks(metafile, face)` from `@graview/embed/first-draw`, as `modulepreload` links. `onError` and `onReady` tell the host failures (class and module only) and the time to the first face drawn.

### Knowing when a place has drawn

A face on the page is not yet a place a person can read: its parts, the fonts, a worker view's drawing and its pictures may still be on their way. Once the place the reader is on has drawn and settled — every part drawn on it arrived or said it did not, the fonts and images loaded, each worker view drawn or stopped (what stands in its place drawn), and nothing moving for 200 ms — the embed's root wears `data-graview-drawn` (`DRAWN_ATTRIBUTE`), its value the place's path, and `mount`'s `onDrawn(place)` is told where it is as `where()` says it (`EmbedWhere`: face, path, stop). A move to another page, stop or face takes the attribute off in the commit that moves, and the next place puts it back as it settles; a place that never stops moving is said drawn after ten seconds all the same. A worker view's region says `data-worker-view-drawn` once it has drawn what it was last shown. A React host that wants the face committed, not settled, passes `onFaceDrawn` to `<Embed>`.

Picture a place by waiting for the attribute, never a timer:

```ts
await page.waitForSelector(`[data-graview-drawn="/places/the-week"]`);
```

### A view proposed and not kept

A chat that proposes a worker view can try it headless and be told what it drew in words; to see it at a phone's width in dark it had to keep it first. `draftView` (`EmbedDraftView`) draws one for the seat at the keyboard without keeping it — its `manifest` and its `source` (or `worker`, and anything else a `WorkerViewDefinition` takes but `draft`):

```ts
mount(root, { app, remote, routing: "address", draftView: { manifest, source, author: "Proposed by Claude" } });
```

It is drawn where its manifest attaches — the home, a kind's list at the place its title names (`/places/<title>`), each record's page — under one line, "Draft — <title> · Not kept", in a group named "Draft: <title>" (`[data-graview-draft-view="<name>"]`). A kept view of the same name is the one it stands in for: it is drawn nowhere beside the draft. A draft that is stopped says why in its place rather than standing the kind's own face there. Nothing of it is kept: it is registered under no name, so the place menu offers no Hide or Delete and `keptViews` is asked nothing; the store is not written; the next page, handed no draft, has none. A host that registers one itself passes `draft: true` to `registerWorkerView`. To picture several proposals, swap them on the same page with `handle.setDraftView(next)` (`null` goes back to the app's own views): the attribute comes off and returns once the new draft has settled, and `onDrawn` is told again. The pages alone (`@graview/embed/pages`) take the same `draftView`, `onDrawn` and `setDraftView`. A framed guest view holds the attribute back until it has drawn, or until `limits.readyMs` passes. Writing the view itself is `graview-worker-view`.

### Pictures of places, with no product

`graview preview <document.json>` serves the store and Graview's own faces over a document; `graview shots <document.json> --places a,b --scheme both

--width 390,1280` photographs places to PNGs, waiting for `data-graview-drawn` before each. Both take an app declared in code as `graview check` does (`./dist/domain/app.js`): the store runs it, and the page is handed its module bundled with the project's esbuild. Both take a proposed view as `--view <view.js> --manifest <manifest.json>`, drawn as a draft where it attaches; `shots` takes its place by its title, as a kept view's (`--places "The week"`), and lists it among the places.

### Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js   # the declaration is still whole
pnpm typecheck                                          # the host's options, no casts
graview shots app.json --view view.js --manifest manifest.json --places "The week" --scheme both --width 390
```

Then, on the host's page: reload a deep address and land on it; press Back after the switch and come back; sign in as a member and see no "sit as" in the menu; say a notice and see it at the app's foot. Read `data-graview-drawn` before and after a move: off in the commit that moves, back with the new path. Open a draft and see its line, and reload without it and see none.

### What the check cannot see

- Whether the picture is the right one. `data-graview-drawn` says the place settled, not that it shows what the article or the proposal says; look at each shot, in both schemes and at a phone's width.
- Whether the host answers every address under its base. A route the host's server does not answer is a 404 on reload that nothing in the app can see.
- Whether a draft is worth keeping. Drawn is not good; the person decides.

---

Host a Graview app as the page itself — a service that serves it, a chat's widget, the address bar handed over, the host's own menu and news inside it — and picture its places honestly: wait for data-graview-drawn or onDrawn rather than a timer, open a page on a view proposed and not kept (draftView), and photograph places with graview preview and graview shots (--view, --manifest).

The page: https://graview.dev/docs/skills/graview-host-page.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
