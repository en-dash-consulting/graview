import type { DeclarationChange } from "@graview/core";
import type * as TS from "typescript";

/**
 * A DECLARATION CHANGE, MADE AS AN EDIT TO THE SOURCE.
 *
 * The studio can write a whole declaration from its graph, and for a new
 * app that is right. For an app somebody has been writing for months it is
 * a disaster with a green tick on it: the graph holds the shape, not the
 * comments that say why, not the `describe` and `format` functions, not a
 * single hand-written body — so a regenerated `schema.ts` is a smaller,
 * poorer file that happens to type-check.
 *
 * So a change is carried as a change — "move `tended-by` from plot to
 * planting" — and made here, inside the checkout's own `defineNode` calls,
 * by the parser's positions: the property removed with the comment above
 * it, carried to the other kind at that kind's indentation, and every other
 * character left exactly where it was.
 *
 * All or nothing. A change the source cannot take — a kind it cannot find,
 * fields written some way other than `z.object({ … })` — refuses the whole
 * set, and says which and why, rather than writing half a declaration.
 */

export interface SourceText {
  readonly path: string;
  readonly text: string;
}

export type SourceEdit =
  | { readonly ok: true; readonly files: readonly SourceText[] }
  | { readonly ok: false; readonly refused: readonly string[] };

type Ts = typeof TS;

export function editDeclaration(ts: Ts, files: readonly SourceText[], changes: readonly DeclarationChange[]): SourceEdit {
  const current = new Map(files.map((file) => [file.path, file.text]));
  const refused: string[] = [];
  for (const change of changes) {
    const outcome = applyChange(ts, current, change);
    if (typeof outcome === "string") refused.push(outcome);
  }
  if (refused.length > 0) return { ok: false, refused };
  return { ok: true, files: files.map((file) => ({ path: file.path, text: current.get(file.path)! })) };
}

/* ------------------------------------------------------------ finding */

interface Found {
  readonly path: string;
  readonly source: TS.SourceFile;
  readonly object: TS.ObjectLiteralExpression;
  /** The statement that binds it, when it is one: what removing the kind removes. */
  readonly statement?: TS.Statement;
  readonly binding?: string;
}

const parse = (ts: Ts, path: string, text: string) => ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const calleeIs = (ts: Ts, call: TS.CallExpression, name: string): boolean =>
  (ts.isIdentifier(call.expression) && call.expression.text === name) ||
  (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === name);

function visit(ts: Ts, node: TS.Node, found: (node: TS.Node) => boolean): TS.Node | undefined {
  if (found(node)) return node;
  return ts.forEachChild(node, (child) => visit(ts, child, found));
}

/** The declarations of each sort, by the function that declares them. */
const DECLARERS = {
  kind: ["defineNode"],
  act: ["defineMutation"],
  // A rule judged in words is a rule too (FR-07): `expressionRule("name", { … }, shapes)`.
  rule: ["defineInvariant", "defineGraphInvariant", "expressionRule"],
} as const;
type Sort = keyof typeof DECLARERS;

const declares = (ts: Ts, node: TS.Node, sort: Sort): node is TS.CallExpression =>
  ts.isCallExpression(node) && DECLARERS[sort].some((name) => calleeIs(ts, node, name));

/** `defineNode("plot", { … })` and its kin: the name, when it is a string literal, and the object. */
function declared(ts: Ts, call: TS.CallExpression): { readonly name: string; readonly object: TS.ObjectLiteralExpression } | undefined {
  const [name, body] = call.arguments;
  return name && ts.isStringLiteralLike(name) && body && ts.isObjectLiteralExpression(body) ? { name: name.text, object: body } : undefined;
}

function defineNodeOf(ts: Ts, files: ReadonlyMap<string, string>, kind: string): Found | undefined {
  return declarationOf(ts, files, "kind", kind);
}

/**
 * The declaration of this name. A name may be declared more than once — a
 * tutorial's chapter keeps its own smaller `plot` beside the app's — and
 * the one EXPORTED is the app's; the others are somebody's local copies.
 */
