import {
  formFields,
  humaniseField,
  labelOf,
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

const field: React.CSSProperties = {
  display: "grid",
  // A track the width it was given: see the note on `column` in pages.tsx.
  gridTemplateColumns: "minmax(0, 1fr)",
  minWidth: 0,
  gap: 4,
};
const labelStyle: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--graview-ink-muted)",
};
const controlStyle: React.CSSProperties = {
  font: "inherit",
  /*
   * A TARGET IN EVERY ENGINE, not only in the one it was measured in.
   *
   * Padding and line height alone came to 24 in Chromium and to 22 in
   * WebKit, which has its own intrinsic metrics for a `select` and rounds
   * nothing up for anybody. So every picker on the routed face was under
   * the WCAG 2.2 minimum in the browser iOS ships, and the check that says
   * so (`verify-pages`' `bigEnoughToHit`) only ever ran there through
   * `pnpm engines`.
   */
  minHeight: 24,
  boxSizing: "border-box",
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
};

/**
 * A PICKER THAT STILL LOOKS LIKE ONE.
 *
 * WebKit ignores an author's padding and minimum height on a `select` while
 * the native appearance is on — so every picker on the routed face came out
 * 22 pixels tall in the browser iOS ships, under the 24 WCAG 2.2 asks for,
 * while the same element measured 35 in Chromium. Turning the appearance off
 * is what makes the box the size it was asked to be, and it takes the
 * platform's chevron with it; this puts one back, in the ink the scheme is
 * already using.
 */
const pickerStyle: React.CSSProperties = { ...controlStyle, appearance: "none", paddingRight: 28 };

function Picker({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ position: "relative", display: "grid", minWidth: 0 }}>
      {children}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "0.75rem",
          lineHeight: 1,
          color: "var(--graview-ink-muted)",
          pointerEvents: "none",
        }}
      >
        ▾
      </span>
    </span>
  );
}

