// A call sheet: one call — who, their county and number — and the notes
// taken on it, saved as they are typed, with no button. The host saves
// them once the person pauses, and when they leave the field; the view
// says "Saving…" as they type and "Saved" once the host says so.
//
// manifest: {
//   name: "call", attach: "call", cardinality: "one",
//   acts: ["save-notes"]
// }

graview.style(`
  .call { display: grid; gap: 8px; padding: 12px; max-width: 60ch; }
  .call h2 { margin: 0; font: 600 1.25rem/1.2 var(--graview-font-display); color: var(--graview-ink); }
  .where { margin: 0; color: var(--graview-ink-muted); font-size: 0.9rem; }
  fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; }
  legend { padding: 0; font-weight: 600; color: var(--graview-ink); }
  textarea { min-height: 10em; padding: 8px; font: inherit; border-radius: 6px;
             border: 1px solid var(--graview-edge); background: var(--graview-ground); color: var(--graview-ink); }
  .state { margin: 0; min-height: 1.4em; font-size: 0.85rem; color: var(--graview-ink-muted); }
  .notes { margin: 0; white-space: pre-line; color: var(--graview-ink); }
`);

// What the field's last save came to: nothing yet, saving, saved, or why not.
let state = "";

// The person typed: the host saves once they pause. The view never holds what they typed.
graview.on("input", "textarea", () => {
  if (state === "Saving…") return;
  state = "Saving…";
  draw(graview.props);
});

// The host saved it, or said why not.
graview.on("acted", "textarea", (event) => {
  state = event.pressed.ok ? "Saved" : `Not saved: ${event.pressed.message}`;
  draw(graview.props);
});

function draw(props) {
  const call = props.node;
  if (!call) return graview.render(graview.html`<p>Nothing to show.</p>`);
  const mayWrite = props.acts.some((act) => act.name === "save-notes");
  graview.render(graview.html`
    <article class="call">
      <h2>${call.who}</h2>
      <p class="where">${call.county} · ${call.phone}</p>
      ${mayWrite ? graview.html`
        <fieldset data-record="${call.id}">
          <legend>Notes</legend>
          <textarea name="notes" data-prefill="notes" data-act="save-notes"
                    data-save="input" data-debounce="1500" aria-label="Notes on the call"></textarea>
          <p class="state" aria-live="polite">${state}</p>
        </fieldset>` : graview.html`<p class="notes">${call.notes || "No notes yet."}</p>`}
    </article>`);
}

graview.onProps(draw);
