import { globalRegistry } from "./zod.js";

/*
 * A SCHEMA'S JSON SCHEMA, WRITTEN BY GRAVIEW (the headroom after 0.1.29).
 *
 * zod writes JSON Schema itself (`z.toJSONSchema`), and its writer is about
 * 20 KB. A bundler places a whole file in the first chunk when the page can
 * reach it, and every barrel of zod's a page imports to build an app's
 * fields reaches that writer — so the moment the seat called it to list an
 * act's tool, all 20 KB rode up front on every hosted page, though only the
 * seat, fetched when first asked, ever wrote a tool.
 *
 * This writes the same schema from `_zod.def` and the registry, as zod's
 * writer does for draft 2020-12 over a schema's INPUT with what JSON Schema
 * cannot say left open — the one way the framework ever asks — and nothing
 * on a page reaches zod's. `a-tool-schema-is-written-as-zod-writes-it`
 * holds the two equal over every example app's acts and kinds and every
 * kind of schema zod has.
 */

export type JsonSchema = Record<string, unknown>;

type Def = Record<string, any>;
interface Schema {
  readonly _zod: {
    readonly def: Def;
    readonly traits: Set<string>;
    readonly bag: Def;
    readonly optin?: string;
    readonly parent?: Schema;
    readonly innerType?: Schema;
    readonly pattern?: RegExp;
    readonly values?: Set<unknown>;
    readonly toJSONSchema?: () => JsonSchema | undefined;
  };
}

/** What a caller may do to each schema's JSON once it is written, as zod's `override` does. */
export type Override = (ctx: { readonly zodSchema: unknown; readonly jsonSchema: JsonSchema }) => void;

type Agg = { minimum?: number; maximum?: number; exclusiveMinimum?: number; exclusiveMaximum?: number; multipleOf?: number[]; format?: string; isInt?: boolean; patterns?: Set<RegExp>; mime?: string[]; contentEncoding?: string; laxFormat?: boolean };

const narrowMin = (agg: Agg, key: "minimum" | "exclusiveMinimum", value: number) => {
  if (agg[key] === undefined || value > agg[key]!) agg[key] = value;
};
const narrowMax = (agg: Agg, key: "maximum" | "exclusiveMaximum", value: number) => {
  if (agg[key] === undefined || value < agg[key]!) agg[key] = value;
};
const setFormat = (agg: Agg, format: string) => {
  agg.format = format;
  if (format.includes("int")) agg.isInt = true;
};
const intersectMime = (agg: Agg, mime: string[]) => {
  agg.mime = agg.mime ? agg.mime.filter((one) => mime.includes(one)) : [...mime];
};
const addDivisor = (agg: Agg, value: number) => {
  agg.multipleOf ??= [];
  if (!agg.multipleOf.includes(value)) agg.multipleOf.push(value);
};
const addPattern = (agg: Agg, pattern: RegExp) => (agg.patterns ??= new Set()).add(pattern);

const NUMBER_FORMAT_RANGES: Record<string, [number, number]> = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-3.4028234663852886e38, 3.4028234663852886e38],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE],
};

