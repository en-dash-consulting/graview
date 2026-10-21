import {
  humanizeField,
  nounOf,
  labelOf,
  type AnySchema,
  type Principal,
  type Store,
} from "@graview/core";
import { amountBox, amountInBox, argumentWords, endAfterStartMoved, failureWords, readAmount, startAndEndOf, tellApart } from "@graview/core/words";
import type { AmountMark } from "@graview/core";
import { changedArgs, editStart, formFields, formArgs, keptArguments, type FormField } from "@graview/core/forms";
import type { AnyMutationDefinition } from "@graview/core";
import type { OpenParameter } from "@graview/tools";
import { Files, LinkedPicker, RepeatPicker, WhenInput } from "@graview/primitives/pages";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * A form, walked off the mutation's own declaration.
 *
 * No page writes a form by hand: the mutation input already says every
 * argument's control — a discriminated union is a type picker followed by
 * that arm's fields, an array is repeatable rows, a node reference is a
 * picker over the real nodes of its kinds. The strip's prompts read the
 * same shapes; this is those shapes given room.
 */

/*
 * EACH PART SAYS WHAT IT IS, and its look is a rule rather than a style
 * attribute.
 *
 * Every field, label, picker and submit was styled inline, and an inline
 * style beats every selector there is — so a product's design could
 * restyle a form only with `!important`. Each part now wears
 * `data-graview-part` (and each field `data-graview-field`, its control),
 * and the defaults below are written at the weight of ONE ELEMENT —
 * `input:where([data-graview-part="control"])` — so the theme's bare
 * `button` rule still loses to them as it lost to the inline style, and an
 * app's `[data-graview-part="control"]` wins outright.
 */
const FORM_CSS = `
form:where([data-graview-part="form"]) {
  /* A grid item of the section above it and a grid container for the
     fields below: both halves are allowed to be narrower than what is in
     them, or a big enough text size pushes the page sideways. See the note
     on \`column\` in pages.tsx. */
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  gap: 12px;
}
label:where([data-graview-part="field"]),
div:where([data-graview-part="field"][data-graview-field="date"]) {
  display: grid;
  /* A track the width it was given: see the note on \`column\` in pages.tsx. */
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  gap: 4px;
}
label:where([data-graview-part="field"][data-graview-field="boolean"]) {
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
}
span:where([data-graview-part="label"]),
legend:where([data-graview-part="label"]),
p:where([data-graview-part="unasked"]) {
  font-size: 0.8125rem;
  color: var(--graview-ink-muted);
}
p:where([data-graview-part="unasked"]) { margin: 0; }
input:where([data-graview-part="control"]:not([type="checkbox"])),
select:where([data-graview-part="control"]) {
  font: inherit;
  /* A TARGET IN EVERY ENGINE, not only in the one it was measured in.
     Padding and line height alone came to 24 in Chromium and to 22 in
     WebKit, which has its own intrinsic metrics for a \`select\` and rounds
     nothing up for anybody. So every picker on the routed face was under
     the WCAG 2.2 minimum in the browser iOS ships, and the check that says
     so (\`verify-pages\`' \`bigEnoughToHit\`) only ever ran there through
     \`pnpm engines\`. */
  min-height: 24px;
  /* NEVER WIDER THAN ITS FIELD. A select is as wide as its longest option,
     and a picker over 320 vehicles ("2027 Mercedes-Benz GLE AMG 53 4MATIC+
     Coupe") was 618 pixels on a 390 phone, and the whole page scrolled
     sideways. It shrinks to its track and cuts the option inside its box. */
  min-width: 0;
  max-width: 100%;
  text-overflow: ellipsis;
  box-sizing: border-box;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--graview-edge);
  background: var(--graview-panel);
  color: var(--graview-ink);
}
/* A PICKER THAT STILL LOOKS LIKE ONE.
   WebKit ignores an author's padding and minimum height on a \`select\`
   while the native appearance is on — so every picker on the routed face
   came out 22 pixels tall in the browser iOS ships, under the 24 WCAG 2.2
   asks for, while the same element measured 35 in Chromium. Turning the
   appearance off is what makes the box the size it was asked to be, and it
   takes the platform's chevron with it; the chevron is put back, in the ink
   the scheme is already using. */
span:where([data-graview-part="picker"]) {
  position: relative;
  display: grid;
  min-width: 0;
}
span:where([data-graview-part="picker"]) > select:where([data-graview-part="control"]) {
  appearance: none;
  padding-right: 28px;
}
span:where([data-graview-part="chevron"]) {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  line-height: 1;
  color: var(--graview-ink-muted);
  pointer-events: none;
}
fieldset:where([data-graview-part="group"]) {
  display: grid;
  gap: 10px;
  border: 1px solid var(--graview-edge);
  border-radius: 10px;
  padding: 12px;
}
fieldset:where([data-graview-part="group"][data-graview-field="list"]) { gap: 8px; }
div:where([data-graview-part="item"]) {
  display: flex;
  gap: 8px;
  align-items: end;
}
button:where([data-graview-part="add"]),
button:where([data-graview-part="submit"]) { justify-self: start; }
p:where([data-graview-part="refused"]) {
  margin: 0;
  color: var(--graview-warn);
  font-size: 0.875rem;
}
`;