function Control<S extends AnySchema>({
  store,
  spec,
  value,
  onChange,
  prefilled,
  open,
}: {
  store: Store<S>;
  spec: FormField;
  value: unknown;
  onChange: (next: unknown) => void;
  prefilled: Readonly<Record<string, unknown>>;
  open: readonly OpenParameter[];
}): ReactNode {
  // An argument the caller already answered — a subject id, a repair's own
  // args — is stated, not asked again.
  if (spec.name in prefilled && spec.control !== "group" && spec.control !== "variant") {
    return null;
  }
  /*
   * A node picker is labelled by what it PICKS — "List", not "List id": the
   * argument's name is an implementation detail, and the kinds it accepts
   * are the declaration's own word for the thing.
   */
  const named =
    spec.control === "node" && !spec.kinds.includes("*")
      ? spec.kinds.map((kind) => humaniseField(kind)).join(" or ")
      : humaniseField(spec.name);
  const title = named + (spec.optional ? "" : " *");

  switch (spec.control) {
    case "text":
    case "date":
      return (
        <label style={field}>
          <span style={labelStyle}>{title}</span>
          <input
            type={spec.control === "date" ? "date" : "text"}
            name={spec.name}
            required={!spec.optional}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            style={controlStyle}
          />
        </label>
      );
    case "number":
      return (
        <label style={field}>
          <span style={labelStyle}>{title}</span>
          <input
            type="number"
            name={spec.name}
            required={!spec.optional}
            {...(spec.min === undefined ? {} : { min: spec.min })}
            {...(spec.max === undefined ? {} : { max: spec.max })}
            value={typeof value === "number" ? value : ""}
            onChange={(event) =>
              onChange(event.target.value === "" ? undefined : Number(event.target.value))
            }
            style={controlStyle}
          />
        </label>
      );
    case "boolean":
      return (
        <label style={{ ...field, gridAutoFlow: "column", justifyContent: "start", alignItems: "center" }}>
          <input
            type="checkbox"
            name={spec.name}
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span style={labelStyle}>{title}</span>
        </label>
      );
    case "choice":
      return (
        <label style={field}>
          <span style={labelStyle}>{title}</span>
          <Picker>
            <select
              name={spec.name}
              required={!spec.optional}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => onChange(event.target.value || undefined)}
              style={pickerStyle}
            >
              <option value="">—</option>
              {(spec.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
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
      return (
        <label style={field}>
          <span style={labelStyle}>{title}</span>
          <Picker>
            <select
              name={spec.name}
              required={!spec.optional}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => onChange(event.target.value || undefined)}
              style={pickerStyle}
            >
              <option value="">—</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {labelOf(store.schema.tryDefinition(candidate.kind), candidate)}
                </option>
              ))}
            </select>
          </Picker>
        </label>
      );
    }
    case "group": {
      const held = (value ?? {}) as Record<string, unknown>;
      return (
        <fieldset style={{ display: "grid", gap: 10, border: "1px solid var(--graview-edge)", borderRadius: 10, padding: 12 }}>
          <legend style={labelStyle}>{title}</legend>
          {spec.fields.map((child) => (
            <Control
              key={child.name}
              store={store}
              spec={child}
              value={held[child.name]}
              onChange={(next) => onChange({ ...held, [child.name]: next })}
              prefilled={prefilled}
              open={open}
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
        <fieldset style={{ display: "grid", gap: 10, border: "1px solid var(--graview-edge)", borderRadius: 10, padding: 12 }}>
          <legend style={labelStyle}>{title}</legend>
          <label style={field}>
            <span style={labelStyle}>{humaniseField(spec.tag)}</span>
            <select
              value={chosen}
              onChange={(event) => onChange({ [spec.tag]: event.target.value })}
              style={controlStyle}
            >
              <option value="">—</option>
              {spec.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {humaniseField(option.value)}
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
            />
          ))}
        </fieldset>
      );
    }
    case "list": {
      const items = Array.isArray(value) ? (value as unknown[]) : [];
      return (
        <fieldset style={{ display: "grid", gap: 8, border: "1px solid var(--graview-edge)", borderRadius: 10, padding: 12 }}>
          <legend style={labelStyle}>{title}</legend>
          {items.map((item, index) => (
            <div key={index} style={{ display: "flex", gap: 8, alignItems: "end" }}>
              <div style={{ flex: 1 }}>
                <Control
                  store={store}
                  spec={{ ...spec.item, optional: false }}
                  value={item}
                  onChange={(next) => onChange(items.map((held, at) => (at === index ? next : held)))}
                  prefilled={prefilled}
                  open={open}
                />
              </div>
              <button type="button" onClick={() => onChange(items.filter((_, at) => at !== index))}>
                remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...items, undefined])} style={{ justifySelf: "start" }}>
            add another
          </button>
        </fieldset>
      );
    }
    case "opaque":
      // Named rather than silently dropped: an argument the form cannot
      // honestly render is a missing control to build, not a hidden field.
      return (
        <p style={{ ...labelStyle, margin: 0 }}>
          “{humaniseField(spec.name)}” needs a structured answer this form cannot ask for yet.
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
}: DerivedFormProps<S>) {
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...initial }));
  const [failed, setFailed] = useState<string | null>(null);
  const fields = formFields(mutation.input);

  return (
    <form
      data-testid={`form-${mutation.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        try {
          store.apply({ name: mutation.name, args: { ...values, ...prefilled } }, principal ? { author: principal } : {});
          setFailed(null);
          setValues({});
          onDone?.();
        } catch (error) {
          // A refusal is a result, on a page exactly as in the strip.
          setFailed(error instanceof Error ? error.message : String(error));
        }
      }}
      // A form is a grid item of the section above it and a grid container
      // for the fields below: both halves have to be allowed to be narrower
      // than what is in them, or a big enough text size pushes the page
      // sideways. See the note on `column` in pages.tsx.
      style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0, gap: 12 }}
    >
      {fields.map((spec) => (
        <Control
          key={spec.name}
          store={store}
          spec={spec}
          value={values[spec.name]}
          onChange={(next) => setValues((current) => ({ ...current, [spec.name]: next }))}
          prefilled={prefilled}
          open={open}
        />
      ))}
      {failed ? (
        <p data-testid="refused" role="alert" style={{ margin: 0, color: "var(--graview-warn)", fontSize: "0.875rem" }}>
          {failed}
        </p>
      ) : null}
      <button type="submit" style={{ justifySelf: "start" }}>
        {label ?? mutation.title ?? mutation.name}
      </button>
    </form>
  );
}