function declarationOf(ts: Ts, files: ReadonlyMap<string, string>, sort: Sort, wanted: string): Found | undefined {
  const found: Found[] = [];
  for (const [path, text] of files) {
    const source = parse(ts, path, text);
    const visitAll = (node: TS.Node): void => {
      if (declares(ts, node, sort) && declared(ts, node)?.name === wanted) found.push(foundAt(ts, path, source, node));
      ts.forEachChild(node, visitAll);
    };
    visitAll(source);
  }
  const exported = (one: Found) => !!one.statement && ts.canHaveModifiers(one.statement) && (ts.getModifiers(one.statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  return found.find(exported) ?? found[0];
}

function foundAt(ts: Ts, path: string, source: TS.SourceFile, call: TS.CallExpression): Found {
  let statement: TS.Node = call;
  while (statement.parent && !ts.isSourceFile(statement.parent)) statement = statement.parent;
  const variable = ts.isVariableStatement(statement) ? statement.declarationList.declarations[0] : undefined;
  return {
    path,
    source,
    object: declared(ts, call)!.object,
    ...(ts.isVariableStatement(statement) ? { statement } : {}),
    ...(variable && ts.isIdentifier(variable.name) ? { binding: variable.name.text } : {}),
  };
}

const propertyName = (ts: Ts, property: TS.ObjectLiteralElementLike): string | undefined =>
  property.name && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) ? property.name.text : undefined;

function property(ts: Ts, object: TS.ObjectLiteralExpression, name: string): TS.PropertyAssignment | undefined {
  return object.properties.find((one): one is TS.PropertyAssignment => ts.isPropertyAssignment(one) && propertyName(ts, one) === name);
}

/** The object inside `fields: z.object({ … })`, or why there is none to edit. */
function fieldsOf(ts: Ts, found: Found, kind: string): TS.ObjectLiteralExpression | string {
  const fields = property(ts, found.object, "fields")?.initializer;
  if (fields && ts.isCallExpression(fields) && calleeIs(ts, fields, "object")) {
    const shape = fields.arguments[0];
    if (shape && ts.isObjectLiteralExpression(shape)) return shape;
  }
  return `The fields of "${kind}" are not written as z.object({ … }) in ${found.path}, so the studio cannot edit them in place.`;
}

/**
 * The checkout's own acts and rules, each as the object it is declared
 * with: what a person or a seat rewrites when a change leaves one of them
 * saying something that is no longer true.
 */
export function declaredCode(
  ts: Ts,
  files: readonly SourceText[],
): { readonly acts: Record<string, { path: string; text: string }>; readonly rules: Record<string, { path: string; text: string }> } {
  const acts: Record<string, { path: string; text: string }> = {};
  const rules: Record<string, { path: string; text: string }> = {};
  for (const file of files) {
    const source = parse(ts, file.path, file.text);
    const walk = (node: TS.Node): void => {
      for (const [sort, into] of [["act", acts], ["rule", rules]] as const) {
        const found = declares(ts, node, sort) ? declared(ts, node) : undefined;
        if (found) into[found.name] = { path: file.path, text: file.text.slice(found.object.getStart(source), found.object.end) };
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
  }
  return { acts, rules };
}

/* ------------------------------------------------------------ editing */

/** The whitespace a line starts with. */
const indentAt = (text: string, position: number): string => {
  const start = text.lastIndexOf("\n", position - 1) + 1;
  return /^[ \t]*/.exec(text.slice(start))![0];
};

/** One level deeper than `indent`, in the file's own step. */
const deeper = (text: string, indent: string): string => indent + (/\n\t/.test(text) && !/\n {2}/.test(text) ? "\t" : "  ");

const key = (name: string): string => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name));

/** Re-indent a block of source from one indentation to another. */
const reindent = (block: string, from: string, to: string): string =>
  block
    .split("\n")
    .map((line) => (line.startsWith(from) ? to + line.slice(from.length) : line))
    .join("\n");

function insertProperty(text: string, object: TS.ObjectLiteralExpression, source: TS.SourceFile, entry: string): string {
  const last = object.properties[object.properties.length - 1];
  // An object written on one line stays on one line, when what joins it fits on one.
  if (!text.slice(object.getStart(source), object.end).includes("\n") && !entry.includes("\n")) {
    return last
      ? `${text.slice(0, last.end)}, ${entry}${text.slice(last.end)}`
      : `${text.slice(0, object.getStart(source))}{ ${entry} }${text.slice(object.end)}`;
  }
  if (!last) {
    const outer = indentAt(text, object.getStart(source));
    const inner = deeper(text, outer);
    return `${text.slice(0, object.getStart(source))}{\n${inner}${reindent(entry, "", inner).trimStart()},\n${outer}}${text.slice(object.end)}`;
  }
  const indent = indentAt(text, last.getStart(source));
  const body = reindent(entry, "", indent).trimStart();
  if (object.properties.hasTrailingComma) {
    const comma = text.indexOf(",", last.end);
    return `${text.slice(0, comma + 1)}\n${indent}${body},${text.slice(comma + 1)}`;
  }
  return `${text.slice(0, last.end)},\n${indent}${body}${text.slice(last.end)}`;
}

/**
 * The property's span: from the end of whatever came before it — so the
 * comment above it goes with it — to the comma after it.
 */
function spanOf(text: string, element: TS.Node): { readonly start: number; readonly end: number } {
  const comma = /^[ \t]*,/.exec(text.slice(element.end));
  return { start: element.getFullStart(), end: element.end + (comma ? comma[0].length : 0) };
}

const cut = (text: string, span: { start: number; end: number }): string => text.slice(0, span.start) + text.slice(span.end);

function replaceNode(text: string, node: TS.Node, source: TS.SourceFile, replacement: string): string {
  return text.slice(0, node.getStart(source)) + replacement + text.slice(node.end);
}

/* ------------------------------------------------------------ changes */

function applyChange(ts: Ts, files: Map<string, string>, change: DeclarationChange): string | undefined {
  if (change.what === "add-kind") return addKind(ts, files, change);
  if (change.what === "add-migration") return addMigration(ts, files, change);
  if (change.what === "replace-act" || change.what === "replace-rule") {
    const sort = change.what === "replace-act" ? "act" : "rule";
    const name = change.what === "replace-act" ? change.act : change.rule;
    const found = declarationOf(ts, files, sort, name);
    if (!found) return `No ${sort} "${name}" declared in ${[...files.keys()].join(", ")}.`;
    const text = files.get(found.path)!;
    files.set(found.path, replaceNode(text, found.object, found.source, reindent(change.text.trim(), "", indentAt(text, found.object.getStart(found.source))).trimStart()));
    return undefined;
  }
  if (change.what === "add-act" || change.what === "add-rule") {
    const sort = change.what === "add-act" ? "act" : "rule";
    const name = change.what === "add-act" ? change.act : change.rule;
    return addDeclaration(ts, files, sort, name, change.binding, change.text);
  }
  if (change.what === "remove-act" || change.what === "remove-rule") {
    const sort = change.what === "remove-act" ? "act" : "rule";
    const name = change.what === "remove-act" ? change.act : change.rule;
    const found = declarationOf(ts, files, sort, name);
    if (!found?.statement) return `No ${sort} "${name}" declared as a statement of its own.`;
    let next = cut(files.get(found.path)!, spanOf(files.get(found.path)!, found.statement));
    files.set(found.path, next);
    // And out of whatever list gathers them, wherever that is.
    if (found.binding) {
      for (const [path, text] of files) {
        next = removeFromList(ts, path, text, found.binding) ?? text;
        files.set(path, next);
      }
    }
    return undefined;
  }
  const kind = change.what === "move-edge" ? change.from : change.kind;
  const found = defineNodeOf(ts, files, kind);
  if (!found) return `No defineNode("${kind}", { … }) in ${[...files.keys()].join(", ")}.`;
  const text = files.get(found.path)!;

  switch (change.what) {
    case "remove-kind": {
      if (!found.statement) return `defineNode("${kind}") in ${found.path} is not a statement of its own, so the studio cannot remove it.`;
      let next = cut(text, spanOf(text, found.statement));
      if (found.binding) next = removeFromSchema(ts, found.path, next, found.binding) ?? next;
      files.set(found.path, next);
      return undefined;
    }
    case "set-kind-property": {
      const existing = property(ts, found.object, change.property);
      if (change.text === null) {
        if (existing) files.set(found.path, cut(text, spanOf(text, existing)));
      } else if (existing) {
        files.set(found.path, replaceNode(text, existing.initializer, found.source, change.text));
      } else {
        files.set(found.path, insertProperty(text, found.object, found.source, `${key(change.property)}: ${change.text}`));
      }
      return undefined;
    }
    case "add-field":
    case "change-field":
    case "remove-field": {
      const shape = fieldsOf(ts, found, kind);
      if (typeof shape === "string") return shape;
      const existing = property(ts, shape, change.field);
      if (change.what === "add-field") {
        if (existing) return `"${kind}" already has a field "${change.field}" in ${found.path}.`;
        files.set(found.path, insertProperty(text, shape, found.source, `${key(change.field)}: ${change.zod}`));
      } else if (!existing) {
        return `"${kind}" has no field "${change.field}" in ${found.path}.`;
      } else if (change.what === "change-field") {
        files.set(found.path, replaceNode(text, existing.initializer, found.source, change.zod));
      } else {
        files.set(found.path, cut(text, spanOf(text, existing)));
      }
      return undefined;
    }
    case "add-edge":
    case "change-edge":
    case "remove-edge": {
      const edges = property(ts, found.object, "edges");
      const object = edges && ts.isObjectLiteralExpression(edges.initializer) ? edges.initializer : undefined;
      const existing = object ? property(ts, object, change.edge) : undefined;
      if (change.what === "add-edge") {
        if (existing) return `"${kind}" already declares "${change.edge}" in ${found.path}.`;
        const entry = `${key(change.edge)}: ${change.text}`;
        files.set(
          found.path,
          object ? insertProperty(text, object, found.source, entry) : insertProperty(text, found.object, found.source, `edges: {\n  ${entry.split("\n").join("\n  ")},\n}`),
        );
      } else if (!existing) {
        return `"${kind}" declares no edge "${change.edge}" in ${found.path}.`;
      } else if (change.what === "change-edge") {
        files.set(found.path, replaceNode(text, existing.initializer, found.source, reindent(change.text, "", indentAt(text, existing.getStart(found.source)))));
      } else {
        files.set(found.path, cut(text, spanOf(text, existing)));
      }
      return undefined;
    }
    case "move-edge":
      return moveEdge(ts, files, found, change);
  }
}

/**
 * THE SAME RELATION, ON ANOTHER KIND: carried as it was written. Its
 * readings, its `appendOnly`, the comment that says why it exists all go
 * with it; only where it points is rewritten.
 */
function moveEdge(ts: Ts, files: Map<string, string>, found: Found, change: Extract<DeclarationChange, { what: "move-edge" }>): string | undefined {
  const text = files.get(found.path)!;
  const edges = property(ts, found.object, "edges");
  const object = edges && ts.isObjectLiteralExpression(edges.initializer) ? edges.initializer : undefined;
  const existing = object ? property(ts, object, change.edge) : undefined;
  if (!existing || !ts.isObjectLiteralExpression(existing.initializer)) return `"${change.from}" declares no edge "${change.edge}" in ${found.path}.`;
  if (!defineNodeOf(ts, files, change.to)) return `No defineNode("${change.to}", { … }) to move "${change.edge}" onto.`;

  // The property's own text, with its targets rewritten, and its comments above it.
  const span = spanOf(text, existing);
  const target = property(ts, existing.initializer, "to");
  let carried = text.slice(span.start, existing.end);
  if (target) {
    const at = target.initializer.getStart(found.source) - span.start;
    carried = carried.slice(0, at) + change.targets + carried.slice(target.initializer.end - span.start);
  }
  const from = indentAt(text, existing.getStart(found.source));
  const block = carried.replace(/^\n/, "");
  const withoutIndent = reindent(block, from, "");

  // Removed from where it was — and an `edges: {}` left empty goes too.
  let next = cut(text, span);
  const after = defineNodeOf(ts, new Map([[found.path, next]]), change.from)!;
  const left = property(ts, after.object, "edges");
  if (left && ts.isObjectLiteralExpression(left.initializer) && left.initializer.properties.length === 0) {
    next = cut(next, spanOf(next, left));
  }
  files.set(found.path, next);

  const destination = defineNodeOf(ts, files, change.to)!;
  const there = files.get(destination.path)!;
  const edgesThere = property(ts, destination.object, "edges");
  files.set(
    destination.path,
    edgesThere && ts.isObjectLiteralExpression(edgesThere.initializer)
      ? insertProperty(there, edgesThere.initializer, destination.source, withoutIndent)
      : insertProperty(there, destination.object, destination.source, `edges: {\n  ${withoutIndent.split("\n").join("\n  ")},\n}`),
  );
  return undefined;
}

/** The `createSchema([...])` array, wherever the kinds are gathered. */
function schemaList(ts: Ts, path: string, text: string): { source: TS.SourceFile; list: TS.ArrayLiteralExpression } | undefined {
  const source = parse(ts, path, text);
  const call = visit(ts, source, (node) => ts.isCallExpression(node) && calleeIs(ts, node, "createSchema")) as TS.CallExpression | undefined;
  const list = call?.arguments[0];
  return list && ts.isArrayLiteralExpression(list) ? { source, list } : undefined;
}

function removeFromSchema(ts: Ts, path: string, text: string, binding: string): string | undefined {
  const found = schemaList(ts, path, text);
  return found ? removeElement(ts, text, found.source, found.list, binding) : undefined;
}

/** The binding taken out of every array literal in the file that lists it by name. */
function removeFromList(ts: Ts, path: string, text: string, binding: string): string | undefined {
  const source = parse(ts, path, text);
  const list = visit(
    ts,
    source,
    (node) => ts.isArrayLiteralExpression(node) && node.elements.some((one) => ts.isIdentifier(one) && one.text === binding),
  ) as TS.ArrayLiteralExpression | undefined;
  return list ? removeElement(ts, text, source, list, binding) : undefined;
}

function removeElement(ts: Ts, text: string, source: TS.SourceFile, list: TS.ArrayLiteralExpression, binding: string): string | undefined {
  const element = list.elements.find((one) => ts.isIdentifier(one) && one.text === binding);
  if (!element) return undefined;
  const found = { source, list };
  const elements = found.list.elements;
  const at = elements.indexOf(element);
  // With the comma on whichever side it sits.
  const start = at > 0 ? elements[at - 1]!.end : element.getStart(found.source);
  const end = at > 0 ? element.end : (elements[at + 1]?.getStart(found.source) ?? element.end);
  return text.slice(0, start) + text.slice(end);
}

function addKind(ts: Ts, files: Map<string, string>, change: Extract<DeclarationChange, { what: "add-kind" }>): string | undefined {
  if (defineNodeOf(ts, files, change.kind)) return `"${change.kind}" is already declared.`;
  for (const [path, text] of files) {
    const found = schemaList(ts, path, text);
    if (!found) continue;
    let statement: TS.Node = found.list;
    while (statement.parent && !ts.isSourceFile(statement.parent)) statement = statement.parent;
    // Into the list — ahead of any spread, so the app's own kinds stay together.
    const spread = found.list.elements.find((one) => ts.isSpreadElement(one));
    const last = found.list.elements[found.list.elements.length - 1];
    let next = spread
      ? `${text.slice(0, spread.getStart(found.source))}${change.binding}, ${text.slice(spread.getStart(found.source))}`
      : last
        ? `${text.slice(0, last.end)}, ${change.binding}${text.slice(last.end)}`
        : `${text.slice(0, found.list.getStart(found.source) + 1)}${change.binding}${text.slice(found.list.getStart(found.source) + 1)}`;
    // And declared just above where the schema gathers them.
    const before = statement.getStart(found.source);
    next = `${next.slice(0, before)}${change.text.trim()}\n\n${next.slice(before)}`;
    files.set(path, next);
    return undefined;
  }
  return `No createSchema([ … ]) to add "${change.kind}" to.`;
}

/**
 * A new act or rule: declared after the last of its sort, and added to the
 * list that gathers the others — the array literal that already names them.
 */
function addDeclaration(ts: Ts, files: Map<string, string>, sort: "act" | "rule", name: string, binding: string, statement: string): string | undefined {
  if (declarationOf(ts, files, sort, name)) return `The ${sort} "${name}" is already declared.`;
  for (const [path, text] of files) {
    const source = parse(ts, path, text);
    const bindings = new Set<string>();
    let last: TS.Statement | undefined;
    for (const top of source.statements) {
      const call = visit(ts, top, (node) => declares(ts, node, sort));
      if (!call) continue;
      last = top;
      const bound = ts.isVariableStatement(top) ? top.declarationList.declarations[0]?.name : undefined;
      if (bound && ts.isIdentifier(bound)) bindings.add(bound.text);
    }
    if (!last) continue;
    const list = visit(
      ts,
      source,
      (node) => ts.isArrayLiteralExpression(node) && node.elements.some((one) => ts.isIdentifier(one) && bindings.has(one.text)),
    ) as TS.ArrayLiteralExpression | undefined;
    if (!list) return `The ${sort}s in ${path} are not gathered in a list the studio can add "${binding}" to.`;
    // The list first, since it comes after the declarations: an edit to it moves nothing above it.
    const tail = list.elements[list.elements.length - 1]!;
    const multiline = text.slice(list.getStart(source), list.end).includes("\n");
    let next = multiline
      ? `${text.slice(0, tail.end)},\n${indentAt(text, tail.getStart(source))}${binding}${text.slice(tail.end)}`
      : `${text.slice(0, tail.end)}, ${binding}${text.slice(tail.end)}`;
    next = `${next.slice(0, last.end)}\n\n${statement.trim()}${next.slice(last.end)}`;
    // A rule judged in words brings what judges it.
    if (/\bexpressionRule\(/.test(statement)) {
      next = withImport(ts, path, next, "expressionRule", "@graview/core/document");
    }
    files.set(path, next);
    return undefined;
  }
  return `No file declares ${sort}s to add "${name}" beside.`;
}

/**
 * THE APP CARRIES ITS STORED GRAPHS FORWARD: its `version` moves on and the
 * migration to it joins `migrations`, in the `defineApp({ … })` the app is
 * declared with — so the graph somebody already has opens on the new
 * declaration by running it, logged and undoable like any other change.
 */
function addMigration(ts: Ts, files: Map<string, string>, change: Extract<DeclarationChange, { what: "add-migration" }>): string | undefined {
  for (const [path, text] of files) {
    const source = parse(ts, path, text);
    const call = visit(ts, source, (node) => ts.isCallExpression(node) && calleeIs(ts, node, "defineApp")) as TS.CallExpression | undefined;
    const app = call?.arguments[0];
    if (!app || !ts.isObjectLiteralExpression(app)) continue;

    // The list first, then the version, then the import: each edit is later in the file than the next one's position, or re-read.
    let next = text;
    const migrations = property(ts, app, "migrations");
    if (migrations) {
      if (!ts.isArrayLiteralExpression(migrations.initializer)) return `The migrations in ${path} are not written as a list the studio can add to.`;
      const list = migrations.initializer;
      const tail = list.elements[list.elements.length - 1];
      next = tail
        ? `${next.slice(0, tail.end)},\n${indentAt(next, tail.getStart(source))}${change.text}${next.slice(tail.end)}`
        : `${next.slice(0, list.getStart(source))}[${change.text}]${next.slice(list.end)}`;
    }
    let reread = parse(ts, path, next);
    let object = (visit(ts, reread, (node) => ts.isCallExpression(node) && calleeIs(ts, node, "defineApp")) as TS.CallExpression).arguments[0] as TS.ObjectLiteralExpression;
    if (!migrations) next = insertProperty(next, object, reread, `migrations: [${change.text}]`);

    reread = parse(ts, path, next);
    object = (visit(ts, reread, (node) => ts.isCallExpression(node) && calleeIs(ts, node, "defineApp")) as TS.CallExpression).arguments[0] as TS.ObjectLiteralExpression;
    const version = property(ts, object, "version");
    next = version ? replaceNode(next, version.initializer, reread, String(change.version)) : insertProperty(next, object, reread, `version: ${change.version}`);

    files.set(path, withImport(ts, path, next, change.import.name, change.import.from));
    return undefined;
  }
  return "No defineApp({ … }) in the declaration to add a migration to.";
}

/** `name` imported from `from`: added to an import of that module the file already has, or as a line of its own. */
function withImport(ts: Ts, path: string, text: string, name: string, from: string): string {
  const source = parse(ts, path, text);
  const imports = source.statements.filter(ts.isImportDeclaration);
  const existing = imports.find(
    (one) => ts.isStringLiteral(one.moduleSpecifier) && one.moduleSpecifier.text === from && !one.importClause?.isTypeOnly,
  );
  const named = existing?.importClause?.namedBindings;
  if (named && ts.isNamedImports(named)) {
    if (named.elements.some((element) => element.name.text === name)) return text;
    const last = named.elements[named.elements.length - 1]!;
    return `${text.slice(0, last.end)}, ${name}${text.slice(last.end)}`;
  }
  const after = imports[imports.length - 1];
  const line = `import { ${name} } from ${JSON.stringify(from)};`;
  return after ? `${text.slice(0, after.end)}\n${line}${text.slice(after.end)}` : `${line}\n${text}`;
}
