import { isoDate, nodeRefKinds } from "@graview/core";

/*
 * A CHECKOUT'S OWN ZOD, WRITTEN BACK AS IT WAS WRITTEN.
 *
 * The studio's graph knows a field's type, whether it is required and its
 * options — and nothing of its bounds. Writing a kind back from that alone
 * turned `z.string().min(1).max(60)` into `z.string().min(1)` (so the
 * round trip itself raised `label-unbounded` on every kind), a track
 * number's `.int().min(1).max(99)` into `z.number()`, `isoDate` into any
 * string, and gave an optional note a `.min(1)` it never had. An act the
 * checkout wrote had its input re-derived from its kind's fields: a song
 * gained `explicit` and `status` arguments it never took, and a release
 * lost `released`. Where the checkout declared a schema, this prints THAT
 * schema; where it cannot print one faithfully it says so with `null`, and
 * the caller falls back to the graph's reading.
 */

type Def = {
  readonly type?: string;
  readonly checks?: readonly unknown[];
  readonly innerType?: unknown;
  readonly element?: unknown;
  readonly entries?: Record<string, unknown>;
  readonly values?: readonly unknown[];
  readonly defaultValue?: unknown;
  readonly shape?: Record<string, unknown>;
  readonly options?: readonly unknown[];
};
type Check = {
  readonly check?: string;
  readonly format?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly length?: number;
  readonly value?: number;
  readonly inclusive?: boolean;
  readonly pattern?: RegExp | string;
};

const defOf = (type: unknown): Def =>
  type === null || typeof type !== "object"
    ? {}
    : ((type as { _zod?: { def?: Def } })._zod?.def ?? (type as { _def?: Def })._def ?? {}) as Def;
const checkOf = (check: unknown): Check =>
  check === null || typeof check !== "object" ? {} : (((check as { _zod?: { def?: Check } })._zod?.def ?? check) as Check);
const q = (text: string): string => JSON.stringify(text);

/** What a printed schema needs imported beside `z`. */
export interface ZodUses {
  nodeRef: boolean;
  isoDate: boolean;
}

export function printZod(type: unknown, uses: ZodUses = { nodeRef: false, isoDate: false }): string | null {
  if (type === null || typeof type !== "object") return null;
  const def = defOf(type);
  switch (def.type) {
    case "optional":
    case "nullable": {
      const inner = printZod(def.innerType, uses);
      return inner === null ? null : `${inner}.${def.type}()`;
    }
    case "default": {
      const inner = printZod(def.innerType, uses);
      const value = typeof def.defaultValue === "function" ? undefined : def.defaultValue;
      return inner === null || value === undefined ? null : `${inner}.default(${JSON.stringify(value)})`;
    }
  }
  const kinds = nodeRefKinds(type);
  if (kinds) {
    uses.nodeRef = true;
    return kinds.length === 1 && kinds[0] === "*" ? "nodeRef()" : `nodeRef([${kinds.map(q).join(", ")}])`;
  }
  if (type === isoDate || (def.type === "string" && String(checkOf(def.checks?.[0]).pattern) === String(checkOf(defOf(isoDate).checks?.[0]).pattern) && def.checks?.length === 1)) {
    uses.isoDate = true;
    return "isoDate";
  }
  switch (def.type) {
    case "string": {
      let out = "z.string()";
      for (const raw of def.checks ?? []) {
        const check = checkOf(raw);
        if (check.check === "min_length") out += `.min(${check.minimum})`;
        else if (check.check === "max_length") out += `.max(${check.maximum})`;
        else if (check.check === "length_equals") out += `.length(${check.length})`;
        else if (check.check === "string_format" && check.format === "regex" && check.pattern !== undefined) out += `.regex(${String(check.pattern)})`;
        else if (check.check === "string_format" && (check.format === "email" || check.format === "url" || check.format === "uuid")) out += `.${check.format}()`;
        else return null;
      }
      return out;
    }
    case "number": {
      let out = "z.number()";
      for (const raw of def.checks ?? []) {
        const check = checkOf(raw);
        if (check.check === "number_format" && (check.format === "safeint" || check.format === "int32")) out += ".int()";
        else if (check.check === "greater_than") out += check.inclusive ? `.min(${check.value})` : `.gt(${check.value})`;
        else if (check.check === "less_than") out += check.inclusive ? `.max(${check.value})` : `.lt(${check.value})`;
        else return null;
      }
      return out;
    }
    case "boolean":
      return (def.checks?.length ?? 0) === 0 ? "z.boolean()" : null;
    case "enum":
      return `z.enum([${Object.values(def.entries ?? {}).map((value) => q(String(value))).join(", ")}])`;
    case "literal":
      return def.values?.length === 1 ? `z.literal(${JSON.stringify(def.values[0])})` : null;
    case "array": {
      const element = printZod(def.element, uses);
      if (element === null) return null;
      let out = `z.array(${element})`;
      for (const raw of def.checks ?? []) {
        const check = checkOf(raw);
        if (check.check === "min_length") out += `.min(${check.minimum})`;
        else if (check.check === "max_length") out += `.max(${check.maximum})`;
        else return null;
      }
      return out;
    }
    case "object": {
      const shape = (type as { shape?: Record<string, unknown> }).shape ?? def.shape ?? {};
      const parts: string[] = [];
      for (const [name, field] of Object.entries(shape)) {
        const printed = printZod(field, uses);
        if (printed === null) return null;
        parts.push(`${/^[a-z_$][\w$]*$/i.test(name) ? name : q(name)}: ${printed}`);
      }
      return `z.object({ ${parts.join(", ")} })`;
    }
    case "union": {
      const options = (def.options ?? []).map((option) => printZod(option, uses));
      return options.some((option) => option === null) ? null : `z.union([${options.join(", ")}])`;
    }
    default:
      return null;
  }
}
