---
name: graview-embed
description: Put a Graview app on somebody else's page — a picture in an article, a chapter in the docs, a live demo in a landing page — with its own theme scoped to one element, and nothing on the host touched.
---

# The embed: an app on somebody else's page

`@graview/embed` mounts an app into any element on any page. It brings its
own theme scoped to that element, the brand's fonts, and a strip with the
faces and the places — no `Shell`, no router, nothing of the host's styled
or listened to. It is the same declaration, the same store and the same acts
as the app itself; only the frame is the host's.

```ts
import { mount } from "@graview/embed";

const handle = mount(el, {
  app, store,                     // or `seed`, and one is made
  views,                          // the app's own registry, in its own schema
  stop: "#focus=agg:plot",        // the fragment the app would put in its address bar
  scheme: "auto",                 // the host's data-theme, else the system's
  label: "Chapter 13",            // names every landmark inside
});
handle.setFace("pages"); handle.setStop("#focus=plot-2"); handle.unmount();
```

`graview create` writes this as `src/embed.tsx` and an `embed.html` host, so
the project's own `pnpm typecheck` covers the embed surface from day one.

## The moves

1. **Say where it opens with the stop, not with code.** `stop` is exactly
   the fragment the app writes — `#overview=1`, `#focus=agg:plot`,
   `#view=the-week` — so a link you copied from the app is an embed's
   starting point. `face` follows the stop unless you name one.
2. **Pick the face for the page.** `"scene"` and `"graview"` are the app;
   `"pages"` is the routed face, opened at `path`; `"picture"` is ONE named
   lens alone (`stop: "#view=the-week"`), no bar and no rail — a page
   about a lens shows the lens. `toggle: false` drops the strip too.
3. **Name it.** Two embeds on one page carry the same landmarks — the
   relation key, the inspector, the pages' navigation — and a landmark must
   be unique by role and name. `label` names every one of them after the
   embed; leave it off and two embeds are one confusing region twice.
4. **Let the host decide the look.** `scheme: "auto"` follows the host's
   `data-theme` stamp; `setScheme` follows a host toggle; `fonts: false`
   when the host already loads them; `brand` / `setBrand` to dress it.
5. **Make the policy felt, if the page is about it.** `seats` lists the
   principals a reader may take — each a label and a `Principal` — on the
   strip; the acts, the pages and the strip narrow the moment one sits
   down, and `setSeat` does it from the host. See `graview-permissions`.
6. **Many on one page: mount when near.** `mountWhenNear(elements,
   mountOne)` mounts each as the reader scrolls toward it, so a page of
   sixteen chapters costs one at a time. Share a `store` between embeds
   only when they are meant to be one app seen twice.
7. **Presence is opt-in.** An embed broadcasts nothing and draws nobody
   unless it is handed a `presence` channel: putting a graph on a page does
   not tell its readers about each other.
8. **Register only what differs.** `views(schema, registry)` is handed the
   framework's own view for every cell, with the declaration's `viewSpecs`
   already drawn; register onto it the cells you want different, and the
   rest stay. The same registry draws every face — the gallery's card, the
   list's row (one × glyph), the record's page (one × full). A view that adds
   to the default draws it inside itself with `<DefaultView {...props} />`
   (`@graview/primitives`); on the record page, which is the default, that
   draws nothing. `@graview/embed/pages` takes `views` too.
9. **Say its name at the right level.** The workbench names itself in a
   heading for readers moving by headings: `heading: 1` when the page is
   the app, the default `2` inside an article, `false` when your heading
   already says it.
10. **In a chat's widget, let the frame be sized from the embed.** `height:
    "auto"` with `onIntrinsicHeight` tells the host the height to give it;
    `hostContext: { theme }` takes the chat's theme; `pagesBelow` swaps the
    scene for the pages on a phone; `remote` takes an `openRemote` store. A
    hosted reader sits only as who signed in: name members through `people`
    (and `setPeople`), never as `seats`, which offer "sit as somebody else".
    Where readers cannot save a declaration, `studio: false` (or `studio:
    { onApply }` to keep what it applies: return `{ ok: false, sentence,
    findings }` when you could not (the sentence heads the studio's panel;
    findings may be empty; an Apply with nothing changed never asks),
    `offered: true` when you decided who builds, and `place: StudioPlace`,
    imported, when the page is the studio and should not wait for its
    chunk); where only the pages are shown,
    import `mount` from `@graview/embed/pages` and bundle nothing else.
    `onError` and `onReady` tell the host failures (class and module only)
    and time to the first face drawn. Each face is fetched as it is first
    drawn: `preload(face)` starts it beside the host's own requests, and
    `handle.drawn()` waits for it.
11. **Put the host's own furniture inside the embed, never over it.**
    `hostActions: [{ label, href }]` (or `onSelect` for a press) draws the
    host's links — "Your apps", "Report this app" — in the strip's profile
    menu, under who is signed in, reached by the keyboard. Every popover
    the embed draws stands in the browser's top layer, so a host needs no
    `z-index` override and nothing fixed over the scene. `companion:
    "collapsed"` starts the seat's rail put away to a slim tab (`"hidden"`:
    not drawn); the reader's own choice is remembered over it. Say the
    host's own news through `handle.notify({ kind: "toast" | "banner",
    sentence, tone, action })`, not a toast of your own fixed over the app:
    it is drawn in the framework's panel, on top, and read aloud.

## Worked examples

- `apps/seedbed/src/site-embed.ts` — the docs site's chapters, many to a
  page, mounted as the reader nears them, the rota's seats on the strip
- `apps/rota/src/embed.ts` — two embeds of one app on one host page, each
  named for what it shows
- `packages/core/src/scaffold/ui.ts` — what `graview create` writes

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js   # the declaration is still whole
pnpm typecheck                                          # the embed takes the app's own views, no casts
```

Then open the host page at a phone's width and with two embeds on it: each
names its own landmarks, neither pushes the page sideways, and pressing a
place in one moves only that one. `packages/embed/tests/unit/embed.test.ts`
holds the contracts; copy its shape for a host of your own.

## What the check cannot see

- Whether the host's CSS reaches in. The embed scopes its own theme, and
  every rule of it stays inside its element, so the host's own buttons,
  headings and code keep the host's look; but a host rule like
  `button { … }` on the whole page still applies inside the embed, and only
  looking at the page finds it.
- Whether the stop still lands. A stop names ids and places; rename a place
  or seed different ids and an embed opens somewhere it resolves to rather
  than where the article says it does.
