import {
  formFields,
  humaniseField,
  labelOf,
  type AnySchema,
  type FormField,
  type Store,
} from "@graview/core";
import type { AnyMutationDefinition } from "@graview/core";
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
  gap: 4,
};
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--graview-ink-muted)",
};
const controlStyle: React.CSSProperties = {
  font: "inherit",
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
};

function Control<S extends AnySchema>({
  store,
  spec,
  value,
  onChange,
  prefilled,
}: {
  store: Store<S>;
  spec: FormField;
  value: unknown;
  onChange: (next: unknown) => void;
  prefilled: Readonly<Record<string, unknown>>;
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
          <select
            name={spec.name}
            required={!spec.optional}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value || undefined)}
            style={controlStyle}
          >
            <option value="">—</option>
            {(spec.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );
    case "node": {
      const candidates = spec.kinds.includes("*")
        ? [...store.graph.allNodes()]
        : spec.kinds.flatMap((kind) => store.graph.nodesOfKind(kind as never));
      return (
        <label style={field}>
          <span style={labelStyle}>{title}</span>
          <select
            name={spec.name}
            required={!spec.optional}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value || undefined)}
            style={controlStyle}
          >
            <option value="">—</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {labelOf(store.schema.tryDefinition(candidate.kind), candidate as never)}
              </option>
            ))}
          </select>
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
  readonly onDone?: () => void;
}

/** The submit path is the ordinary one: `store.apply`, refusals shown. */
export function DerivedForm<S extends AnySchema>({
  store,
  mutation,
  prefilled = {},
  onDone,
}: DerivedFormProps<S>) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const fields = formFields(mutation.input);

  return (
    <form
      data-testid={`form-${mutation.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        try {
          store.apply({ name: mutation.name, args: { ...values, ...prefilled } });
          setFailed(null);
          setValues({});
          onDone?.();
        } catch (error) {
          // A refusal is a result, on a page exactly as in the strip.
          setFailed(error instanceof Error ? error.message : String(error));
        }
      }}
      style={{ display: "grid", gap: 12 }}
    >
      {fields.map((spec) => (
        <Control
          key={spec.name}
          store={store}
          spec={spec}
          value={values[spec.name]}
          onChange={(next) => setValues((current) => ({ ...current, [spec.name]: next }))}
          prefilled={prefilled}
        />
      ))}
      {failed ? (
        <p data-testid="refused" role="alert" style={{ margin: 0, color: "var(--graview-warn)", fontSize: 13 }}>
          {failed}
        </p>
      ) : null}
      <button type="submit" style={{ justifySelf: "start" }}>
        {mutation.title ?? mutation.name}
      </button>
    </form>
  );
}