/** Every check a schema carries, folded into the bounds, format and patterns JSON Schema says. */
function aggregate(schema: Schema): Agg {
  const agg: Agg = {};
  const { def, bag } = schema._zod;
  const checks: Schema[] = schema._zod.traits.has("$ZodCheck") ? [schema, ...(def["checks"] ?? [])] : (def["checks"] ?? []);
  for (const check of checks) {
    const c = check._zod.def;
    switch (c["check"]) {
      case "greater_than": narrowMin(agg, c["inclusive"] ? "minimum" : "exclusiveMinimum", c["value"]); break;
      case "less_than": narrowMax(agg, c["inclusive"] ? "maximum" : "exclusiveMaximum", c["value"]); break;
      case "multiple_of": addDivisor(agg, c["value"]); break;
      case "number_format": {
        setFormat(agg, c["format"]);
        const range = NUMBER_FORMAT_RANGES[c["format"]];
        if (range) narrowMin(agg, "minimum", range[0]), narrowMax(agg, "maximum", range[1]);
        break;
      }
      case "bigint_format": setFormat(agg, c["format"]); break;
      case "min_length": case "min_size": narrowMin(agg, "minimum", c["minimum"]); break;
      case "max_length": case "max_size": narrowMax(agg, "maximum", c["maximum"]); break;
      case "length_equals": narrowMin(agg, "minimum", c["length"]), narrowMax(agg, "maximum", c["length"]); break;
      case "size_equals": narrowMin(agg, "minimum", c["size"]), narrowMax(agg, "maximum", c["size"]); break;
      case "string_format":
        setFormat(agg, c["format"]);
        if (c["pattern"]) addPattern(agg, c["pattern"]);
        if (c["format"] === "base64" || c["format"] === "base64url") agg.contentEncoding = c["format"];
        if (c["local"] || c["precision"] === -1) agg.laxFormat = true;
        break;
      case "mime_type": intersectMime(agg, c["mime"]); break;
    }
  }
  if (bag["minimum"] !== undefined) narrowMin(agg, "minimum", bag["minimum"]);
  if (bag["exclusiveMinimum"] !== undefined) narrowMin(agg, "exclusiveMinimum", bag["exclusiveMinimum"]);
  if (bag["maximum"] !== undefined) narrowMax(agg, "maximum", bag["maximum"]);
  if (bag["exclusiveMaximum"] !== undefined) narrowMax(agg, "exclusiveMaximum", bag["exclusiveMaximum"]);
  if (bag["multipleOf"] !== undefined) addDivisor(agg, bag["multipleOf"]);
  if (bag["format"] !== undefined) {
    agg.format ??= bag["format"];
    if (bag["format"].includes("int")) agg.isInt = true;
  }
  if (bag["mime"]) intersectMime(agg, bag["mime"]);
  for (const pattern of bag["patterns"] ?? []) addPattern(agg, pattern);
  return agg;
}

const FORMATS: Record<string, string> = { guid: "uuid", url: "uri", datetime: "date-time", json_string: "json-string", regex: "" };

/** Whether a field may be left out of an input: past a transform's pipe and a catch, to what carries the optionality. */
function inputOptin(schema: Schema): string | undefined {
  const def = schema._zod.def;
  if (def["type"] === "pipe" && def["in"]._zod.traits.has("$ZodTransform")) return inputOptin(def["out"]);
  if (def["type"] === "catch") return inputOptin(def["innerType"]);
  return schema._zod.optin;
}

const WRAPS = new Set(["promise", "optional", "nonoptional", "nullable", "readonly", "default", "prefault", "catch"]);

/** Whether a schema transforms what it parses, so its default and examples say its output, not its input. */
function transforms(schema: Schema, seen = new Set<Schema>()): boolean {
  if (seen.has(schema)) return false;
  seen.add(schema);
  const def = schema._zod.def;
  const type = def["type"];
  if (type === "transform") return true;
  if (type === "array") return transforms(def["element"], seen);
  if (type === "set") return transforms(def["valueType"], seen);
  if (type === "lazy") return transforms(def["getter"](), seen);
  if (WRAPS.has(type)) return transforms(def["innerType"], seen);
  if (type === "intersection") return transforms(def["left"], seen) || transforms(def["right"], seen);
  if (type === "record" || type === "map") return transforms(def["keyType"], seen) || transforms(def["valueType"], seen);
  if (type === "pipe") return schema._zod.traits.has("$ZodCodec") || transforms(def["in"], seen) || transforms(def["out"], seen);
  if (type === "object") return Object.values(def["shape"] as Record<string, Schema>).some((field) => transforms(field, seen));
  if (type === "union") return (def["options"] as Schema[]).some((option) => transforms(option, seen));
  if (type === "tuple") return (def["items"] as Schema[]).some((item) => transforms(item, seen)) || (def["rest"] ? transforms(def["rest"], seen) : false);
  return false;
}

function enumValues(entries: Record<string, unknown>): unknown[] {
  const numeric = Object.values(entries).filter((value) => typeof value === "number");
  return Object.entries(entries).filter(([key]) => numeric.indexOf(+key) === -1).map(([, value]) => value);
}

