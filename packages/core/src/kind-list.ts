import type { ArrangedGroup, ArrangeNode, Grouping, ListFields, Sort } from "./arrangement.js";
import type { KindList, KindListGroup } from "./views/types.js";

/**
 * A KIND'S LIST OPENS IN THE ORDER ITS DECLARATION SAYS (`pages.lists.<kind>`):
 * sorted by a field or a rank the kind works out, ties broken by another,
 * grouped by a choice in an order of its own, with what is finished with —
 * done, declined — drawn last and closed, each said with its count. Only a
 * blocks lens could sort and group before; a Roadmap's requests read done
 * among new.
 *
 * Pure and small: the checker and the document's edit judge a declaration
 * with it (`kindListFindings`), and a list page reads its opening
 * (`listOpening`) and orders its groups (`orderListGroups`) with it.
 */

/** A document's kind's fields, as `ListFields` says them: what the edit judges before anything is compiled. */
export function documentListFields(spec: { readonly fields?: Readonly<Record<string, { readonly type?: string; readonly options?: readonly string[] }>>; readonly computed?: Readonly<Record<string, unknown>> } | undefined): ListFields {
  const fields: Record<string, ListFields["fields"][string]> = {};
  for (const [name, field] of Object.entries(spec?.fields ?? {})) {
    fields[name] =
      field.type === "enum"
        ? { type: "choice", options: field.options ?? [] }
        : field.type === "boolean"
          ? { type: "boolean" }
          : ["list", "image", "video", "file", "app-link", "place"].includes(field.type ?? "")
            ? { type: "other" }
            : { type: "scalar" };
  }
  return { fields, computed: Object.keys(spec?.computed ?? {}) };
}

export interface ListFinding {
  readonly path: string;
  readonly message: string;
  readonly fix: string;
}

const MOST_TIEBREAKS = 3;

/** A declared sort, said either way, as an arrangement's sort with its tiebreaks. */
export function listSort(spec: KindList["sort"]): Sort | undefined {
  if (spec === undefined) return undefined;
  if (typeof spec === "string") return { by: spec, direction: "asc" };
  const then = spec.then === undefined ? undefined : typeof spec.then === "string" ? { by: spec.then, direction: "asc" as const } : { by: spec.then.by, direction: spec.then.direction ?? "asc" };
  return { by: spec.by, direction: spec.direction ?? "asc", ...(then ? { then } : {}) };
}

/** A declared grouping, said either way, in its whole form. */
export function listGroup(spec: KindList["group"]): KindListGroup | undefined {
  if (spec === undefined) return undefined;
  return typeof spec === "string" ? { by: spec } : spec;
}

/** How a kind's list opens when its address says nothing: its declared sort and grouping. */
export function listOpening(list: KindList | undefined): { readonly sort?: Sort; readonly group?: Grouping } | undefined {
  const sort = listSort(list?.sort);
  const group = listGroup(list?.group);
  if (!sort && !group) return undefined;
  return { ...(sort ? { sort } : {}), ...(group ? { group: { by: group.by } } : {}) };
}

/** A group's value as the declaration names it: a yes-or-no group's key ("1", "0") is `"true"` or `"false"`. */
const valueOf = (key: string, boolean: boolean): string => (boolean ? (key === "1" ? "true" : "false") : key);

/**
 * The groups in the declared order — the order it names, then the rest in
 * their declared order, the group with nothing to say after those — and
 * the closed ones last, each marked. A group the address asked for some
 * other way is left as `arrange` drew it.
 */
export function orderListGroups<N extends ArrangeNode>(
  groups: readonly ArrangedGroup<N>[],
  spec: KindListGroup,
  field: { readonly type: "choice" | "boolean"; readonly options?: readonly string[] },
): readonly (ArrangedGroup<N> & { readonly closed: boolean })[] {
  const boolean = field.type === "boolean";
  const options = boolean ? ["true", "false"] : (field.options ?? []);
  const order = [...new Set([...(spec.order ?? []).filter((value) => options.includes(value)), ...options])];
  const closed = spec.closed ?? [];
  // Open groups in their order; closed ones in the order the declaration closes them.
  const rank = (group: ArrangedGroup<N>): [number, number] => {
    if (group.key === "") return [1, 0];
    const value = valueOf(group.key, boolean);
    if (closed.includes(value)) return [2, closed.indexOf(value)];
    const at = order.indexOf(value);
    return [0, at < 0 ? order.length : at];
  };
  return groups
    .map((group, at) => ({ group, at, rank: rank(group) }))
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.at - b.at)
    .map(({ group, rank }) => ({ ...group, closed: rank[0] === 2 }));
}

/** A direction, in the words a key's values read in: "highest first", "A to Z". */
function directionSaid(type: "choice" | "boolean" | "number" | "date" | "text", direction: "asc" | "desc"): string {
  const words = {
    date: ["earliest first", "latest first"],
    number: ["lowest first", "highest first"],
    boolean: ["no first", "yes first"],
    choice: ["in their order", "in reverse order"],
    text: ["A to Z", "Z to A"],
  }[type];
  return words[direction === "desc" ? 1 : 0]!;
}

