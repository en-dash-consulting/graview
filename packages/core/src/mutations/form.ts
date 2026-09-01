import type { z } from "zod";
import { describeArg, nodeRefKinds } from "./node-ref.js";

/**
 * A FORM, derived from a mutation's own input declaration.
 *
 * `argShape` answers "what sort of answer does one scalar argument want",
 * which is enough for a prompt in the actions strip. A page is mostly forms,
 * and a form needs the whole tree: a structured object is a fieldset, a
 * discriminated union is a type picker followed by that type's fields, an
 * array is a repeatable row. Until this existed, any mutation with a
 * structured argument was honestly un-askable — the strip withheld it — and
 * a routed page cannot withhold "New agreement": it has to render.
 *
 * Everything here is PLAIN DATA. A renderer (a page, the strip, an agent
 * explaining itself) walks the tree; nothing downstream touches zod.
 */
export type FormField =
  | ScalarField
  | { readonly control: "node"; readonly name: string; readonly optional: boolean; readonly kinds: readonly string[] }
  | { readonly control: "group"; readonly name: string; readonly optional: boolean; readonly fields: readonly FormField[] }
  | {
      readonly control: "variant";
      readonly name: string;
      readonly optional: boolean;
      /** The discriminating literal field shared by every option. */
      readonly tag: string;
      readonly options: readonly {
        readonly value: string;
        /** The option's remaining fields, the tag excluded. */
        readonly fields: readonly FormField[];
      }[];
    }
  | { readonly control: "list"; readonly name: string; readonly optional: boolean; readonly item: FormField }
  | { readonly control: "opaque"; readonly name: string; readonly optional: boolean };

export interface ScalarField {
  readonly control: "text" | "date" | "number" | "choice" | "boolean";
  readonly name: string;
  readonly optional: boolean;
  readonly options?: readonly string[];
  readonly min?: number;
  readonly max?: number;
}

type ZodLike = {
  _def?: {
    type?: string;
    innerType?: unknown;
    options?: readonly unknown[];
    element?: unknown;
    values?: readonly unknown[];
    entries?: Record<string, string>;
  };
  shape?: Record<string, unknown>;
  safeParse?: (value: unknown) => { success: boolean };
};

const unwrap = (schema: unknown): unknown => {
  const inner = (schema as ZodLike)._def?.innerType;
  return inner === undefined ? schema : unwrap(inner);
};

const isOptional = (schema: unknown): boolean =>
  (schema as ZodLike).safeParse?.(undefined).success ?? false;

const shapeOf = (schema: unknown): Record<string, unknown> | undefined =>
  (unwrap(schema) as ZodLike).shape;

/** The single literal value of a zod literal, or undefined. */
const literalValue = (schema: unknown): string | undefined => {
  const field = unwrap(schema) as ZodLike;
  if (field._def?.type !== "literal") return undefined;
  const values = field._def.values;
  return values && values.length === 1 && typeof values[0] === "string" ? values[0] : undefined;
};

/** Describes one argument as a form control tree. */
export function formField(name: string, schema: unknown): FormField {
  const optional = isOptional(schema);
  const field = unwrap(schema) as ZodLike;
  const type = field._def?.type;

  const kinds = nodeRefKinds(schema);
  if (kinds) return { control: "node", name, optional, kinds };

  if (type === "boolean") return { control: "boolean", name, optional };

  if (type === "object") {
    const shape = field.shape ?? {};
    return {
      control: "group",
      name,
      optional,
      fields: Object.entries(shape).map(([child, childSchema]) => formField(child, childSchema)),
    };
  }

  if (type === "union") {
    const options = field._def?.options ?? [];
    /*
     * A DISCRIMINATED union renders as one picker and then that option's
     * fields — the household example's constraint spec is the canonical case. The tag is
     * whichever literal field every option shares; without one, a union of
     * scalars collapses to a choice when every arm is a literal, and
     * anything else is opaque rather than guessed at.
     */
    const shapes = options.map((option) => shapeOf(option));
    if (shapes.every((shape) => shape !== undefined)) {
      const tag = Object.keys(shapes[0] ?? {}).find((key) =>
        shapes.every((shape) => literalValue(shape?.[key]) !== undefined),
      );
      if (tag) {
        return {
          control: "variant",
          name,
          optional,
          tag,
          options: options.map((option, index) => ({
            value: literalValue(shapes[index]?.[tag]) ?? "",
            fields: Object.entries(shapes[index] ?? {})
              .filter(([key]) => key !== tag)
              .map(([child, childSchema]) => formField(child, childSchema)),
          })),
        };
      }
    }
    const literals = options.map((option) => literalValue(option));
    if (literals.every((value) => value !== undefined)) {
      return { control: "choice", name, optional, options: literals as string[] };
    }
    return { control: "opaque", name, optional };
  }

  if (type === "array") {
    const element = field._def?.element;
    if (element !== undefined) {
      return { control: "list", name, optional, item: formField(name, element) };
    }
    return { control: "opaque", name, optional };
  }

  const scalar = describeArg(schema);
  if (scalar.type === "text" || scalar.type === "date") return { control: scalar.type, name, optional };
  if (scalar.type === "number") {
    return {
      control: "number",
      name,
      optional,
      ...(scalar.min === undefined ? {} : { min: scalar.min }),
      ...(scalar.max === undefined ? {} : { max: scalar.max }),
    };
  }
  if (scalar.type === "choice") return { control: "choice", name, optional, options: scalar.options };

  return { control: "opaque", name, optional };
}

/** The whole form for a mutation input object, one field per argument. */
export function formFields(input: z.ZodType | unknown): readonly FormField[] {
  const shape = (input as ZodLike).shape;
  if (!shape) return [];
  return Object.entries(shape).map(([name, schema]) => formField(name, schema));
}

/** True when every control in the tree is renderable — nothing opaque. */
export function formComplete(fields: readonly FormField[]): boolean {
  return fields.every((field) => {
    switch (field.control) {
      case "opaque":
        return false;
      case "group":
        return formComplete(field.fields);
      case "variant":
        return field.options.every((option) => formComplete(option.fields));
      case "list":
        return formComplete([field.item]);
      default:
        return true;
    }
  });
}
