import {
  formFields,
  argumentWords,
  failureWords,
  formArgs,
  humanizeField,
  nounOf,
  labelOf,
  tellApart,
  type AnySchema,
  type FormField,
  type Principal,
  type Store,
} from "@graview/core";
import type { AnyMutationDefinition } from "@graview/core";
import type { OpenParameter } from "@graview/tools";
import { useState, type ReactNode } from "react";

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
label:where([data-graview-part="field"]) {
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

function Control<S extends AnySchema>({
  store,
  spec,
  value,
  onChange,
  prefilled,
  open,
  words = plainWords,
}: {
  store: Store<S>;
  spec: FormField;
  value: unknown;
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
  const title = named + (spec.optional ? "" : " *");

  switch (spec.control) {
    case "text":
    case "date":
      return (
        <label data-graview-part="field" data-graview-field={spec.control}>
          <span data-graview-part="label">{title}</span>
          <input
            type={spec.control === "date" ? (spec.time ? "datetime-local" : "date") : "text"}
            name={spec.name}
            required={!spec.optional}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            data-graview-part="control"
          />
        </label>
      );
    case "number":
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
    case "list": {
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
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...initial }));
  const [failed, setFailed] = useState<string | null>(null);
  const fields = formFields(mutation.input).filter((spec) => only === undefined || only.includes(spec.name));
  const words: Words = (name) => argumentWords(store.schema, mutation, name);

  return (
    <form
      data-testid={`form-${mutation.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        try {
          store.apply({ name: mutation.name, args: { ...formArgs(fields, values), ...prefilled } }, principal ? { author: principal } : {});
          setFailed(null);
          setValues({});
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
          onChange={(next) => setValues((current) => ({ ...current, [spec.name]: next }))}
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
