---
name: graview-view-links
description: Send a person from a Graview worker view to a record, a place or a list — an <a data-record>, or a whole card or row bound to a record that opens on a click, a phone's tap and Enter — narrowed and to a section, and prove each lands by pressing it on a phone as well as a desk rather than assuming a card the describer lists opens.
---

# Links in a worker view

A worker view (`graview-worker-view`: its manifest, its global, its limits)
writes no address of the page's: an `href` it built is never drawn. What it
may link to is a record, a named place or a kind's list of this app, and
the host makes that a link and follows it, on both faces, only to what the
viewer may see.

**Go somewhere with a link, do something with a button.** `<a data-record>`
or `<a data-place>` to go; `<button>`, or `<button data-act>`
(`graview-view-forms`), to do. Style both as you like: the host resets a
button and a link it made to the words around them at no specificity, so
your own class always wins. A `<div>` or `<span>` with a
`graview.on("click")` handler is reached by no keyboard and is nothing to
a screen reader: do not draw one. A list of records is a list of
`<a data-record>`, never `graview.on("click", "[data-id]", … navigate)`.

## A link

`<a data-record="offer:7">` and `<a data-place="the-packages">` are links
the host follows. On the routed pages the host gives each the address it
goes to as its `href` (`/a/<app>/offers/offer%3A7`), so it shows on hover,
copies, and opens in a new tab on Cmd- or Ctrl-click or a middle click; a
plain click, a tap and Enter stay in the app. On the scene, which has no
addresses, it is given the keyboard and a link's role instead. A
`<button data-record>` goes there too. `<a href>` goes out only to an address a record was
handed — its own url, `mailto:`, `tel:` (below). A destination
is a record's id, else a place by its slug or its title
(`data-place="songs-by-writer"` or `"Songs by writer"`), else a kind's
list (`features` or `feature`); any other says why, naming the places.
A titled view of many is a place too, at `/places/<its title as a slug>`:
`data-place="live-threats"` reaches the view "Live threats", and the check
knows it when its host hands the views it keeps. From code, `graview.navigate("offer:7")` goes by the same rules.

## Links out

`<a href="${node.url}">` is drawn where the address is one a record the
view was shown holds, as it holds it — an `https:` page, a `mailto:`, a
`tel:` — or an `https:` address on an origin the host lists (`links: {
origins }` on the view's definition and a headless run). The host opens it
in a new tab, no opener, no referrer, marked ↗. An address you build,
`javascript:`, `data:` or `http:` is refused: a link a view made could
carry what it reads out.

## A card that opens

Any element with `data-record` or `data-place` is a link, not only an
`<a>`:

```html
<div class="card" data-record="threat:7">
  <h3>Invoice phishing</h3>
  <span class="badge">critical</span><span class="badge">new</span>
  <p>Forty mailboxes got the fake invoice.</p>
  <button data-more="threat:7">More</button>
</div>
```

The host gives it the keyboard (`tabindex="0"`), makes it a link to
assistive technology (`role="link"`; a list's item keeps its own role, and
a table's row keeps its role and gives the keyboard to its first cell,
where Enter opens the row), draws it with a pointer, `touch-action: manipulation` and a
faint tap highlight, and follows it on a click, on Enter, and on a phone's
tap. A press anywhere inside it opens it — its heading, a badge, a line —
unless it lands on something with a press of its own: a button, a field,
a `data-act`, a lightbox, a drop target, a control's `role`, another link.
So "More" above toggles and opens nothing.

It is no link when it is a press scope: a `fieldset` or `role="group"`
(the record a form's acts are done to), an element with `data-act`,
`data-lightbox`, `data-drop` or `data-field`, a field, or an element that
holds a field to type into or pick from (a checkbox inside leaves its row a
link). Link such a card's title instead: `<h3><a data-record="…">`.

Do not work around it: no `data-open` with `graview.on("click", …,
graview.navigate)`, no `pointer-events: none` on a card's children, no
`touch-action` of your own. A card that should do something of its own on
a press carries `data-key`, not `data-record`, and `graview.on`.

## How a tap reaches the view

A phone makes a tap a `click` on what the finger landed on; iOS does so
only on what looks pressable, which is why the host draws every link with
a pointer. The host hears it on the view's shadow root, follows a link
first, then tells the view, which hears `click` as it hears a mouse's:
`graview.on("click", ".card", (e) => …)` is handed `e.target`, what the
finger landed on, and `e.element`, the element the selector matched at or
above it, so a tap on a card's heading hands the card.

## Narrowed, and to a section

A list or a lens may be gone to **narrowed**: `where: { stage: "building" }`
in navigate, `data-filter="stage:building"` on a link — the words the
list's own arranging line writes, so the address is `/features?filter=
stage%3Abuilding` and can be shared. A lens narrows the records it is
handed; a blocks lens lists what its own `where` says. Any destination may
take a **section**, a heading's words or an element's id (`section:
"Every feature"`, `data-section`): the page scrolls there and gives it the
keyboard (`#every-feature`). On the scene a list is the kind's stop
narrowed (`in.filter`); a section is looked for there too. A filter on a
field the kind lacks, or a choice it lacks, goes nowhere and says why
(`Features have no field "stag" to filter by; they filter by …`), so link
to the list narrowed rather than to a lens per filter; a lens kept only
as a link target can be hidden (set-lens-hidden, `graview-pages`).

## Then find out whether it worked

1. `graview check` the app the view links into: a link is only as sound as
   the records and places it names.
2. `graview view check view.js --app <app> --manifest manifest.json --seed
   <seed.json> --roles <role>` says every `data-record` or `data-place`
   that names nothing the seat was shown and no place, and every filter
   that goes nowhere. `--press ".card h3"` presses there and says where the
   host would go, or that the press is a button's of its own.
   `--audit` holds what it drew to the keyboard and screen-reader rules,
   as the host draws it: a `<div>` heard only by `graview.on("click")`, a
   control or link with no name, a toggle with no state, a button inside a
   card that opens, an `<img>` with no alt. Each comes with its WCAG
   criterion and a one-line fix, and the check fails on what the view must
   fix. Contrast and the ring need a browser: there, `auditView(shadowRoot)`
   from `@graview/guest/audit` measures them too.
3. Open it on a phone, 390 pixels wide with touch: tap a card's heading and
   a badge inside it, and see the record's page; tap a toggle inside it,
   and see it toggle and stay. On a desk, Tab through the view: every link
   and button is reached, with a ring; Enter on a card opens it, and
   Cmd-click on an `<a data-record>` opens it in a new tab.
4. Follow each link narrowed and to a section, and see it land where it
   says.

## What the check cannot see

`graview check` judges the declaration, not the view. A headless run lays
nothing out, so it cannot see a card covered by something drawn over it, a
link too small to tap, or a card that looks like it opens and holds a
field. Only tapping it on a phone does. Nor can it see a link that goes
somewhere true but unhelpful.
