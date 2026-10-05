import { RemoteElement } from "@remote-dom/core/elements";
import type { Kit, KitComponent, KitPropertyType } from "../kit.js";

/** The Remote DOM type a kit property is kept as on the worker's side. */
const remoteType = (type: KitPropertyType) => (type === "number" ? Number : type === "boolean" ? Boolean : String);

/**
 * ONE COMPONENT OF THE KIT, AS A REMOTE ELEMENT: its declared properties
 * (each also settable as an attribute of the same name) and its declared
 * events, and nothing else. What it says goes to the host as mutation
 * records, and the host draws only what the same declaration allows.
 */
export function kitElement(component: KitComponent): CustomElementConstructor {
  const properties = Object.fromEntries(Object.entries(component.properties).map(([name, property]) => [name, { type: remoteType(property.type), attribute: true }]));
  const events = Object.keys(component.events);
  class KitElement extends RemoteElement {
    /* A kit element is never slotted: the host has no slots to put it in. */
    static override readonly slottable = false as never;
    static override readonly remoteProperties = properties;
    static override readonly remoteEvents = events;
  }
  return KitElement as unknown as CustomElementConstructor;
}

/** Define every component of a kit in a registry, by its element name. */
export function defineKit(kit: Kit, registry: CustomElementRegistry = customElements): void {
  for (const [name, component] of Object.entries(kit)) {
    if (!registry.get(name)) registry.define(name, kitElement(component));
  }
}
