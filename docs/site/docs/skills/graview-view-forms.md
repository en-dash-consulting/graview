# graview-view-forms

`graview-view-forms` is one of Graview's 26 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Let a Graview worker view change records — a bound press (data-act), the fields a person types into, a record's own text filled to edit (data-prefill), a field that saves as it is typed (data-save) and the view hearing what became of each act (acted) — and prove a press applies and a field the view filled is refused, rather than assuming the form works.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Forms in a worker view

A worker view (`graview-worker-view`: its manifest, its global, its links and its limits) changes records only by asking for the acts its manifest names. **Where every member sees every record, `graview.act(name, args)` applies as given. Anywhere else only a press applies an act** — a person's click on an element with `data-act`, or a field of theirs that saves — because a view's code is never handed what a person types where sight is not total, and so cannot put words in their mouth.

### A press

An element with `data-act` is a press. Its arguments come only from three places: the record it is bound to (`data-record`, on it or on an element around it), the manifest's constants (an `acts` entry with `as` and `constants`), and the fields in its `fieldset`, named for the act's arguments and typed by the person:

```html
<fieldset>
  <input name="summary" placeholder="What it is">
  <button data-act="set-summary" data-record="package:start">Say it</button>
</fieldset>
```

A field the view filled (`value="…"`) is the view's until the person empties it, and a press carrying it is refused. A radio or a select is the person's pick, not their words: its value goes only if it is one the act declares (an enum's option) or a record the view was shown. A view may empty a field after a press. A press on an act the seat may not run there is refused, and the view hears why.

### A record's own text, to edit

To offer a record's own text to edit, let the host fill it: `data-prefill` names the field, and `name` is the same.

```html
<fieldset data-record="deliverable:email">
  <textarea name="draft" data-prefill="draft"></textarea>
  <button data-act="set-draft">Save the draft</button>
</fieldset>
```

The host fills an empty `input` or `textarea` with the record's whole value, line breaks kept, read through the viewer's sight, when an act in the fieldset writes that field of that record and the person may run it there; otherwise it stays empty, so a seat that may not write the field is offered nothing to edit. The person edits it in place, and it goes only back into that field: a press carrying it anywhere else is refused `untyped`. `graview-worker-view`'s `examples/a-record.js` offers "Edit draft" this way.

### A field that saves as it is typed

In a `fieldset data-record`, a field that carries its own act saves with no button:

```html
<textarea name="notes" data-prefill="notes" data-act="save-notes" data-save="input" data-debounce="1500"></textarea>
```

The host saves it once the person pauses for `data-debounce` milliseconds (1 000 when it is left out, held to 250–10 000), at once when they leave the field, and as the view goes, whatever was still waiting. `data-save="change"` saves on the field's `change` alone. A save is a press in every way but the click: the act is the field's own `data-act`, its record and its fieldset's fields are read as a press reads them and held to the same rules — only what the person typed, a prefilled value only back where it came from, under their grants — and a click into the field is not a press.

### Hearing what became of it

The press applies before the view hears it, so the view never decides whether it happened: a bound press's `click` carries `event.pressed`, and every act a press or a save asked for comes back as an `acted` event on the bound element, `event.pressed` holding `as`, `ok`, and `reason` and `message` when it was refused:

```js
graview.on("input", "textarea", () => draw("Saving…"));
graview.on("acted", "textarea", (e) => draw(e.pressed.ok ? "Saved" : e.pressed.message));
```

Say the refusal's `message` as it is: it is the policy's sentence, or the host's. `examples/a-call-sheet.js` is a whole one: a call's notes, filled by the host, saved as they are typed, "Saving…" on `input` and "Saved" on `acted`.

### Then find out whether it worked

1. `graview check` the app the view writes to: a form is only as sound as the acts it asks for. `checkManifest(manifest, store)` from `@graview/guest/host/views` must say nothing; it refuses an act the app does not declare.
2. Run it headless as a member who may see less than you: `graview view check view.js --app <app> --manifest manifest.json --seed <seed.json> --roles <role>`. It reports `act` for an act its manifest does not name, and says when a field's `data-save` would save nothing: no `data-act` or `name`, no fieldset bound to a record, a `data-save` other than `input` or `change`, a `data-debounce` it does not read, or a `data-save` on what is not a field.
3. Open it on both faces as that member. Press each bound button with typed words, then again with a field the view filled. The first applies and the second is refused. A prefilled field is filled only for a seat that may write it: open it as one who may not, and it is empty.
4. Type into a field that saves, stop, and see "Saved"; type again and leave it at once, and see the save land without the pause.

### What the check cannot see

`graview check` judges the declaration, not the form. It cannot see a field named for the wrong argument, a button that says "Save" over an act that sends, or a view that says "Saved" without waiting for `acted`. A headless run presses nothing and lets no pause pass, so it cannot see a save land; only pressing and typing on the faces, as a seat with narrow sight, does. Nor can it see a form that asks for what the person should not have to type.

---

Let a Graview worker view change records — a bound press (data-act), the fields a person types into, a record's own text filled to edit (data-prefill), a field that saves as it is typed (data-save) and the view hearing what became of each act (acted) — and prove a press applies and a field the view filled is refused, rather than assuming the form works.

The page: https://graview.dev/docs/skills/graview-view-forms.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