/** `anyOf` of bare types said as one `type` list, as zod says it. */
function compactTypeUnion(json: JsonSchema): void {
  const options = json["anyOf"];
  if (!Array.isArray(options) || options.length === 0 || json["type"] !== undefined) return;
  const types: string[] = [];
  for (const option of options) {
    if (!option || typeof option !== "object") return;
    compactTypeUnion(option);
    const keys = Object.keys(option);
    if (keys.length !== 1 || keys[0] !== "type") return;
    for (const member of [option.type].flat()) {
      if (typeof member !== "string") return;
      if (!types.includes(member)) types.push(member);
    }
  }
  delete json["anyOf"];
  json["type"] = types.length === 1 ? types[0] : types;
}

const FOLDABLE = new Set(["type", "properties", "required", "additionalProperties"]);
const undeclared = (member: JsonSchema): JsonSchema | null => {
  const extra = member["additionalProperties"];
  return extra && typeof extra === "object" && Object.keys(extra).length ? (extra as JsonSchema) : null;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Object members of an intersection, folded into the one object they describe together — or null when one says more than that. */
function foldObjects(members: readonly JsonSchema[]): JsonSchema | null {
  for (const member of members) {
    if (typeof member !== "object" || member["type"] !== "object") return null;
    for (const key in member) if (!FOLDABLE.has(key)) return null;
  }
  const properties: JsonSchema = {};
  const required = new Set<string>();
  for (const object of members) {
    for (const key in object["properties"] as JsonSchema) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) continue;
      const parts: JsonSchema[] = [];
      for (const other of members) {
        const part = ((other["properties"] as JsonSchema | undefined)?.[key] as JsonSchema | undefined) ?? undeclared(other);
        if (part && !parts.some((one) => same(one, part))) parts.push(part);
      }
      properties[key] = parts.length === 1 ? parts[0] : (foldObjects(parts) ?? { allOf: parts });
    }
    for (const key of (object["required"] as string[] | undefined) ?? []) required.add(key);
  }
  const folded: JsonSchema = { type: "object", properties };
  if (required.size) folded["required"] = [...required];
  if (members.every((object) => object["additionalProperties"] === false)) folded["additionalProperties"] = false;
  else {
    const constraints: JsonSchema[] = [];
    for (const object of members) {
      const constraint = undeclared(object);
      if (constraint && !constraints.some((one) => same(one, constraint))) constraints.push(constraint);
    }
    if (constraints.length === 1) folded["additionalProperties"] = constraints[0];
    else if (constraints.length > 1) folded["additionalProperties"] = { allOf: constraints };
  }
  return folded;
}

function foldIntersection(json: JsonSchema): void {
  const allOf = json["allOf"] as JsonSchema[];
  if (!Array.isArray(allOf) || allOf.length < 2) return;
  for (const key of FOLDABLE) if (key in json) return;
  const unions = allOf.filter((member) => Array.isArray(member["oneOf"]) || Array.isArray(member["anyOf"]));
  let folded: JsonSchema | null;
  if (!unions.length) folded = foldObjects(allOf);
  else {
    const union = unions[0]!;
    const keyword = Array.isArray(union["oneOf"]) ? "oneOf" : "anyOf";
    if (Object.keys(union).length !== 1) return;
    const rest = allOf.filter((member) => member !== union);
    const branches = (union[keyword] as JsonSchema[]).map((branch) => foldObjects([...rest, branch]));
    if (branches.some((branch) => !branch)) return;
    folded = { [keyword]: branches };
  }
  if (!folded) return;
  delete json["allOf"];
  Object.assign(json, folded);
}

