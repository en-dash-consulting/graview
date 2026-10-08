// A view of one record: a deliverable's subject, its draft set as
// paragraphs, and "Edit draft", which opens the whole draft to change.
// The record's own fields stay editable under it.
//
// manifest: {
//   name: "deliverable", attach: "deliverable", cardinality: "one",
//   acts: ["set-draft"]
// }

graview.style(`
  .record { display: grid; gap: 10px; padding: 12px; max-width: 68ch; }
  .record h2 { margin: 0; font: 600 1.25rem/1.2 var(--graview-font-display); color: var(--graview-ink); }
  .status { color: var(--graview-ink-muted); font-size: 0.85rem; }
  .draft p { margin: 0 0 0.8em; line-height: 1.55; white-space: pre-line; color: var(--graview-ink); }
  details { border-top: 1px solid var(--graview-edge); padding-top: 8px; }
  summary { cursor: pointer; color: var(--graview-accent); }
  fieldset { border: 0; padding: 8px 0 0; margin: 0; display: grid; gap: 8px; }
  textarea { min-height: 16em; padding: 8px; font: inherit; border-radius: 6px;
             border: 1px solid var(--graview-edge); background: var(--graview-ground); color: var(--graview-ink); }
  button { justify-self: start; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--graview-accent);
           background: transparent; color: var(--graview-accent); cursor: pointer; }
`);

let said = "";

graview.on("click", "button", (event) => {
  said = event.pressed && event.pressed.ok ? "Saved." : event.pressed ? event.pressed.message : "";
  draw(graview.props);
});

function draw(props) {
  // A view of one is handed its record as `props.node`, its fields on it.
  const node = props.node;
  if (!node) return graview.render(graview.html`<p>Nothing to show.</p>`);
  const paragraphs = String(node.draft || "").split(/\n\s*\n/).filter((one) => one.trim() !== "");
  const editable = props.acts.some((act) => act.name === "set-draft");
  graview.render(graview.html`
    <article class="record">
      <h2>${node.subject}</h2>
      <span class="status">${node.status}</span>
      <div class="draft">${paragraphs.map((text, at) => graview.html`<p data-key="p${at}">${text}</p>`)}</div>
      ${editable ? graview.html`
        <details>
          <summary>Edit draft</summary>
          <fieldset data-record="${node.id}">
            <textarea name="draft" data-prefill="draft" aria-label="The draft"></textarea>
            <button data-act="set-draft">Save the draft</button>
          </fieldset>
        </details>` : ""}
      <p role="note">${said}</p>
    </article>`);
}

graview.onProps(draw);