/**
 * AN AMOUNT'S BOX: its currency's symbol before it (or "%", a unit, after),
 * a placeholder in the reader's locale, and the text read as a person
 * writes it — "$1,250.50" is 1250.5, "15%" is 0.15. What is no number is
 * said under the box, and nothing is sent for it.
 */
function AmountControl({ title, name, optional, amount, value, onChange }: { title: ReactNode; name: string; optional: boolean; amount: AmountMark; value: unknown; onChange: (value: unknown) => void }) {
  const box = amountBox(amount);
  const [text, setText] = useState(() => (typeof value === "number" ? amountInBox(value, amount) : ""));
  const wrong = text.trim() !== "" && readAmount(text, amount) === undefined;
  return (
    <label data-graview-part="field" data-graview-field="number" data-graview-amount={amount.format ?? "unit"}>
      <span data-graview-part="label">{title}</span>
      <span data-graview-part="amount" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {box.prefix ? <span data-graview-part="amount-symbol" aria-hidden="true">{box.prefix}</span> : null}
        <input
          type="text"
          inputMode="decimal"
          name={name}
          required={!optional}
          placeholder={box.placeholder}
          title={box.hint}
          aria-invalid={wrong || undefined}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onChange(readAmount(event.target.value, amount));
          }}
          data-graview-part="control"
          style={{ flex: 1, minWidth: 0 }}
        />
        {box.suffix ? <span data-graview-part="amount-symbol" aria-hidden="true">{box.suffix}</span> : null}
      </span>
      {wrong ? (
        <span data-graview-part="hint" role="status">
          Not an amount {box.hint}: write it like {box.prefix ?? ""}
          {box.placeholder}
          {box.suffix ? ` ${box.suffix}` : ""}
        </span>
      ) : null}
    </label>
  );
}

function Picker({ children }: { children: React.ReactNode }) {
  return (
    <span data-graview-part="picker">
      {children}
      <span aria-hidden="true" data-graview-part="chevron">
        ▾
      </span>
    </span>
  );
}

type Words = (name: string) => { readonly label: string; readonly option: (value: string) => string };
const plainWords: Words = (name) => ({ label: humanizeField(name), option: (value) => value });

/** What a phone, a place and a length of time take, said where each is typed. */
const HOLDS = { phone: "+1 555 123 4567", place: "An address or a place's name", duration: "1h 30m, 90 or 1:30" } as const;