/** A record's numeric key said over the string a JSON key is. */
function stringKeys(json: JsonSchema): JsonSchema {
  let out = json;
  for (const keyword of ["anyOf", "oneOf"]) {
    const branches = out[keyword];
    if (!Array.isArray(branches)) continue;
    const mapped = branches.map(stringKeys);
    if (mapped.some((branch, i) => branch !== branches[i])) out = { ...out, [keyword]: mapped };
  }
  const types = [out["type"]].flat();
  const numeric = !types.includes("string") && types.some((type) => type === "number" || type === "integer");
  const values = (out["enum"] as unknown[] | undefined) ?? (out["const"] !== undefined ? [out["const"]] : undefined);
  if (!numeric && !values?.some((value) => typeof value === "number")) return out;
  const { minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, format, id, ...rest } = out;
  if (rest["enum"]) rest["enum"] = (rest["enum"] as unknown[]).map((value) => (typeof value === "number" ? String(value) : value));
  else if (typeof rest["const"] === "number") rest["const"] = String(rest["const"]);
  if (!numeric) return rest;
  rest["type"] = "string";
  if (!values) rest["pattern"] = types.includes("number") ? "^-?\\d+(?:\\.\\d+)?$" : "^-?\\d+$";
  return rest;
}

class Writer {
  /** What each schema came to, once written: a schema met twice is written once, as zod's `seen`. */
  private readonly done = new Map<Schema, JsonSchema>();
  /** The schemas being written, outermost first: one met again inside itself is a cycle. */
  private readonly path: Schema[] = [];
  /** Cycles met, each written once into `$defs` under the name zod gives it. */
  readonly cyclic = new Map<Schema, string>();
  constructor(
    private readonly override: Override,
    private readonly refs: ReadonlyMap<Schema, string>,
  ) {}

  write(schema: Schema, top = false): JsonSchema {
    const ref = this.refs.get(schema);
    if (ref !== undefined && !top) return { $ref: ref };
    if (this.path.includes(schema)) {
      if (!this.cyclic.has(schema)) this.cyclic.set(schema, "");
      return {};
    }
    const done = this.done.get(schema);
    if (done) return done;
    this.path.push(schema);
    try {
      const json = this.written(schema);
      this.done.set(schema, json);
      return json;
    } finally {
      this.path.pop();
    }
  }

  private written(schema: Schema): JsonSchema {
    const own: JsonSchema = {};
    let inner: Schema | undefined;
    const said = schema._zod.toJSONSchema?.();
    if (said) Object.assign(own, said);
    else inner = this.process(schema, own);
    const meta = globalRegistry.get(schema as never) as JsonSchema | undefined;
    if (meta) for (const key of Object.keys(meta)) own[key] = meta[key];
    if (transforms(schema)) delete own["examples"], delete own["default"];
    if ("_prefault" in own) {
      own["default"] ??= own["_prefault"];
      delete own["_prefault"];
    }
    let json = own;
    if (inner) {
      const base = this.write(inner);
      json = { ...own };
      for (const key of Object.keys(base)) if (!(key in own)) json[key] = base[key];
    }
    this.override({ zodSchema: schema, jsonSchema: json });
    compactTypeUnion(json);
    if (schema._zod.def["type"] === "intersection") foldIntersection(json);
    return json;
  }

