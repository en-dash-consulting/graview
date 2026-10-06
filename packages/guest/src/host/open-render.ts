import { HTML_NAMESPACE, OPEN_MAX_TEXT, SVG_NAMESPACE } from "../open-kit.js";
import { isEmptyElement, judgeAttribute, judgeElement, type JudgeContext, type OpenNamespace, type OpenRefusal } from "./open-judge.js";

/*
 * A WORKER VIEW'S DRAWING, DRAWN (FR-90): Remote DOM mutation records from
 * the view's worker, judged one element and one attribute at a time against
 * the open kit (open-judge.ts) and drawn into a parent the host owns — a
 * shadow root, in a page. A node refused holds its place as an empty
 * comment, so the view's indices stay true, and nothing under it is drawn.
 *
 * It uses a handful of DOM calls (createElementNS, createTextNode,
 * createComment, setAttribute, removeAttribute, insertBefore, removeChild),
 * so a host without a DOM can hand it a document of its own that has them.
 */

const INSERT_CHILD = 0;
const REMOVE_CHILD = 1;
const UPDATE_TEXT = 2;
const UPDATE_PROPERTY = 3;
const PROPERTY = 1;
const ATTRIBUTE = 2;
const EVENT_LISTENER = 3;
const ELEMENT = 1;
const TEXT = 3;
const COMMENT = 8;
const ROOT_ID = "~";

export interface OpenRendererOptions extends JudgeContext {
  /** The most nodes a view may have drawn at once. 5 000 by default. */
  readonly maxNodes?: number;
  /** The view went past `maxNodes`. Called once. */
  readonly onOverBudget?: () => void;
  /** An element was made, with its first attributes: the host's chance to set what is its own on it (a button's type, a link's role). */
  readonly decorate?: (element: Element, name: string, namespace: OpenNamespace) => void;
  /** An attribute the view gave was drawn, or taken away. */
  readonly onAttribute?: (element: Element, name: string) => void;
  /** The view set what a field holds (its `value`, `checked`, `selected`, or a textarea's text): it is no longer what the person typed. */
  readonly onFieldSet?: (field: Element) => void;
}

export interface OpenRenderer {
  /**
   * Draw one batch. `spent`, asked between records, says the host's time
   * for drawing this view has run out: the rest of the batch is not drawn,
   * and `apply` says false.
   */
  apply(records: unknown, spent?: () => boolean): boolean;
  /** What was refused, oldest first (the last 200). */
  readonly refused: readonly OpenRefusal[];
  /** How many nodes are drawn. */
  readonly size: number;
  /** The view's id for a node the host drew, for an event to name. */
  idOf(node: Node): string | undefined;
  /** The element the host drew for a view's id. */
  elementOf(id: string): Element | undefined;
  dispose(): void;
}