function Control<S extends AnySchema>({
  store,
  spec,
  value,
  onChange,
  prefilled,
  open,
  words = plainWords,
  values,
}: {
  store: Store<S>;
  spec: FormField;
  value: unknown;
  /** The whole form's answers, where a control reads a sibling's: a repeat, the date it repeats. */
  values?: Readonly<Record<string, unknown>>;
  onChange: (next: unknown) => void;
  prefilled: Readonly<Record<string, unknown>>;
  open: readonly OpenParameter[];
  /** The record's own words for an argument that fills one of its fields (see `argumentWords`). */
  words?: Words;
}): ReactNode {
  // An argument the caller already answered — a subject id, a repair's own
  // args — is stated, not asked again.
  if (spec.name in prefilled && spec.control !== "group" && spec.control !== "variant") {
    return null;
  }
  /*
   * A node picker is labeled by what it PICKS — "List", not "List id": the
   * argument's name is an implementation detail, and the kinds it accepts
   * are the declaration's own word for the thing.
   */
  const named =
    spec.control === "node" && !spec.kinds.includes("*")
      ? spec.kinds.map((kind) => humanizeField(nounOf(store.schema.tryDefinition(kind), kind))).join(" or ")
      : words(spec.name).label;
  // A box is always answered — unticked is a no — so it is never marked as one that must be.
  const asked = !(spec.optional || spec.control === "boolean");
  /*
   * The star is drawn, not said: the field itself says it is required, and
   * a reader heard "Name star, edit text, required".
   */
  const title: ReactNode = asked ? (
    <>
      {named}
      <span aria-hidden="true"> *</span>
    </>
  ) : (
    named
  );

  switch (spec.control) {
    case "text":
    case "date":
      // Prose is asked for in a text area: Enter is a new line, and every line break is kept (FR-147).
      if (spec.control === "text" && spec.long) {
        return (
          <label data-graview-part="field" data-graview-field="text">
            <span data-graview-part="label">
              {title}
              {/* Written in Markdown (FR-180): said where it is typed, quietly. */}
              {spec.markdown ? <span style={{ fontWeight: "normal", color: "var(--graview-ink-faint)" }}> · Markdown</span> : null}
            </span>
            <textarea
              name={spec.name}
              required={!spec.optional}
              rows={6}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => onChange(event.target.value)}
              data-graview-part="control"
              style={{ fieldSizing: "content", minHeight: "7.5em", resize: "vertical", font: "inherit", lineHeight: 1.5 } as CSSProperties}
            />
          </label>
        );
      }
      // A day or a moment, typed as people say it or picked from a month (Roadmap f-date-inputs).
      if (spec.control === "date") {
        return (
          <div data-graview-part="field" data-graview-field="date">
            <span data-graview-part="label">{title}</span>
            <WhenInput
              name={spec.name}
              label={words(spec.name).label}
              required={!spec.optional}
              value={typeof value === "string" && value !== "" ? value : undefined}
              time={spec.time === true}
              instant={spec.instant === true}
              onChange={onChange}
            />
          </div>
        );
      }
      return (
        <label data-graview-part="field" data-graview-field={spec.control === "text" && spec.holds ? spec.holds : spec.control}>
          <span data-graview-part="label">{title}</span>
          <input
            type={spec.control === "text" && spec.holds === "phone" ? "tel" : "text"}
            name={spec.name}
            required={!spec.optional}
            // Another app's address (FR-171): what it takes, said where it is typed.
            {...(spec.control === "text" && spec.app ? { placeholder: "@owner/app or https://…" } : {})}
            // A phone, a place and a length of time: what each takes, said where it is typed.
            {...(spec.control === "text" && spec.holds ? { placeholder: HOLDS[spec.holds] } : {})}
            {...(spec.control === "text" && spec.holds === "phone" ? { autoComplete: "tel" } : {})}
            // A day or a moment as a date box holds one: a moment kept with its seconds or zone shows its minute.
            value={typeof value === "string" ? value : typeof value === "number" ? String(value) : ""}
            onChange={(event) => onChange(event.target.value)}
            data-graview-part="control"
          />
        </label>
      );
    case "number":
      // Money, a percent, a measure: asked for as it is said — "$" beside "1,250.50" — and read as typed.
      if (spec.amount) return <AmountControl title={title} name={spec.name} optional={spec.optional} amount={spec.amount} value={value} onChange={onChange} />;
      return (
        <label data-graview-part="field" data-graview-field={spec.control}>
          <span data-graview-part="label">{title}</span>
          <input
            type="number"
            name={spec.name}
            required={!spec.optional}
            {...(spec.min === undefined ? {} : { min: spec.min })}
            {...(spec.max === undefined ? {} : { max: spec.max })}
            {...(spec.step === undefined ? {} : { step: spec.step })}
            value={typeof value === "number" ? value : ""}
            onChange={(event) =>
              onChange(event.target.value === "" ? undefined : Number(event.target.value))
            }
            data-graview-part="control"
          />
        </label>
      );
    case "boolean":
      return (
        <label data-graview-part="field" data-graview-field="boolean">
          <input
            type="checkbox"
            name={spec.name}
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            data-graview-part="control"
          />
          <span data-graview-part="label">{title}</span>
        </label>
      );
    case "choice":
      return (
        <label data-graview-part="field" data-graview-field={spec.control}>
          <span data-graview-part="label">{title}</span>
          <Picker>
            <select
              name={spec.name}
              required={!spec.optional}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => onChange(event.target.value || undefined)}
              data-graview-part="control"
            >
              <option value="">—</option>
              {(spec.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {words(spec.name).option(option)}
                </option>
              ))}
            </select>
          </Picker>
        </label>
      );
    case "node": {
      /*
       * THE CANDIDATES THE DERIVATION WORKED OUT, when there are any.
       *
       * The affordance already knows which ids are honest answers here: a
       * connecting act offers only who is NOT already on, a severing act
       * only what is attached, and neither ever offers the record itself.
       * This form listed every node of the kind instead, so the same act
       * asked a narrower question in the strip than on the page — and a
       * record's own "Depends on" offered the record.
       *
       * With no affordance to ask (a rule's repair, a creating act on a list
       * page), every node of the kind is still the honest answer — EXCEPT
       * the one the form is already about. A page that pins the subject in
       * `prefilled` and lets this fall back listed that subject as an answer
       * to its own edge, which for a self-referential kind was the ONLY
       * answer: "Make it depend on something" whose only something was
       * itself. The act then has to guard against it and the guard is
       * invisible, so the one press anyone could make did nothing.
       */
      const narrowed = open.find((parameter) => parameter.name === spec.name)?.candidates;
      const pinned = new Set(Object.values(prefilled).filter((held): held is string => typeof held === "string"));
      const all = (
        spec.kinds.includes("*")
          ? [...store.graph.allNodes()]
          : spec.kinds.flatMap((kind) => store.graph.nodesOfKind(kind))
      ).filter((node) => !pinned.has(node.id));
      const candidates = narrowed
        ? narrowed
            .map((id) => store.graph.getNode(id))
            .filter((node): node is NonNullable<typeof node> => node !== undefined)
        : all;
      const told = tellApart(candidates as never, (kind) => store.schema.tryDefinition(kind as never));
      return (
        <label data-graview-part="field" data-graview-field={spec.control}>
          <span data-graview-part="label">{title}</span>
          <Picker>
            <select
              name={spec.name}
              required={!spec.optional}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => onChange(event.target.value || undefined)}
              data-graview-part="control"
            >
              <option value="">—</option>
              {candidates.map((candidate) => {
                // Two releases called "Blue Hour" are told apart by what differs.
                const apart = told.get(candidate.id);
                return (
                  <option key={candidate.id} value={candidate.id}>
                    {labelOf(store.schema.tryDefinition(candidate.kind), candidate)}
                    {apart ? ` · ${apart}` : ""}
                  </option>
                );
              })}
            </select>
          </Picker>
        </label>
      );
    }
    case "group": {
      const held = (value ?? {}) as Record<string, unknown>;
      return (
        <fieldset data-graview-part="group" data-graview-field={spec.control}>
          <legend data-graview-part="label">{title}</legend>
          {spec.fields.map((child) => (
            <Control
              key={child.name}
              store={store}
              spec={child}
              value={held[child.name]}
              onChange={(next) => onChange({ ...held, [child.name]: next })}
              prefilled={prefilled}
              open={open}
              words={words}
            />
          ))}
        </fieldset>
      );
    }
    case "variant": {
      const held = (value ?? {}) as Record<string, unknown>;
      const chosen = typeof held[spec.tag] === "string" ? (held[spec.tag] as string) : "";
      const arm = spec.options.find((option) => option.value === chosen);
      return (
        <fieldset data-graview-part="group" data-graview-field={spec.control}>
          <legend data-graview-part="label">{title}</legend>
          <label data-graview-part="field" data-graview-field="choice">
            <span data-graview-part="label">{humanizeField(spec.tag)}</span>
            <select
              value={chosen}
              onChange={(event) => onChange({ [spec.tag]: event.target.value })}
              data-graview-part="control"
            >
              <option value="">—</option>
              {spec.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {humanizeField(option.value)}
                </option>
              ))}
            </select>
          </label>
          {arm?.fields.map((child) => (
            <Control
              key={child.name}
              store={store}
              spec={child}
              value={held[child.name]}
              onChange={(next) => onChange({ ...held, [child.name]: next })}
              prefilled={prefilled}
              open={open}
              words={words}
            />
          ))}
        </fieldset>
      );
    }
    case "file":
    case "list": {
      // A picture or a document, or a list of them put there several at once, through the host's upload (FR-163).
      const file = spec.control === "file" ? spec : spec.item.control === "file" ? spec.item : undefined;
      if (file || spec.control === "file") return <Files as="control" title={asked ? `${named} *` : named} value={value} onChange={onChange} several={file !== spec} image={file?.image === true} video={file?.video === true} label={named} />;
      const items = Array.isArray(value) ? (value as unknown[]) : [];
      return (
        <fieldset data-graview-part="group" data-graview-field="list">
          <legend data-graview-part="label">{title}</legend>
          {items.map((item, index) => (
            <div key={index} data-graview-part="item">
              <div style={{ flex: 1 }}>
                <Control
                  store={store}
                  spec={{ ...spec.item, optional: false }}
                  value={item}
                  onChange={(next) => onChange(items.map((held, at) => (at === index ? next : held)))}
                  prefilled={prefilled}
                  open={open}
                  words={words}
                />
              </div>
              <button type="button" data-graview-part="remove" onClick={() => onChange(items.filter((_, at) => at !== index))}>
                remove
              </button>
            </div>
          ))}
          <button type="button" data-graview-part="add" onClick={() => onChange([...items, undefined])}>
            add another
          </button>
        </fieldset>
      );
    }
    case "linked":
      // A record in another app (FR-171), picked from what the host lists for this viewer.
      return (
        <div data-graview-part="field" data-graview-field="linked">
          <LinkedPicker relation={spec.relation} value={value} onChange={onChange} label={named} />
        </div>
      );
    case "repeat":
      // How a date repeats, asked for with the picker beside it: none, every day, week, month or year, on which days, until when.
      return <RepeatPicker value={value} onChange={onChange} start={spec.of ? values?.[spec.of] : undefined} label={`${spec.of ? words(spec.of).label : named} repeats`} name={spec.name} />;
    case "opaque":
      // Named rather than silently dropped: an argument the form cannot
      // honestly render is a missing control to build, not a hidden field.
      return (
        <p data-graview-part="unasked">
          “{humanizeField(spec.name)}” needs a structured answer this form cannot ask for yet.
        </p>
      );
  }
}

