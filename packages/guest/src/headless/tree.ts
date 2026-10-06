/*
 * A TREE WITH NO DOM (FR-95).
 *
 * What the open kit's renderer (host/open-render.ts) draws into, when there
 * is no page: the handful of DOM calls it makes — createElementNS,
 * createTextNode, createComment, setAttribute, removeAttribute,
 * insertBefore, appendChild, removeChild — over plain objects, and what a
 * describer reads back: each element's name, namespace, attributes and
 * children, and a field's live value. Nothing here runs anything, loads
 * anything, or lays anything out.
 */

export const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

export abstract class TreeNode {
  abstract readonly nodeType: 1 | 3 | 8 | 9;
  parentNode: TreeElement | TreeDocument | null = null;
  readonly childNodes: TreeNode[] = [];
  constructor(readonly ownerDocument: TreeDocument | null) {}

  get firstChild(): TreeNode | null {
    return this.childNodes[0] ?? null;
  }
  get parentElement(): TreeElement | null {
    return this.parentNode instanceof TreeElement ? this.parentNode : null;
  }
  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  insertBefore<T extends TreeNode>(child: T, before: TreeNode | null): T {
    if (child.parentNode) child.parentNode.removeChild(child);
    const at = before ? this.childNodes.indexOf(before) : -1;
    if (at < 0) this.childNodes.push(child);
    else this.childNodes.splice(at, 0, child);
    child.parentNode = this as unknown as TreeElement;
    return child;
  }
  appendChild<T extends TreeNode>(child: T): T {
    return this.insertBefore(child, null);
  }
  removeChild<T extends TreeNode>(child: T): T {
    const at = this.childNodes.indexOf(child);
    if (at >= 0) this.childNodes.splice(at, 1);
    child.parentNode = null;
    return child;
  }
}

export class TreeText extends TreeNode {
  readonly nodeType = 3 as const;
  constructor(
    owner: TreeDocument,
    public data: string,
  ) {
    super(owner);
  }
  override get textContent(): string {
    return this.data;
  }
}

export class TreeComment extends TreeNode {
  readonly nodeType = 8 as const;
  override get textContent(): string {
    return "";
  }
}

export class TreeElement extends TreeNode {
  readonly nodeType = 1 as const;
  readonly attributes = new Map<string, string>();
  /* A field's live state, as a page keeps it beside its attributes. */
  value = "";
  checked = false;
  selected = false;
  constructor(
    owner: TreeDocument,
    readonly namespaceURI: string,
    readonly localName: string,
  ) {
    super(owner);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  /** The nearest element by local name, this one or above: all the renderer asks of `closest`. */
  closest(name: string): TreeElement | null {
    for (let at: TreeElement | null = this; at; at = at.parentElement) if (at.localName === name) return at;
    return null;
  }
}

export class TreeDocument extends TreeNode {
  readonly nodeType = 9 as const;
  constructor() {
    super(null);
  }
  createElementNS(namespace: string, name: string): TreeElement {
    return new TreeElement(this, namespace, name);
  }
  createElement(name: string): TreeElement {
    return new TreeElement(this, HTML_NAMESPACE, name);
  }
  createTextNode(data: string): TreeText {
    return new TreeText(this, data);
  }
  createComment(_data: string): TreeComment {
    return new TreeComment(this);
  }
}

/** A document of its own, and the element a view's drawing is drawn under. */
export function createTree(): { readonly document: TreeDocument; readonly root: TreeElement } {
  const document = new TreeDocument();
  const root = document.createElement("div");
  root.setAttribute("data-graview-view-root", "");
  document.appendChild(root);
  return { document, root };
}