interface Drawn {
  readonly dom: Node;
  readonly name?: string;
  readonly namespace?: OpenNamespace;
  readonly children: Drawn[];
  readonly refused?: true;
  readonly text?: true;
  readonly id?: string;
  /** What it was drawn in. */
  readonly parent?: Drawn;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const FIELDS = new Set(["input", "select", "textarea", "option"]);
const FIELD_ATTRIBUTES = new Set(["value", "checked", "selected"]);

export function createOpenRenderer(into: Node, options: OpenRendererOptions): OpenRenderer {
  const document = (into.ownerDocument ?? into) as Document;
  const maxNodes = options.maxNodes ?? 5_000;
  const refused: OpenRefusal[] = [];
  const byId = new Map<string, Drawn>();
  const ids = new WeakMap<Node, string>();
  const root: Drawn = { dom: into, name: "div", namespace: "html", children: [], id: ROOT_ID };
  byId.set(ROOT_ID, root);
  let size = 0;
  let over = false;

  const refuse = (refusal: OpenRefusal) => {
    refused.push(refusal);
    if (refused.length > 200) refused.shift();
  };
  const placeholder = (): Drawn => ({ dom: document.createComment(""), children: [], refused: true });
  /** The field a node is, or is inside (an option's select, a textarea's text). */
  const fieldOf = (drawn: Drawn, parent?: Drawn): Element | undefined => {
    if (drawn.namespace === "html" && drawn.name && FIELDS.has(drawn.name)) return drawn.dom as Element;
    if (parent?.namespace === "html" && parent.name === "textarea") return parent.dom as Element;
    return undefined;
  };

  const setAttribute = (drawn: Drawn, name: string, value: unknown) => {
    const element = drawn.dom as Element;
    if (value !== null && value !== undefined && typeof value !== "string") return refuse({ reason: "value", element: drawn.name!, name });
    const judged = judgeAttribute(drawn.namespace!, drawn.name!, name, (value as string | null | undefined) ?? null, options);
    if ("refused" in judged) {
      /* Refused: what it would have said is not drawn, and anything it said before goes too. */
      const known = judgeAttribute(drawn.namespace!, drawn.name!, name, null, options);
      if (!("refused" in known)) element.removeAttribute(known.name);
      return refuse(judged.refused);
    }
    for (const one of judged.dropped ?? []) refuse(one);
    const isField = drawn.namespace === "html" && FIELD_ATTRIBUTES.has(judged.name) && FIELDS.has(drawn.name!);
    const field = element as HTMLInputElement & HTMLOptionElement;
    /* What the field showed before the view spoke: a view that says what is already there has not changed it. */
    const before = isField ? (judged.name === "value" ? field.value : judged.name === "checked" ? field.checked : field.selected) : undefined;
    if (judged.value === null) element.removeAttribute(judged.name);
    else element.setAttribute(judged.name, judged.value);
    options.onAttribute?.(element, judged.name);
    if (!isField) return;
    /* What a field holds live, as well as what it says. */
    if (judged.name === "value" && "value" in field) {
      field.value = judged.value ?? "";
      if (before !== field.value) options.onFieldSet?.(element);
    } else if (judged.name === "checked" && "checked" in field) {
      field.checked = judged.value !== null;
      if (before !== field.checked) options.onFieldSet?.(element);
    } else if (judged.name === "selected" && "selected" in field) {
      field.selected = judged.value !== null;
      if (before !== field.selected) options.onFieldSet?.(element.parentElement?.closest("select") ?? element);
    }
  };

  const forget = (drawn: Drawn) => {
    if (drawn.refused) return;
    size -= 1;
    if (drawn.id !== undefined) byId.delete(drawn.id);
    for (const child of drawn.children) forget(child);
  };

  const build = (raw: unknown, parent: Drawn): Drawn => {
    if (!isRecord(raw) || typeof raw["id"] !== "string" || byId.has(raw["id"])) {
      refuse({ reason: "record" });
      return placeholder();
    }
    if (size >= maxNodes) {
      refuse({ reason: "budget" });
      if (!over) {
        over = true;
        options.onOverBudget?.();
      }
      return placeholder();
    }
    const id = raw["id"];
    if (raw["type"] === COMMENT) return placeholder();
    if (raw["type"] === TEXT) {
      if (isEmptyElement(parent.namespace!, parent.name!)) {
        refuse({ reason: "child", element: parent.name! });
        return placeholder();
      }
      const text = document.createTextNode(String(raw["data"] ?? "").slice(0, OPEN_MAX_TEXT));
      const drawn: Drawn = { dom: text, children: [], text: true, id, parent };
      byId.set(id, drawn);
      ids.set(text, id);
      size += 1;
      return drawn;
    }
    if (raw["type"] !== ELEMENT) {
      refuse({ reason: "record" });
      return placeholder();
    }
    const asked = String(raw["element"]);
    if (isEmptyElement(parent.namespace!, parent.name!)) {
      refuse({ reason: "child", element: asked });
      return placeholder();
    }
    const judged = judgeElement(asked, parent.namespace!);
    if ("refused" in judged) {
      refuse(judged.refused);
      return placeholder();
    }
    const element = document.createElementNS(judged.namespace === "svg" ? SVG_NAMESPACE : HTML_NAMESPACE, judged.name);
    /* A `<nav>` drawn as a `<div>` says so, and the view's `nav` selectors are read as `[data-graview-as="nav"]` (host/css.ts). */
    if (judged.as) element.setAttribute("data-graview-as", judged.as);
    const drawn: Drawn = { dom: element, name: judged.name, namespace: judged.namespace, children: [], id, parent };
    byId.set(id, drawn);
    ids.set(element, id);
    size += 1;
    if (isRecord(raw["attributes"])) for (const [key, value] of Object.entries(raw["attributes"])) setAttribute(drawn, key, value);
    options.decorate?.(element, judged.name, judged.namespace);
    /* A native element has attributes, never Remote DOM properties or listeners: those are a kit component's. */
    if (isRecord(raw["properties"])) for (const key of Object.keys(raw["properties"])) refuse({ reason: "attribute", element: judged.name, name: key });
    if (isRecord(raw["eventListeners"])) for (const key of Object.keys(raw["eventListeners"])) if (raw["eventListeners"][key] != null) refuse({ reason: "attribute", element: judged.name, name: `on${key}` });
    if (Array.isArray(raw["children"])) {
      for (const child of raw["children"]) {
        const built = build(child, drawn);
        drawn.children.push(built);
        element.appendChild(built.dom);
      }
    }
    return drawn;
  };

  const one = (record: unknown) => {
    if (!Array.isArray(record)) return refuse({ reason: "record" });
    const [type, id] = record as [unknown, unknown];
    const target = typeof id === "string" ? byId.get(id) : undefined;
    if (!target) return refuse({ reason: "record" });
    switch (type) {
      case INSERT_CHILD: {
        if (target.text) return refuse({ reason: "record" });
        const index = Number(record[3]);
        const at = Number.isInteger(index) && index >= 0 && index <= target.children.length ? index : target.children.length;
        const built = build(record[2], target);
        target.dom.insertBefore(built.dom, target.children[at]?.dom ?? null);
        target.children.splice(at, 0, built);
        if (target.namespace === "html" && target.name === "textarea") options.onFieldSet?.(target.dom as Element);
        return;
      }
      case REMOVE_CHILD: {
        const index = Number(record[2]);
        const gone = target.children[index];
        if (!gone) return refuse({ reason: "record" });
        target.children.splice(index, 1);
        gone.dom.parentNode?.removeChild(gone.dom);
        forget(gone);
        return;
      }
      case UPDATE_TEXT: {
        if (!target.text) return refuse({ reason: "record" });
        (target.dom as Text).data = String(record[2] ?? "").slice(0, OPEN_MAX_TEXT);
        const field = fieldOf(target, target.parent);
        if (field) options.onFieldSet?.(field);
        return;
      }
      case UPDATE_PROPERTY: {
        if (target === root || target.text) return refuse({ reason: "record" });
        const name = String(record[2]);
        const kind = record[4] ?? PROPERTY;
        if (kind === ATTRIBUTE) return setAttribute(target, name, record[3]);
        if (kind === PROPERTY || kind === EVENT_LISTENER) return refuse({ reason: "attribute", element: target.name!, name: kind === EVENT_LISTENER ? `on${name}` : name });
        return refuse({ reason: "record" });
      }
      default:
        return refuse({ reason: "record" });
    }
  };

  return {
    apply(records, spent) {
      if (!Array.isArray(records)) {
        refuse({ reason: "record" });
        return true;
      }
      for (let index = 0; index < records.length; index += 1) {
        /* Asked every 32 records: often enough that no batch holds the page past its budget by much. */
        if (spent && index % 32 === 0 && spent()) return false;
        one(records[index]);
      }
      return true;
    },
    get refused() {
      return refused;
    },
    get size() {
      return size;
    },
    idOf: (node) => ids.get(node),
    elementOf(id) {
      const drawn = byId.get(id);
      return drawn && !drawn.text && drawn !== root ? (drawn.dom as Element) : undefined;
    },
    dispose() {
      for (const child of root.children) forget(child);
      root.children.length = 0;
      while (into.firstChild) into.removeChild(into.firstChild);
    },
  };
}
