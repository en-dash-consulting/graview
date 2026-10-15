/*
 * ANOTHER APP'S ADDRESS (FR-171), with nothing of zod: the rule language
 * reads a link to another app's record through it, and a page that judges
 * a rule must not carry zod for it (the guest host does not).
 */

/** What an app-link field holds: `@owner/app`, an id, or an absolute http(s) address. */
export const APP_ADDRESS = /^(?:https?:\/\/[^\s<>"'`\\]+|@?[A-Za-z0-9][\w.~-]*(?:\/[\w.~-]+)*)$/;

/** Whether a value is another app's address: `@owner/app`, an app id, or an absolute http(s) address, of at most 500 characters. */
export const isAppAddress = (value: unknown): value is string => typeof value === "string" && value.length < 501 && APP_ADDRESS.test(value);