/** What a document's field type reads as, for the words a sort is said in. */
export function sortTypeOfDocumentField(type: string | undefined): "choice" | "boolean" | "number" | "date" | "text" {
  if (type === "enum") return "choice";
  if (type === "boolean") return "boolean";
  if (type === "number" || type === "integer" || type === "duration") return "number";
  if (type === "date" || type === "datetime") return "date";
  return "text";
}

/**
 * A kind's declared order and grouping, said: `sorted by "votes", highest
 * first, then "label", A to Z` and `grouped by "status", done and declined
 * closed at the end`. `typeOf` says what a key's values are (a computed
 * field is a number).
 */
export function kindListWords(list: KindList, typeOf: (key: string) => "choice" | "boolean" | "number" | "date" | "text"): { readonly sort?: string; readonly group?: string } {
  const out: { sort?: string; group?: string } = {};
  const sort = listSort(list.sort);
  if (sort) {
    const parts: string[] = [];
    for (let at: Sort | undefined = sort, depth = 0; at && depth <= MOST_TIEBREAKS; at = at.then, depth += 1) {
      parts.push(`${depth === 0 ? "sorted by" : "then"} "${at.by}", ${directionSaid(at.by === "label" ? "text" : typeOf(at.by), at.direction)}`);
    }
    out.sort = parts.join(", ");
  }
  const group = listGroup(list.group);
  if (group) {
    const quoted = (values: readonly string[]) => values.map((value) => `"${value}"`);
    const join = (values: readonly string[]) => (values.length <= 1 ? values.join("") : `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`);
    const order = group.order?.length ? `, ${join(quoted(group.order))} first` : "";
    const closed = group.closed?.length ? `, ${join(quoted(group.closed))} closed at the end` : "";
    out.group = `grouped by "${group.by}"${order}${closed}`;
  }
  return out;
}

/**
 * What is wrong with a kind's declared order and grouping, each said in a
 * sentence: a sort by what the kind does not have, a grouping by a field
 * that is not a choice or a yes or no, a group's order or a closed group
 * naming a value the field does not offer.
 */
export function kindListFindings(kind: string, list: KindList, shape: ListFields, at = `pages.lists.${kind}`): ListFinding[] {
  const out: ListFinding[] = [];
  const sortable = ["label", ...Object.entries(shape.fields).filter(([, field]) => field.type !== "other").map(([name]) => name), ...shape.computed];
  if (list.sort !== undefined) {
    const sort = listSort(list.sort)!;
    const keys: [string, string][] = [[sort.by, `${at}.sort${typeof list.sort === "string" ? "" : ".by"}`]];
    for (let then = sort.then, depth = 0; then && depth < MOST_TIEBREAKS; then = then.then, depth += 1) keys.push([then.by, `${at}.sort.then`]);
    for (const [by, path] of keys) {
      if (sortable.includes(by)) continue;
      const field = shape.fields[by];
      out.push({
        path,
        message: field
          ? `The ${kind} list cannot be sorted by "${by}": it is a field no list sorts by (a list, a file, a picture).`
          : `The ${kind} list cannot be sorted by "${by}": ${kind} has no field or computed field called that.`,
        fix: `Sort by ${sortable.map((key) => `"${key}"`).join(", ")}.`,
      });
    }
  }
  if (list.group !== undefined) {
    const group = listGroup(list.group)!;
    const groupAt = `${at}.group${typeof list.group === "string" ? "" : ".by"}`;
    const field = shape.fields[group.by];
    const groupable = Object.entries(shape.fields).filter(([, one]) => one.type === "choice" || one.type === "boolean").map(([name]) => `"${name}"`);
    const fix = groupable.length > 0 ? `Group by ${groupable.join(", ")}.` : `${kind} has no choice or yes-or-no field to group by; add one, or leave the list ungrouped.`;
    if (!field) {
      out.push({ path: groupAt, message: `The ${kind} list cannot be grouped by "${group.by}": ${kind} has no field called that${shape.computed.includes(group.by) ? " it stores (a computed field is not grouped by)" : ""}.`, fix });
    } else if (field.type !== "choice" && field.type !== "boolean") {
      out.push({ path: groupAt, message: `The ${kind} list cannot be grouped by "${group.by}": a list groups by a choice or a yes-or-no field, and ${group.by} is neither.`, fix });
    } else {
      const options = field.type === "boolean" ? ["true", "false"] : (field.options ?? []);
      const said = options.map((option) => `"${option}"`).join(", ");
      for (const part of ["order", "closed"] as const) {
        (group[part] ?? []).forEach((value, n) => {
          if (options.includes(value)) return;
          out.push({
            path: `${at}.group.${part}.${n}`,
            message:
              part === "closed"
                ? `The ${kind} list cannot close the "${value}" group: "${value}" is not one of ${group.by}'s choices.`
                : `The ${kind} list cannot put the "${value}" group in order: "${value}" is not one of ${group.by}'s choices.`,
            fix: `Name ${said}.`,
          });
        });
      }
    }
  }
  return out;
}
