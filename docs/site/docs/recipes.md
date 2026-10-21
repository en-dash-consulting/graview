# Recipes

A recipe is one prompt to hand your agent, with a different task each, and the app an agent made of it. Each is over Larkspur, a made-up repository, and each runs on its page; each page says how it was made.

```sh
Read https://graview.dev/start.md, then turn this repo's docs into a Graview app.
```

## The recipes

- [Your docs, as an app](https://graview.dev/docs/recipes/docs.html): The repository's docs, the modules they cover and who owns each, with every module that has no doc or no owner flagged and the repair offered.
- [Your decisions, as an app](https://graview.dev/docs/recipes/decisions.html): The architecture decision records: what each decided, what it superseded and which modules it affects, with the loose ends flagged.
- [Your dependencies, as an upgrade plan](https://graview.dev/docs/recipes/dependencies.html): Every third-party package, the version pinned against the latest on npm, the modules that use it and the upgrade it needs, with the risky ones flagged.
- [Your architecture, with a face of its own](https://graview.dev/docs/recipes/architecture.html): The zones the modules group into, what each module imports, who owns each zone, and the modules no zone holds yet, with a product face of its own over the running preview.

---

Graview recipes: one prompt to hand an agent, with a different task each, and the app it made, checked on every push and live on its page.

The page: https://graview.dev/docs/recipes.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