  /** Writes what the schema says of itself into `json`; returns the schema it wraps, whose JSON it then takes on. */
  private process(schema: Schema, json: JsonSchema): Schema | undefined {
    const def = schema._zod.def;
    switch (def["type"]) {
      case "string": {
        json["type"] = "string";
        const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregate(schema);
        if (typeof minimum === "number") json["minLength"] = minimum;
        if (typeof maximum === "number") json["maxLength"] = maximum;
        if (format) {
          json["format"] = FORMATS[format] ?? format;
          if (json["format"] === "" || format === "time" || laxFormat) delete json["format"];
        }
        if (contentEncoding) json["contentEncoding"] = contentEncoding;
        if (patterns && patterns.size > 0) {
          const list = [...patterns];
          if (list.length === 1) json["pattern"] = list[0]!.source;
          else json["allOf"] = list.map((pattern) => ({ pattern: pattern.source }));
        }
        return undefined;
      }
      case "number": {
        const { minimum, maximum, multipleOf, exclusiveMinimum, exclusiveMaximum, isInt } = aggregate(schema);
        json["type"] = isInt ? "integer" : "number";
        if (typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY)) json["exclusiveMinimum"] = exclusiveMinimum;
        else if (typeof minimum === "number") json["minimum"] = minimum;
        if (typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY)) json["exclusiveMaximum"] = exclusiveMaximum;
        else if (typeof maximum === "number") json["maximum"] = maximum;
        if (multipleOf) {
          const [first, ...rest] = new Set(multipleOf.filter((divisor) => Number.isFinite(divisor) && divisor !== 0).map(Math.abs));
          if (first !== undefined) json["multipleOf"] = first;
          if (rest.length) json["allOf"] = [...((json["allOf"] as unknown[]) ?? []), ...rest.map((divisor) => ({ multipleOf: divisor }))];
        }
        return undefined;
      }
      case "boolean":
      case "success":
        json["type"] = "boolean";
        return undefined;
      case "null":
        json["type"] = "null";
        return undefined;
      case "never":
        json["not"] = {};
        return undefined;
      case "enum": {
        const values = enumValues(def["entries"]);
        if (values.length === 0) json["not"] = {};
        else {
          if (values.every((value) => typeof value === "number")) json["type"] = "number";
          if (values.every((value) => typeof value === "string")) json["type"] = "string";
          json["enum"] = values;
        }
        return undefined;
      }
      case "literal": {
        const values = (def["values"] as unknown[]).filter((value) => value !== undefined).map((value) => (typeof value === "bigint" ? Number(value) : value));
        if (def["values"].length === 0) json["not"] = {};
        else if (values.length === 1) {
          json["type"] = values[0] === null ? "null" : typeof values[0];
          json["const"] = values[0];
        } else if (values.length > 1) {
          for (const type of ["number", "string", "boolean"]) if (values.every((value) => typeof value === type)) json["type"] = type;
          if (values.every((value) => value === null)) json["type"] = "null";
          json["enum"] = values;
        }
        return undefined;
      }
      case "template_literal":
        json["type"] = "string";
        json["pattern"] = schema._zod.pattern!.source;
        return undefined;
      case "file": {
        json["type"] = "string";
        json["format"] = "binary";
        json["contentEncoding"] = "binary";
        const { minimum, maximum, mime } = aggregate(schema);
        if (minimum !== undefined) json["minLength"] = minimum;
        if (maximum !== undefined) json["maxLength"] = maximum;
        if (mime) {
          if (mime.length === 0) json["not"] = {};
          else if (mime.length === 1) json["contentMediaType"] = mime[0];
          else json["anyOf"] = mime.map((one) => ({ contentMediaType: one }));
        }
        return undefined;
      }
      case "array": {
        const { minimum, maximum } = aggregate(schema);
        if (typeof minimum === "number") json["minItems"] = minimum;
        if (typeof maximum === "number") json["maxItems"] = maximum;
        json["type"] = "array";
        json["items"] = this.write(def["element"]);
        return undefined;
      }
      case "object": {
        const shape = def["shape"] as Record<string, Schema>;
        json["type"] = "object";
        const properties: JsonSchema = {};
        json["properties"] = properties;
        for (const key in shape) Object.defineProperty(properties, key, { value: this.write(shape[key]!), writable: true, enumerable: true, configurable: true });
        const required = Object.keys(shape).filter((key) => inputOptin(shape[key]!) === undefined);
        if (required.length > 0) json["required"] = required;
        if (def["catchall"]?._zod.def.type === "never") json["additionalProperties"] = false;
        else if (def["catchall"]) json["additionalProperties"] = this.write(def["catchall"]);
        return undefined;
      }
      case "union":
        json[def["inclusive"] === false ? "oneOf" : "anyOf"] = (def["options"] as Schema[]).map((option) => this.write(option));
        return undefined;
      case "intersection": {
        const simple = (one: JsonSchema) => "allOf" in one && Object.keys(one).length === 1;
        const a = this.write(def["left"]);
        const b = this.write(def["right"]);
        json["allOf"] = [...(simple(a) ? (a["allOf"] as JsonSchema[]) : [a]), ...(simple(b) ? (b["allOf"] as JsonSchema[]) : [b])];
        return undefined;
      }
      case "tuple": {
        const items = def["items"] as Schema[];
        json["type"] = "array";
        json["prefixItems"] = items.map((item) => this.write(item));
        if (!def["rest"]) json["items"] = false;
        else json["items"] = this.write(def["rest"]);
        let minItems = items.length;
        while (minItems > 0 && inputOptin(items[minItems - 1]!) !== undefined) minItems -= 1;
        if (minItems > 0) json["minItems"] = minItems;
        if (!def["rest"]) json["maxItems"] = items.length;
        const { minimum, maximum } = aggregate(schema);
        if (typeof minimum === "number") json["minItems"] = minimum;
        if (typeof maximum === "number") json["maxItems"] = maximum;
        return undefined;
      }
      case "record": {
        const keyType = def["keyType"] as Schema;
        json["type"] = "object";
        const patterns = aggregate(keyType).patterns;
        if (def["mode"] === "loose" && patterns && patterns.size > 0) {
          const value = this.write(def["valueType"]);
          const byPattern: JsonSchema = {};
          for (const pattern of patterns) byPattern[pattern.source] = value;
          json["patternProperties"] = byPattern;
        } else {
          json["propertyNames"] = stringKeys(this.write(keyType));
          json["additionalProperties"] = this.write(def["valueType"]);
        }
        const keys = keyType._zod.values;
        if (keys && !def["partial"] && inputOptin(def["valueType"]) === undefined) {
          const valid = [...keys].filter((key) => typeof key === "string" || typeof key === "number");
          if (valid.length > 0) json["required"] = valid.map(String);
        }
        return undefined;
      }
      case "nullable":
        json["anyOf"] = [this.write(def["innerType"]), { type: "null" }];
        return undefined;
      case "default":
      case "prefault": {
        const value = def["defaultValue"];
        let serialized: unknown;
        let unsayable = false;
        const text = JSON.stringify(value, (_key, one) => (typeof one === "bigint" ? ((unsayable = true), null) : one));
        if (!unsayable && text !== undefined) serialized = JSON.parse(text);
        if (!unsayable) json[def["type"] === "default" ? "default" : "_prefault"] = serialized;
        return def["innerType"];
      }
      case "catch": {
        try {
          json["default"] = def["catchValue"](undefined);
        } catch {
          // A catch that computes its value says nothing of it.
        }
        return def["innerType"];
      }
      case "readonly":
        json["readOnly"] = true;
        return def["innerType"];
      case "pipe":
        return def["in"]._zod.traits.has("$ZodTransform") ? def["out"] : def["in"];
      case "lazy":
        return schema._zod.innerType;
      case "optional":
      case "nonoptional":
      case "promise":
        return def["innerType"];
      default:
        // What JSON Schema cannot say — a date, a bigint, a transform, a custom check — accepts anything.
        return undefined;
    }
  }
}

/**
 * The JSON Schema of what a schema accepts as input, draft 2020-12, with
 * what JSON Schema cannot say left open — as zod's own writer does given
 * `{ io: "input", unrepresentable: "any", override }` — without zod's
 * writer on the page.
 */
export function writeJsonSchema(schema: unknown, override: Override = () => {}): JsonSchema {
  const root = schema as Schema;
  let writer = new Writer(override, new Map());
  let body = writer.write(root, true);
  if (writer.cyclic.size > 0) {
    // A schema that holds itself is written once and pointed at: the root as "#", any other under `$defs`.
    const refs = new Map<Schema, string>();
    let n = 0;
    const named: [Schema, string][] = [];
    for (const one of writer.cyclic.keys()) {
      if (one === root) refs.set(one, "#");
      else {
        const id = `__schema${n++}`;
        refs.set(one, `#/$defs/${id}`);
        named.push([one, id]);
      }
    }
    writer = new Writer(override, refs);
    body = writer.write(root, true);
    const defs: JsonSchema = {};
    for (const [one, id] of named) defs[id] = writer.write(one, true);
    if (named.length > 0) body = { ...body, $defs: defs };
  }
  return JSON.parse(JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...body })) as JsonSchema;
}