export interface DerivedFormProps<S extends AnySchema> {
  readonly store: Store<S>;
  readonly mutation: AnyMutationDefinition<S>;
  /** Arguments already decided — a record page's own id, a repair's args. */
  readonly prefilled?: Readonly<Record<string, unknown>>;
  /**
   * The affordance's open parameters, when this form is an act the interface
   * derived. Their `candidates` are the only honest answers for a node
   * reference here; without them the form falls back to every node of the
   * kind, which is what a repair's blank and a list page's creating act get.
   */
  readonly open?: readonly OpenParameter[];
  readonly onDone?: () => void;
  /**
   * Where the fields START, still editable — unlike `prefilled`, which is
   * decided and not asked. Search-to-create begins "A task called “zzz”"
   * with the words already in the name, and the person may still fix the
   * typo that found nothing.
   */
  readonly initial?: Readonly<Record<string, unknown>>;
  /**
   * WHO IS SUBMITTING. The store judges every change against its author
   * and the log attributes to it; a form that applied with no author acted
   * as the anonymous human — who, under a policy, may do nothing — so on
   * the routed face every permitted act was refused on press while the
   * derivation beside it had offered it live. The same principal the page
   * asked "may I?" with is the one that presses submit.
   */
  readonly principal?: Principal;
  /**
   * What the submit button says, when the form is an act offered from where
   * the page stands. An act that `connects` is offered from both ends, and
   * its `title` is written from the subject's: on a song's page the form
   * for putting it in an era was headed "Place it in an era" — the
   * affordance's words from the song's end — and its button said "Put it in
   * the era", the era's. Hand it the affordance's label and they agree.
   */
  readonly label?: string;
  /**
   * The arguments to ASK, when the form answers a question somebody else
   * posed — a repair's `missing`. Everything else is left as the act has it.
   * A repair asking "when did the single come out?" through the derived edit
   * act drew every field the act can change, the name first, and the date
   * typed into the first box renamed the single to "2023-04-14".
   */
  readonly only?: readonly string[];
}

