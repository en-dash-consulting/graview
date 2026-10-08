import { error, type Finding } from "./findings.js";
import type { KindSpec } from "./schema.js";

/*
 * A KIND'S PAGE (FR-148): how a record's page orders and groups its facts,
 * `kinds.<kind>.page` — `{ fields?: [...], groups?: [{ title, fields }] }`.
 * The compile and `set-page-fields` judge it by the same words: every name
 * a field or computed field of the kind, each named once, each group's
 * title said once.
 */

/** What is wrong with a kind's page, in the document's words; `at` is where its page is. */
export function pageFieldFindings(kind: string, spec: Pick<KindSpec, "fields" | "computed" | "page">, at = `kinds.${kind}.page`): Finding[] {
  const page = spec.page;
  if (!page) return [];
  const findings: Finding[] = [];
  const known = [...Object.keys(spec.fields), ...Object.keys(spec.computed ?? {})];
  const seen = new Set<string>();
  const judge = (field: string, path: string) => {
    if (!known.includes(field)) findings.push(error("page-field", path, `${kind}'s page is to show "${field}", and ${kind} has no field or computed field called that`, `use one of: ${known.join(", ")}`));
    else if (seen.has(field)) findings.push(error("page-field-twice", path, `"${field}" is on ${kind}'s page twice; name each field once`));
    seen.add(field);
  };
  (page.fields ?? []).forEach((field, n) => judge(field, `${at}.fields.${n}`));
  const titles = new Set<string>();
  (page.groups ?? []).forEach((group, g) => {
    const title = group.title.trim().toLowerCase();
    if (titles.has(title)) findings.push(error("page-group-twice", `${at}.groups.${g}.title`, `${kind}'s page has two groups called "${group.title}"; give each its own title`));
    titles.add(title);
    group.fields.forEach((field, n) => judge(field, `${at}.groups.${g}.fields.${n}`));
  });
  return findings;
}

/** A kind's page after a field is renamed: the new name wherever the old one stood. */
export function renamedOnPage(page: KindSpec["page"], from: string, to: string): KindSpec["page"] {
  if (!page) return page;
  const swap = (fields: readonly string[]) => fields.map((field) => (field === from ? to : field));
  return {
    ...(page.fields ? { fields: swap(page.fields) as [string, ...string[]] } : {}),
    ...(page.groups ? { groups: page.groups.map((group) => ({ ...group, fields: swap(group.fields) })) as never } : {}),
  };
}

/** A kind's page after a field is removed: without it, a group left with nothing dropped, and no page at all when nothing is left. */
export function withoutOnPage(page: KindSpec["page"], field: string): KindSpec["page"] | undefined {
  if (!page) return page;
  const fields = (page.fields ?? []).filter((one) => one !== field);
  const groups = (page.groups ?? []).map((group) => ({ ...group, fields: group.fields.filter((one) => one !== field) })).filter((group) => group.fields.length > 0);
  if (fields.length === 0 && groups.length === 0) return undefined;
  return { ...(fields.length > 0 ? { fields } : {}), ...(groups.length > 0 ? { groups } : {}) } as KindSpec["page"];
}

/** Whether a kind's page names a field. */
export function pageNames(page: KindSpec["page"], field: string): boolean {
  return Boolean(page && ((page.fields ?? []).includes(field) || (page.groups ?? []).some((group) => group.fields.includes(field))));
}
