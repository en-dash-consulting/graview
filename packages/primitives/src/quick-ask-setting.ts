/**
 * THE APP'S QUICK-ASK SETTING, from what a host stored for the Ask box it
 * replaced (Roadmap f-quick-ask-framework): the Ask box's `"field"` is on
 * and its `"hidden"` is off, a boolean is itself, and nothing said is on.
 * A host that kept the old setting hands it here and passes the answer as
 * `quickAsk` — to the Shell, a routed face's context, or an embed.
 */
export function quickAskOf(setting: unknown): boolean {
  return !(setting === "hidden" || setting === false);
}