/** The submit path is the ordinary one: `store.apply`, refusals shown. */
export function DerivedForm<S extends AnySchema>({
  store,
  mutation,
  prefilled = {},
  open = [],
  onDone,
  principal,
  initial,
  label,
  only,
}: DerivedFormProps<S>) {
  // A record's change starts from what the record holds, and sends only what was changed from there (Roadmap f-edit-form-prefilled).
  const startOf = () => editStart(mutation, store.graph as never, prefilled);
  const [start, setStart] = useState(startOf);
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...start, ...initial }));
  const [failed, setFailed] = useState<string | null>(null);
  // A field the seat's sight keeps from it is not asked for: the store would refuse it (Roadmap f-field-sight).
  const seat = principal ?? (store as { readonly seenFor?: Principal }).seenFor;
  const subject = mutation.subject && prefilled[mutation.subject.arg];
  const kept = seat ? keptArguments(store, seat, mutation, typeof subject === "string" ? subject : undefined) : undefined;
  // Asked in the order `only` names them, where it names them: a visitor's form asks in the declaration's order.
  const all = formFields(mutation.input);
  const fields = (only === undefined ? all : only.flatMap((name) => all.find((spec) => spec.name === name) ?? [])).filter((spec) => !kept?.has(spec.name));
  const words: Words = (name) => argumentWords(store.schema, mutation, name);
  /*
   * AN END MOVES WITH ITS START (Roadmap f-date-inputs): a start typed or
   * picked carries its end as far as it moved, and a first start puts an
   * empty end an hour after it. The start it moved from is the last one
   * that read as a day, so the words typed on the way ("tomorrow 9…") move
   * nothing.
   */
  const pair = startAndEndOf(fields.filter((spec) => spec.control === "date").map((spec) => spec.name));
  const lastStart = useRef<string | undefined>(undefined);
  const set = (spec: FormField, next: unknown) =>
    setValues((current) => {
      const out = { ...current, [spec.name]: next };
      if (pair && spec.name === pair.start && spec.control === "date") {
        const given = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);
        const before = given(current[pair.start]) ?? lastStart.current;
        if (given(next)) {
          lastStart.current = given(next);
          const end = endAfterStartMoved(before, given(next)!, given(current[pair.end]), { time: spec.time === true, instant: spec.instant === true });
          if (end !== undefined) out[pair.end] = end;
        }
      }
      return out;
    });

  return (
    <form
      data-testid={`form-${mutation.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        try {
          store.apply({ name: mutation.name, args: { ...changedArgs(formArgs(fields, values), start), ...prefilled } }, principal ? { author: principal } : {});
          setFailed(null);
          const next = startOf();
          setStart(next);
          setValues({ ...next });
          onDone?.();
        } catch (error) {
          // A refusal is a result, on a page exactly as in the strip.
          setFailed(failureWords(store.schema, store.allMutations(), error));
        }
      }}
      data-graview-part="form"
    >
      <style>{FORM_CSS}</style>
      {fields.map((spec) => (
        <Control
          key={spec.name}
          store={store}
          spec={spec}
          value={values[spec.name]}
          values={values}
          onChange={(next) => set(spec, next)}
          prefilled={prefilled}
          open={open}
          words={words}
        />
      ))}
      {failed ? (
        <p data-testid="refused" data-graview-part="refused" role="alert">
          {failed}
        </p>
      ) : null}
      <button type="submit" data-graview-part="submit">
        {label ?? mutation.title ?? mutation.name}
      </button>
    </form>
  );
}
